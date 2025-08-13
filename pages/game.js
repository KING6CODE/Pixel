// pages/game.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const INITIAL_PRICE_CENTS = 1; // 1 centime
const STORAGE_KEY = "pixelgrid_local_demo_v3";

function centsToEuroString(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function Game() {
  // UI state
  const [isClient, setIsClient] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [pickerColor, setPickerColor] = useState("#e7602b"); // orange comme la capture
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

  // add funds (simple — modale complète possible plus tard)
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

      // background (plus sombre, bleu nuit)
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

      // subtle stage
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

    // pointer helpers
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
    <div className="page">
      {/* Header */}
      <header className="hdr">
        <div className="brand">
          <Link href="/"><a className="logo">▦ PixelGrid</a></Link>
          <div className="muted">1,000,000 pixels</div>
        </div>

        <div className="hdr-right">
          <div className="balance">
            Solde&nbsp;: <strong className="money">{centsToEuroString(balanceCents)}</strong>
          </div>
          <button className="btn btn-primary" onClick={addFunds}>
            <span className="btn-ico">💳</span> Ajouter des fonds
          </button>
          <Link href="/auth/signin">
            <a className="icon-btn" aria-label="Compte">
              <UserIcon size={18} />
            </a>
          </Link>
        </div>
      </header>

      {/* main layout */}
      <main className="main">
        {/* Canvas */}
        <div className="stage-wrap">
          <div className="stage">
            <canvas ref={canvasRef} className="canvas" />
            <div className="hud">
              <div className="zoom">
                <button className="icon-pad" onClick={() => { scaleRef.current = Math.max(1.2, scaleRef.current * 0.9); triggerRender(); }}>−</button>
                <div className="zoom-val">{Math.round(scaleRef.current * 100)}%</div>
                <button className="icon-pad" onClick={() => { scaleRef.current = Math.min(64, scaleRef.current * 1.1); triggerRender(); }}>＋</button>
              </div>
              <div className="hint">Click to select • Drag to pan • Wheel to zoom</div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sticky">
            {/* Selected Pixel */}
            <section className="card">
              <div className="card-title">
                <span className="dot teal" /> Selected Pixel
                {selectedIdx != null && (
                  <span className="pos">({Math.floor(selectedIdx / GRID_SIZE)}, {selectedIdx % GRID_SIZE})</span>
                )}
              </div>

              <div className="pixel-row">
                <div className="pixel-box" style={{ background: pickerColor }} />
                <div className="pixel-info">
                  <div className="muted">Current Owner</div>
                  <div className="muted">Available</div>
                </div>
              </div>

              <div className="price-block">
                <div className="muted">Current Price</div>
                <div className="price">
                  {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
                </div>
                <div className="tiny">
                  {(selectedIdx != null ? ((purchasedRef.current.get(selectedIdx)?.exp ?? 0) : 0))} previous purchases
                </div>
              </div>
            </section>

            {/* Color */}
            <section className="card">
              <div className="card-title"><span className="dot cyan" /> Pixel Color</div>

              <div className="color-input">
                <input type="color" value={pickerColor} onChange={(e) => setPickerColor(e.target.value)} />
              </div>

              <div className="swatches">
                {["#e7602b","#ff3b30","#34c759","#0a84ff","#ffcc00","#a64dff","#00d1ff","#ffffff","#111318"].map(c => (
                  <button key={c} onClick={() => setPickerColor(c)} className="sw" style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </section>

            {/* Intensity */}
            <section className="card">
              <div className="card-title"><span className="dot cyan" /> Intensity Level</div>
              <div className="range-wrap">
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                />
              </div>
              <div className="range-legend">
                <span>0 (Dim)</span>
                <span className="badge">{intensity}/30</span>
                <span>30 (Bright)</span>
              </div>
            </section>

            {/* Purchase */}
            <button className="btn btn-primary big" onClick={handlePurchase}>
              🛒 Acheter pour {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
            </button>

            {/* Info */}
            <section className="card">
              <div className="note">
                Each pixel starts at €0.01 and doubles in price with every purchase.
              </div>
              <div className="next">Next price: {
                centsToEuroString((selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS) * 2)
              }</div>
            </section>

            {/* Stats */}
            <section className="card">
              <div className="card-title"><span className="dot teal" /> Grid Statistics</div>
              <div className="stats">
                <div className="stat">
                  <div className="stat-label">Pixels Owned</div>
                  <div className="stat-val">{purchasedCount}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Total Value</div>
                  <div className="stat-val">{centsToEuroString(totalValueCents)}</div>
                </div>
              </div>
              <div className="tiny2">
                Available Pixels: {TOTAL_PIXELS - purchasedCount}<br />
                Completion: {((purchasedCount / TOTAL_PIXELS) * 100).toFixed(6)}%
              </div>
            </section>
          </div>
        </aside>
      </main>

      {/* Styles — palette et animations fidèles aux captures */}
      <style jsx>{`
        :root{
          --bg:#0b1220;
          --bg-2:#0a0f16;
          --card:#1d242c;
          --card-2:#1a2027;
          --muted:#b7c4d3;
          --muted-2:#8fa3b9;
          --line:rgba(255,255,255,0.06);
          --white:#e6eef8;
          --cyan:#35c8ff;
          --teal:#36e0b3;
          --money:#3fe0b0;
          --orange-1:#ff7a45;
          --orange-2:#ff6a33;
          --orange-3:#ff824f;
          --shadow:0 20px 60px rgba(2,6,22,0.55);
          --radius:12px;
          --radius-lg:14px;
          --radius-sm:8px;
          --ring:0 0 0 2px rgba(53,200,255,0.15);
        }
        *{box-sizing:border-box}
        .page{
          min-height:100vh;
          background: linear-gradient(180deg,var(--bg-2) 0%, var(--bg) 100%);
          color:var(--white);
          font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial;
        }
        .hdr{
          position:fixed; inset:0 0 auto 0; height:64px;
          display:flex; align-items:center; padding:0 16px 0 20px; z-index:50;
          backdrop-filter: blur(8px);
          background: linear-gradient(180deg, rgba(10,12,16,0.86), rgba(10,12,16,0.76));
          border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .brand{display:flex; align-items:center; gap:14px}
        .logo{color:#19b7ff; text-decoration:none; font-weight:900; font-size:18px}
        .logo:hover{filter:brightness(1.1)}
        .muted{color:var(--muted); font-size:13px}
        .hdr-right{margin-left:auto; display:flex; gap:12px; align-items:center}
        .balance{font-size:14px; color:#cce9ff}
        .money{color:var(--money)}
        .icon-btn{
          width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;
          color:var(--white); text-decoration:none; background:rgba(255,255,255,0.04);
          border:1px solid var(--line); transition: all .22s ease;
        }
        .icon-btn:hover{transform:translateY(-1px); box-shadow:var(--shadow); background:rgba(255,255,255,0.06)}
        .btn{
          border:none; cursor:pointer; border-radius:10px; font-weight:800; padding:10px 14px;
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease, background-position .25s ease;
          background-size:200% 100%;
        }
        .btn-primary{
          background-image: linear-gradient(90deg, var(--orange-1), var(--orange-2));
          color:#081119; box-shadow: 0 10px 30px rgba(255,120,64,0.22);
        }
        .btn-primary:hover{
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow: 0 14px 40px rgba(255,120,64,0.32);
          background-position: 100% 0;
        }
        .btn-primary:active{transform: translateY(0); filter:saturate(0.98)}
        .btn.big{width:100%; padding:14px 16px; border-radius:12px; font-size:15px}
        .btn-ico{margin-right:8px}

        .main{
          padding-top:84px; display:flex; gap:18px; align-items:stretch;
          height:calc(100vh - 84px);
        }
        .stage-wrap{flex:1; display:flex; align-items:center; justify-content:center; padding:12px 24px}
        .stage{
          position:relative; width:100%; max-width:1280px; height:100%;
          border-radius:10px; overflow:hidden; box-shadow:var(--shadow); background:transparent;
          border:1px solid rgba(255,255,255,0.04);
        }
        .canvas{width:100%; height:100%; display:block; cursor:grab}
        .hud{
          position:absolute; left:14px; bottom:14px; background:rgba(0,0,0,0.6);
          padding:10px; border-radius:10px; color:#cfe5ff; border:1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(2px);
        }
        .zoom{display:flex; gap:8px; align-items:center}
        .icon-pad{
          width:36px;height:36px;border-radius:8px;border:1px solid var(--line);
          background:rgba(255,255,255,0.04); color:#fff; cursor:pointer;
          transition: transform .15s ease, box-shadow .2s ease, background .2s ease;
        }
        .icon-pad:hover{transform:translateY(-1px); box-shadow:var(--shadow); background:rgba(255,255,255,0.06)}
        .zoom-val{min-width:64px;text-align:center; font-weight:800}
        .hint{font-size:12px; opacity:.85; margin-top:8px}

        .sidebar{width:360px; padding:12px 18px}
        .sticky{position:sticky; top:84px; display:flex; flex-direction:column; gap:12px}

        .card{
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border:1px solid var(--line);
          border-radius:var(--radius); padding:16px; box-shadow: 0 6px 24px rgba(1,4,12,0.3);
        }
        .card:hover{box-shadow: 0 10px 34px rgba(1,4,12,0.4)}
        .card-title{
          font-weight:800; color:#cfe5ff; display:flex; align-items:center; gap:10px; margin-bottom:10px
        }
        .dot{width:10px;height:10px;border-radius:50%}
        .dot.cyan{background:#35c8ff}
        .dot.teal{background:#36e0b3}
        .pos{margin-left:auto; color:#7fa6d1; font-size:12px}

        .pixel-row{display:flex; gap:14px; align-items:center; margin-bottom:12px}
        .pixel-box{
          width:64px; height:64px; border-radius:10px; border:1px solid rgba(0,0,0,0.35);
          box-shadow: inset 0 0 0 2px rgba(255,255,255,0.06);
        }
        .pixel-info .muted{line-height:1.2}

        .price-block{
          background: #0e141b; border:1px solid var(--line); padding:12px; border-radius:10px;
        }
        .price{font-weight:900; font-size:28px; margin:6px 0; color:#23d0ff}
        .tiny{color:#8fb0cf; font-size:12px}
        .tiny2{color:#9bb6d4; font-size:13px; margin-top:8px}

        .color-input input[type="color"]{
          width:100%; height:40px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);
          background:#121922; padding:0; appearance:none;
          transition: box-shadow .2s ease, transform .2s ease;
        }
        .color-input input[type="color"]:hover{box-shadow:var(--ring); transform:translateY(-1px)}

        .swatches{display:flex; gap:8px; margin-top:10px; flex-wrap:wrap}
        .sw{
          width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,0.08);
          transition: transform .15s ease, box-shadow .2s ease;
        }
        .sw:hover{transform:translateY(-1px) scale(1.03); box-shadow:0 0 0 3px rgba(255,255,255,0.08)}

        .range-wrap{padding:4px 2px}
        .range-wrap input[type="range"]{
          -webkit-appearance:none; width:100%; height:4px; background:#0f1620; border-radius:999px;
          outline:none; border:1px solid var(--line);
        }
        .range-wrap input[type="range"]::-webkit-slider-thumb{
          -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:2px solid #10161f;
          box-shadow: 0 0 0 6px rgba(255,255,255,0.06), 0 6px 14px rgba(0,0,0,0.45);
          cursor:pointer; transition: transform .15s ease, box-shadow .2s ease;
        }
        .range-wrap input[type="range"]::-webkit-slider-thumb:hover{transform:scale(1.05)}
        .range-legend{display:flex; justify-content:space-between; color:#b9d1ea; font-size:12px; margin-top:6px}
        .badge{
          background:#0e141b; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:#d9f1ff;
          font-weight:700
        }

        .note{font-size:13px; color:#d3e7ff}
        .next{margin-top:8px; color:#bfe6ff}

        .stats{display:flex; gap:8px; margin-top:8px}
        .stat{flex:1; background:#0f1620; border:1px solid var(--line); padding:10px; border-radius:10px}
        .stat-label{font-size:12px; color:#b9d1ea}
        .stat-val{font-weight:800; font-size:22px}
      `}</style>
    </div>
  );
}


