// pages/game.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const INITIAL_PRICE_CENTS = 1; // 1 centime
const STORAGE_KEY = "pixelgrid_local_demo_tailwind_v1";

function centsToEuroString(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function Game() {
  // UI state
  const [isClient, setIsClient] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [pickerColor, setPickerColor] = useState("#e7602b");
  const [intensity, setIntensity] = useState(24);
  const [balanceCents, setBalanceCents] = useState(0);
  const [purchasedCount, setPurchasedCount] = useState(0);

  // canvas + world refs
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const scaleRef = useRef(8);
  const offsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const hoverRef = useRef({ row: -1, col: -1 });
  const rafRef = useRef(null);

  // purchased pixels sparse map: Map<idx, { c: '#RRGGBB', intensity: number, exp: number }>
  const purchasedRef = useRef(new Map());

  const [, tick] = useState(0);
  const triggerRender = useCallback(() => tick((n) => n + 1), []);

  // helper for display (évite "??" si ton Babel est strict)
  const getPrevPurchases = useCallback((idx) => {
    const v = purchasedRef.current.get(idx);
    return v && typeof v.exp === "number" ? v.exp : 0;
  }, []);

  // load local
  useEffect(() => {
    setIsClient(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        const m = new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
        purchasedRef.current = m;
        setPurchasedCount(m.size);
      }
    } catch {}
  }, []);

  // persist purchases to local (debounced)
  const persistTimer = useRef(null);
  const persistLocal = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        const out = Object.fromEntries(Array.from(purchasedRef.current.entries()));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch {}
    }, 300);
  }, []);

  // price (cents) for a pixel index
  const getPriceCents = useCallback((idx) => {
    const cur = purchasedRef.current.get(idx);
    const exp = cur ? cur.exp : 0;
    return INITIAL_PRICE_CENTS * Math.pow(2, exp);
  }, []);

  // optional: preload window from backend
  const loadWindow = useCallback(async (start = 0, end = 10000) => {
    try {
      const res = await fetch(`/api/pixels/get?start=${start}&end=${end}`);
      if (!res.ok) return;
      const json = await res.json();
      const m = purchasedRef.current;
      for (const [k, v] of Object.entries(json)) {
        const idx = Number(k);
        const color = v[0];
        const inten = v[1] ?? 24;
        const buyCount = v[2] ?? 1;
        m.set(idx, { c: color, intensity: inten, exp: Math.max(0, buyCount - 1) });
      }
      purchasedRef.current = m;
      setPurchasedCount(m.size);
      persistLocal();
      triggerRender();
    } catch {}
  }, [persistLocal, triggerRender]);

  // buy pixel (backend)
  const buyPixel = useCallback(async (idx, color, intensityVal) => {
    try {
      const res = await fetch("/api/pixels/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelIndex: idx, color, intensity: intensityVal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Purchase failed");
      const cur = purchasedRef.current.get(idx);
      const newExp = cur ? cur.exp + 1 : 1;
      purchasedRef.current.set(idx, { c: color, intensity: intensityVal, exp: newExp });
      setPurchasedCount(purchasedRef.current.size);
      persistLocal();
      triggerRender();
      try {
        const me = await fetch("/api/me");
        if (me.ok) {
          const j = await me.json();
          setBalanceCents(j.balanceCents || 0);
        }
      } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [persistLocal, triggerRender]);

  // add funds (UI simple)
  const addFunds = useCallback(async () => {
    const amount = prompt("Montant à ajouter en € (min 1) :", "25");
    if (!amount) return;
    const f = parseFloat(amount);
    if (isNaN(f) || f < 1) {
      alert("Montant invalide");
      return;
    }
    try {
      const res = await fetch("/api/wallet/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(f * 100) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.url) window.location.href = json.url;
    } catch (e) {
      alert("Erreur: " + e.message);
    }
  }, []);

  // Canvas draw loop (client-only)
  useEffect(() => {
    if (!isClient) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    dprRef.current = window.devicePixelRatio || 1;

    function resizeBackingStore() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = dprRef.current;
      const bw = Math.floor(w * dpr);
      const bh = Math.floor(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function centerGrid() {
      const rect = canvas.getBoundingClientRect();
      const s = scaleRef.current;
      offsetRef.current.x = Math.round((rect.width - GRID_SIZE * s) / 2);
      offsetRef.current.y = Math.round((rect.height - GRID_SIZE * s) / 2);
    }

    resizeBackingStore();
    centerGrid();

    function draw() {
      resizeBackingStore();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const s = scaleRef.current;
      const off = offsetRef.current;

      // background dégradé sombre
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0a0f16");
      g.addColorStop(1, "#0b1220");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // visible range
      const startCol = Math.max(0, Math.floor((-off.x) / s));
      const startRow = Math.max(0, Math.floor((-off.y) / s));
      const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - off.x) / s));
      const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - off.y) / s));

      // zone légère
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.015)";
      ctx.fillRect(off.x, off.y, GRID_SIZE * s, GRID_SIZE * s);
      ctx.restore();

      const m = purchasedRef.current;

      if (s < 4) {
        for (const [idx, val] of m.entries()) {
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          if (col < startCol || col > endCol || row < startRow || row > endRow) continue;
          const px = Math.round(off.x + col * s);
          const py = Math.round(off.y + row * s);
          ctx.fillStyle = val.c || "#ffffff";
          ctx.fillRect(px, py, Math.ceil(s), Math.ceil(s));
        }
      } else {
        for (let r = startRow; r <= endRow; r++) {
          const base = r * GRID_SIZE;
          for (let c = startCol; c <= endCol; c++) {
            const idx = base + c;
            const item = m.get(idx);
            const px = off.x + c * s;
            const py = off.y + r * s;
            if (!item) {
              ctx.fillStyle = "#ffffff";
              ctx.globalAlpha = 0.03;
              ctx.fillRect(px, py, s, s);
              ctx.globalAlpha = 1;
              ctx.strokeStyle = "rgba(255,255,255,0.02)";
              ctx.lineWidth = 1;
              ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
            } else {
              ctx.fillStyle = item.c || "#ffffff";
              ctx.fillRect(px, py, s, s);
              ctx.strokeStyle = "rgba(0,0,0,0.18)";
              ctx.lineWidth = Math.max(1, s * 0.06);
              ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
            }
          }
        }
      }

      // hover preview
      const hv = hoverRef.current;
      if (hv && hv.row >= 0 && hv.col >= 0 && hv.row < GRID_SIZE && hv.col < GRID_SIZE) {
        const px = off.x + hv.col * s;
        const py = off.y + hv.row * s;
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.fillStyle = pickerColor;
        ctx.fillRect(px, py, s, s);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff80";
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
        ctx.restore();
      }

      // grid lines when zoomed
      if (s >= 6) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        for (let c = startCol; c <= endCol + 1; c++) {
          const x = Math.round(off.x + c * s) + 0.5;
          ctx.moveTo(x, Math.max(0, off.y + startRow * s));
          ctx.lineTo(x, Math.min(h, off.y + (endRow + 1) * s));
        }
        for (let r = startRow; r <= endRow + 1; r++) {
          const y = Math.round(off.y + r * s) + 0.5;
          ctx.moveTo(Math.max(0, off.x + startCol * s), y);
          ctx.lineTo(Math.min(w, off.x + (endCol + 1) * s), y);
        }
        ctx.stroke();
      }
    }

    function loop() {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function toGrid(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const s = scaleRef.current;
      const gx = (x - offsetRef.current.x) / s;
      const gy = (y - offsetRef.current.y) / s;
      return { row: Math.floor(gy), col: Math.floor(gx) };
    }

    function onPointerDown(e) {
      draggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "grabbing";
    }
    function onPointerUp(e) {
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.style.cursor = "grab";
      const last = lastPointerRef.current;
      draggingRef.current = false;
      const dx = Math.abs(e.clientX - last.x);
      const dy = Math.abs(e.clientY - last.y);
      const dt = Date.now() - last.time;
      if (dx < 6 && dy < 6 && dt < 400) {
        const pos = toGrid(e.clientX, e.clientY);
        if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
          const idx = pos.row * GRID_SIZE + pos.col;
          setSelectedIdx(idx);
          const existing = purchasedRef.current.get(idx);
          if (existing) {
            setPickerColor(existing.c);
            setIntensity(existing.intensity ?? 24);
          } else {
            setPickerColor("#e7602b");
            setIntensity(24);
          }
        } else {
          setSelectedIdx(null);
        }
      }
    }

    function onPointerMove(e) {
      if (draggingRef.current && (e.buttons & 1)) {
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
      } else {
        const pos = toGrid(e.clientX, e.clientY);
        if (pos.row !== hoverRef.current.row || pos.col !== hoverRef.current.col) {
          hoverRef.current.row = pos.row;
          hoverRef.current.col = pos.col;
        }
      }
    }

    function onWheel(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scaleRef.current;
      const delta = -e.deltaY;
      const zoomFactor = Math.exp(delta * 0.0016);
      const newScale = Math.min(64, Math.max(1.2, oldScale * zoomFactor));
      const worldX = (mx - offsetRef.current.x) / oldScale;
      const worldY = (my - offsetRef.current.y) / oldScale;
      offsetRef.current.x = mx - worldX * newScale;
      offsetRef.current.y = my - worldY * newScale;
      scaleRef.current = newScale;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", () => {});

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", () => {});
    };
  }, [isClient, pickerColor]);

  // initial client load
  useEffect(() => {
    if (!isClient) return;
    loadWindow(0, 10000);
    (async () => {
      try {
        const me = await fetch("/api/me");
        if (me.ok) {
          const j = await me.json();
          setBalanceCents(j.balanceCents || 0);
        }
      } catch {}
    })();
  }, [isClient, loadWindow]);

  const handlePurchase = useCallback(async () => {
    if (selectedIdx == null) {
      alert("Sélectionne un pixel d'abord.");
      return;
    }
    const priceCents = getPriceCents(selectedIdx);
    if (!confirm(`Acheter le pixel #${selectedIdx} pour ${centsToEuroString(priceCents)} ?`)) return;
    const res = await buyPixel(selectedIdx, pickerColor, intensity);
    if (!res.ok) alert("Erreur d'achat : " + (res.error || "unknown"));
    else alert("Achat réussi.");
  }, [selectedIdx, pickerColor, intensity, buyPixel]);

  const totalValueCents = useMemo(() => {
    let s = 0;
    for (const [, v] of purchasedRef.current.entries()) {
      const exp = v.exp || 0;
      s += INITIAL_PRICE_CENTS * Math.pow(2, exp);
    }
    return s;
  }, [tick]);

  const UserIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#07102a] to-[#0b1220] text-[#e6eef8] font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center px-5 z-50 backdrop-blur-md border-b border-white/5 bg-gradient-to-b from-[#0a0c10]/85 to-[#0a0c10]/75">
        <div className="flex items-center gap-3">
          <Link href="/"><a className="text-[#19b7ff] no-underline font-extrabold text-lg hover:brightness-110 transition">▦ PixelGrid</a></Link>
          <div className="text-xs text-blue-100/75">1,000,000 pixels</div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-blue-100/90">
            Solde : <strong className="text-[#3fe0b0]">{centsToEuroString(balanceCents)}</strong>
          </div>

          <button
            onClick={addFunds}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff7a45] to-[#ff6a33] text-[#07102a] font-extrabold rounded-xl px-3 py-2 shadow-[0_10px_30px_rgba(255,120,64,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(255,120,64,0.32)] focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
          >
            💳 <span>Ajouter des fonds</span>
          </button>

          <Link href="/auth/signin">
            <a
              aria-label="Compte"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 text-white border border-white/10 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(2,6,22,0.55)] hover:bg-white/10"
            >
              <UserIcon size={18} />
            </a>
          </Link>
        </div>
      </header>

      {/* main layout */}
      <main className="pt-20 h-[calc(100vh-5rem)] flex gap-4 items-stretch">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="relative w-full max-w-[1280px] h-full rounded-xl overflow-hidden shadow-[0_30px_80px_rgba(2,6,22,0.6)] border border-white/5">
            <canvas ref={canvasRef} className="w-full h-full block cursor-grab" />
            {/* HUD */}
            <div className="absolute left-3.5 bottom-3.5 bg-black/60 text-blue-100/90 px-2.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { scaleRef.current = Math.max(1.2, scaleRef.current * 0.9); triggerRender(); }}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(2,6,22,0.55)] hover:bg-white/10"
                >−</button>
                <div className="min-w-16 text-center font-extrabold">{Math.round(scaleRef.current * 100)}%</div>
                <button
                  onClick={() => { scaleRef.current = Math.min(64, scaleRef.current * 1.1); triggerRender(); }}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(2,6,22,0.55)] hover:bg-white/10"
                >＋</button>
              </div>
              <div className="text-[11px] opacity-85 mt-2">Click to select • Drag to pan • Wheel to zoom</div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-[360px] px-4">
          <div className="sticky top-20 flex flex-col gap-3">
            {/* Selected Pixel */}
            <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-white/10 rounded-xl p-4 shadow-[0_6px_24px_rgba(1,4,12,0.3)] hover:shadow-[0_10px_34px_rgba(1,4,12,0.4)] transition">
              <div className="font-extrabold text-blue-100/90 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-300" />
                Selected Pixel
                {selectedIdx != null && (
                  <span className="ml-auto text-xs text-blue-300/70">
                    ({Math.floor(selectedIdx / GRID_SIZE)}, {selectedIdx % GRID_SIZE})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 rounded-lg border border-black/40 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.06)]" style={{ background: pickerColor }} />
                <div className="text-sm text-blue-200/70 leading-tight">
                  <div>Current Owner</div>
                  <div>Available</div>
                </div>
              </div>

              <div className="bg-[#0e141b] border border-white/10 rounded-lg p-3">
                <div className="text-sm text-blue-200/80">Current Price</div>
                <div className="font-black text-[28px] text-cyan-300 mt-1">
                  {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
                </div>
                <div className="text-xs text-blue-300/70">
                  {selectedIdx != null ? getPrevPurchases(selectedIdx) : 0} previous purchases
                </div>
              </div>
            </section>

            {/* Color */}
            <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-white/10 rounded-xl p-4 shadow-[0_6px_24px_rgba(1,4,12,0.3)] hover:shadow-[0_10px_34px_rgba(1,4,12,0.4)] transition">
              <div className="font-extrabold text-blue-100/90 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-300" />
                Pixel Color
              </div>

              <div className="w-full">
                <input
                  type="color"
                  value={pickerColor}
                  onChange={(e) => setPickerColor(e.target.value)}
                  className="w-full h-10 rounded-lg border border-white/10 bg-[#121922] p-0 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-cyan-400/30 hover:shadow-[0_0_0_2px_rgba(53,200,255,0.15)]"
                />
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                {["#e7602b","#ff3b30","#34c759","#0a84ff","#ffcc00","#a64dff","#00d1ff","#ffffff","#111318"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPickerColor(c)}
                    aria-label={c}
                    className="w-7 h-7 rounded-[7px] border border-white/10 transition transform hover:-translate-y-0.5 hover:shadow-[0_0_0_6px_rgba(255,255,255,0.06)]"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </section>

            {/* Intensity */}
            <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-white/10 rounded-xl p-4 shadow-[0_6px_24px_rgba(1,4,12,0.3)] hover:shadow-[0_10px_34px_rgba(1,4,12,0.4)] transition">
              <div className="font-extrabold text-blue-100/90 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-300" />
                Intensity Level
              </div>

              <div className="py-1">
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-slate-900 accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-xs text-blue-200/80 mt-1">
                <span>0 (Dim)</span>
                <span className="px-2 py-0.5 rounded-full bg-[#0e141b] border border-white/10 font-bold text-blue-50/90">
                  {intensity}/30
                </span>
                <span>30 (Bright)</span>
              </div>
            </section>

            {/* Purchase */}
            <button
              onClick={handlePurchase}
              className="w-full bg-gradient-to-r from-[#ff7a45] to-[#ff6a33] text-[#07102a] font-black rounded-xl px-4 py-3 shadow-[0_10px_30px_rgba(255,120,64,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(255,120,64,0.32)] focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
            >
              🛒 Acheter pour {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
            </button>

            {/* Info */}
            <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-white/10 rounded-xl p-4 shadow-[0_6px_24px_rgba(1,4,12,0.3)]">
              <div className="text-sm text-blue-50/90">
                Each pixel starts at €0.01 and doubles in price with every purchase.
              </div>
              <div className="mt-2 text-sm text-blue-100/90">
                Next price: {centsToEuroString((selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS) * 2)}
              </div>
            </section>

            {/* Stats */}
            <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-white/10 rounded-xl p-4 shadow-[0_6px_24px_rgba(1,4,12,0.3)]">
              <div className="font-extrabold text-blue-100/90 flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-300" />
                Grid Statistics
              </div>

              <div className="flex gap-2 mt-1">
                <div className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-2.5">
                  <div className="text-xs text-blue-200/80">Pixels Owned</div>
                  <div className="font-extrabold text-2xl">{purchasedCount}</div>
                </div>
                <div className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-2.5">
                  <div className="text-xs text-blue-200/80">Total Value</div>
                  <div className="font-extrabold text-2xl">{centsToEuroString(totalValueCents)}</div>
                </div>
              </div>

              <div className="mt-2 text-[13px] text-blue-200/80">
                Available Pixels: {TOTAL_PIXELS - purchasedCount}<br />
                Completion: {((purchasedCount / TOTAL_PIXELS) * 100).toFixed(6)}%
              </div>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}



