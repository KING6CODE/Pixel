// pages/game.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/**
 * pages/game.js
 *
 * - Canvas-based interactive 1000x1000 pixel grid (sparse storage for purchased pixels)
 * - No ParticlesBackground; page has a subtle gradient background
 * - Professional user icon (SVG) instead of emoji
 * - UI (header + sidebar) fixed above canvas and not affected by zoom/pan
 * - All direct DOM/window usage inside useEffect => SSR-safe
 *
 * NOTE: Backend endpoints used (optional):
 *  - GET /api/pixels/get?start=...&end=...
 *  - POST /api/pixels/buy { pixelIndex, color, intensity }
 *  - POST /api/wallet/create-checkout-session { amountCents }
 *
 * This file is self-contained and ready to be used.
 */

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const INITIAL_PRICE_CENTS = 1; // 1 centime
const STORAGE_KEY = "pixelgrid_local_demo_v2";

function centsToEuroString(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function Game() {
  // UI state
  const [isClient, setIsClient] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [pickerColor, setPickerColor] = useState("#ff3b30");
  const [intensity, setIntensity] = useState(30);
  const [balanceCents, setBalanceCents] = useState(0);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [loadingWindow, setLoadingWindow] = useState(false);

  // canvas + world refs
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const scaleRef = useRef(8); // px per pixel initial
  const offsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const hoverRef = useRef({ row: -1, col: -1 });
  const rafRef = useRef(null);

  // purchased pixels sparse map: Map<idx, { c: '#RRGGBB', intensity: number, exp: number }>
  const purchasedRef = useRef(new Map());

  // rerender trigger for UI when needed
  const [, tick] = useState(0);
  const triggerRender = useCallback(() => tick((n) => n + 1), []);

  // load local fallback (optional)
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
    } catch (e) {
      // ignore
    }
  }, []);

  // persist purchases to local (debounced)
  const persistTimer = useRef(null);
  const persistLocal = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        const out = Object.fromEntries(Array.from(purchasedRef.current.entries()));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) {
        console.warn("persist err", e);
      }
    }, 300);
  }, []);

  // get price (cents) for a pixel index (exp stored as exp; default 0 => 1 cent)
  const getPriceCents = useCallback((idx) => {
    const cur = purchasedRef.current.get(idx);
    const exp = cur ? cur.exp : 0;
    return INITIAL_PRICE_CENTS * Math.pow(2, exp);
  }, []);

  // load a window of purchased pixels from backend (start..end)
  const loadWindow = useCallback(async (start = 0, end = 10000) => {
    setLoadingWindow(true);
    try {
      const res = await fetch(`/api/pixels/get?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to load window");
      const json = await res.json();
      const m = purchasedRef.current;
      for (const [k, v] of Object.entries(json)) {
        const idx = Number(k);
        // backend format [color, intensity, buyCount]
        const color = v[0];
        const inten = v[1] ?? 30;
        const buyCount = v[2] ?? 1;
        m.set(idx, { c: color, intensity: inten, exp: Math.max(0, buyCount - 1) });
      }
      purchasedRef.current = m;
      setPurchasedCount(m.size);
      persistLocal();
      triggerRender();
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingWindow(false);
    }
  }, [persistLocal, triggerRender]);

  // buy pixel via backend; server does wallet/transaction handling
  const buyPixel = useCallback(async (idx, color, intensityVal) => {
    try {
      const res = await fetch("/api/pixels/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelIndex: idx, color, intensity: intensityVal }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Purchase failed");
      }
      // update local sparse map
      const cur = purchasedRef.current.get(idx);
      const newExp = cur ? cur.exp + 1 : 1;
      purchasedRef.current.set(idx, { c: color, intensity: intensityVal, exp: newExp });
      setPurchasedCount(purchasedRef.current.size);
      persistLocal();
      triggerRender();
      // update balance via /api/me optionally
      try {
        const me = await fetch("/api/me");
        if (me.ok) {
          const j = await me.json();
          setBalanceCents(j.balanceCents || 0);
        }
      } catch (_) {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [persistLocal, triggerRender]);

  // start Stripe checkout to add funds
  const addFunds = useCallback(async () => {
    const amount = prompt("Montant à ajouter en € (min 1) :", "10");
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

    // initial center grid
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

      // background
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#0b1220");
      g.addColorStop(1, "#07102a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // visible range in grid coordinates
      const startCol = Math.max(0, Math.floor((-off.x) / s));
      const startRow = Math.max(0, Math.floor((-off.y) / s));
      const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - off.x) / s));
      const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - off.y) / s));

      // subtle grid area background
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.01)";
      ctx.fillRect(off.x, off.y, GRID_SIZE * s, GRID_SIZE * s);
      ctx.restore();

      const drawFull = s >= 4;
      const m = purchasedRef.current;

      if (!drawFull) {
        // only draw purchased pixels
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
        // draw full visible window
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
              ctx.strokeStyle = "rgba(0,0,0,0.12)";
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
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = pickerColor;
        ctx.fillRect(px, py, s, s);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff66";
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
        ctx.restore();
      }

      // grid lines when zoomed enough
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

    // pointer helpers
    function toGrid(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const s = scaleRef.current;
      const gx = (x - offsetRef.current.x) / s;
      const gy = (y - offsetRef.current.y) / s;
      return { row: Math.floor(gy), col: Math.floor(gx), localX: gx - Math.floor(gx), localY: gy - Math.floor(gy) };
    }

    function onPointerDown(e) {
      draggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      canvas.setPointerCapture?.(e.pointerId);
    }
    function onPointerUp(e) {
      canvas.releasePointerCapture?.(e.pointerId);
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
            setIntensity(existing.intensity ?? 30);
          } else {
            setPickerColor("#ffffff");
            setIntensity(30);
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
      // intercept wheel when over canvas — prevent page zoom/scroll
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scaleRef.current;
      const delta = -e.deltaY;
      const zoomFactor = Math.exp(delta * 0.0016); // tuned factor
      let newScale = Math.min(64, Math.max(1.2, oldScale * zoomFactor));
      // keep mouse world point stable
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

    const onResize = () => {
      // will adjust backing store next RAF loop
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, [isClient, pickerColor]);

  // initial client load
  useEffect(() => {
    if (!isClient) return;
    loadWindow(0, 10000); // preload a window near origin
    (async () => {
      try {
        const me = await fetch("/api/me");
        if (me.ok) {
          const j = await me.json();
          setBalanceCents(j.balanceCents || 0);
        }
      } catch (_) {}
    })();
  }, [isClient, loadWindow]);

  // purchase handler
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

  // small UI helpers
  const totalValueCents = useMemo(() => {
    let s = 0;
    for (const [, v] of purchasedRef.current.entries()) {
      const exp = v.exp || 0;
      s += INITIAL_PRICE_CENTS * Math.pow(2, exp);
    }
    return s;
  }, [tick]); // recompute when triggerRender is called

  // professional user SVG icon (no emoji)
  const UserIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#07102a 0%, #0b1220 100%)",
      color: "#e6eef8",
      fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Header - fixed */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 64, display: "flex", alignItems: "center",
        padding: "0 20px", zIndex: 1200, backdropFilter: "blur(6px)", borderBottom: "1px solid rgba(255,255,255,0.03)",
        background: "linear-gradient(180deg, rgba(10,12,16,0.85), rgba(10,12,16,0.75))"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/"><a style={{ textDecoration: "none", color: "#19b7ff", fontWeight: 900, fontSize: 18 }}>▦ PixelGrid</a></Link>
          <div style={{ color: "rgba(230,238,248,0.75)", fontSize: 13 }}>1,000,000 pixels</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "rgba(200,230,255,0.95)", fontSize: 14 }}>
            Balance: <strong style={{ color: "#3fe0b0" }}>{centsToEuroString(balanceCents)}</strong>
          </div>
          <button onClick={addFunds} style={{
            background: "linear-gradient(90deg,#ff7a45,#ff6a33)",
            padding: "8px 12px", borderRadius: 8, border: "none", color: "#07102a", fontWeight: 800, cursor: "pointer"
          }}>
            Add Funds
          </button>
          <Link href="/auth/signin">
            <a style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.03)",
              color: "#e6eef8", textDecoration: "none"
            }} aria-label="Compte">
              <UserIcon size={18} />
            </a>
          </Link>
        </div>
      </header>

      {/* main layout */}
      <main style={{ paddingTop: 84, display: "flex", gap: 18, alignItems: "stretch", height: "calc(100vh - 84px)" }}>
        {/* Canvas area centered */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 24px" }}>
          <div style={{
            position: "relative", width: "100%", maxWidth: 1280, height: "100%",
            borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 80px rgba(2,6,22,0.6)"
          }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }} />
            {/* zoom HUD bottom-left */}
            <div style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(0,0,0,0.6)", padding: 10, borderRadius: 10, color: "#cfe5ff", zIndex: 60 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => { scaleRef.current = Math.max(1.2, scaleRef.current * 0.9); triggerRender(); }} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "none", color: "#fff" }}>−</button>
                <div style={{ minWidth: 64, textAlign: "center", fontWeight: 700 }}>{Math.round(scaleRef.current * 100)}%</div>
                <button onClick={() => { scaleRef.current = Math.min(64, scaleRef.current * 1.1); triggerRender(); }} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "none", color: "#fff" }}>＋</button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>Click to select • Drag to pan • Wheel to zoom</div>
            </div>
          </div>
        </div>

        {/* Sidebar - fixed width */}
        <aside style={{ width: 360, padding: "12px 18px", pointerEvents: "auto" }}>
          <div style={{ position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Price card */}
            <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))", padding: 16, borderRadius: 12 }}>
              <div style={{ color: "#9fc8ff", fontSize: 13 }}>Current Price</div>
              <div style={{ fontWeight: 900, fontSize: 28, marginTop: 6 }}>
                {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
              </div>
              <div style={{ color: "rgba(200,230,255,0.85)", fontSize: 12 }}>
                {selectedIdx != null ? ((purchasedRef.current.get(selectedIdx)?.exp ?? 0) + " previous purchases") : "0 previous purchases"}
              </div>
            </div>

            {/* Color picker */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "#cfe5ff" }}>Pixel Color</div>
                <div style={{ width: 36, height: 24, borderRadius: 6, background: pickerColor, border: "1px solid rgba(0,0,0,0.25)" }} />
              </div>
              <input type="color" value={pickerColor} onChange={(e) => setPickerColor(e.target.value)} style={{ width: "100%", height: 40, marginTop: 10, borderRadius: 8, border: "none", padding: 4 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {["#ff3b30","#34c759","#0a84ff","#ffcc00","#ff2d55","#00d1ff","#ffffff","#000000"].map(c => (
                  <button key={c} onClick={() => setPickerColor(c)} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid rgba(255,255,255,0.06)" }} />
                ))}
              </div>
            </div>

            {/* Intensity */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, color: "#cfe5ff" }}>Intensity Level</div>
              <input type="range" min={0} max={30} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: "100%", marginTop: 8 }} />
              <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(200,230,255,0.8)", fontSize: 12 }}>
                <div>0 (Dim)</div>
                <div>{intensity}/30</div>
                <div>30 (Bright)</div>
              </div>
            </div>

            {/* Purchase */}
            <button onClick={handlePurchase} style={{ background: "linear-gradient(90deg,#ff7a45,#ff6a33)", padding: "12px 14px", borderRadius: 10, border: "none", color: "#07102a", fontWeight: 900 }}>
              🛒 Purchase Pixel for {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
            </button>

            {/* Info + stats */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12 }}>
              <div style={{ fontSize: 13 }}>Each pixel starts at €0.01 and doubles in price every purchase.</div>
              <div style={{ marginTop: 8, color: "rgba(200,230,255,0.9)" }}>Next price: {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) * 2 : INITIAL_PRICE_CENTS * 2)}</div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 800, color: "#cfe5ff" }}>Grid Statistics</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(200,230,255,0.8)" }}>Pixels Owned</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{purchasedCount}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(200,230,255,0.8)" }}>Total Value</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{centsToEuroString(totalValueCents)}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, color: "rgba(200,230,255,0.7)", fontSize: 13 }}>
                Available Pixels: {TOTAL_PIXELS - purchasedCount}<br />
                Completion: {((purchasedCount / TOTAL_PIXELS) * 100).toFixed(6)}%
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

