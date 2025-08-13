// pages/game.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import ParticlesBackground from "../components/ParticlesBackground";

/**
 * Game page (Next.js)
 *
 * Features:
 * - 1000x1000 virtual grid rendered in a single canvas (sparse storage for purchased pixels)
 * - Zoom with wheel centered on mouse pointer (prevents page zoom)
 * - Pan with pointer drag
 * - Click to select pixel (hover preview + editor in fixed sidebar)
 * - UI (header, sidebar, HUD) fixed and not affected by canvas zoom/transform
 * - Hooks ready for backend integration (buyPixel, loadWindow, top-up via stripe)
 *
 * Important: backend endpoints used in this file are:
 * - GET /api/pixels/get?start=...&end=...
 * - POST /api/pixels/buy  { pixelIndex, color, intensity }
 * - POST /api/wallet/create-checkout-session { amountCents }
 *
 * This file is self-contained and client-safe (all window/canvas use is inside useEffect).
 */

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const STORAGE_KEY = "pixelgrid_local_demo_v1"; // optional local fallback
const INITIAL_PRICE_CENTS = 1; // 1 centime

function centsToEuroString(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function hexToUint32(hex) {
  return parseInt(hex.replace("#", ""), 16) >>> 0;
}
function uint32ToHex(n) {
  return "#" + (n >>> 0).toString(16).padStart(6, "0");
}

export default function Game() {
  // UI state
  const [isClient, setIsClient] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null); // index number
  const [pickerColor, setPickerColor] = useState("#ff3b30");
  const [intensity, setIntensity] = useState(30);
  const [balanceCents, setBalanceCents] = useState(0);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [loadingWindow, setLoadingWindow] = useState(false);

  // Canvas + world refs (mutable, avoid rerenders)
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const scaleRef = useRef(8); // px per pixel (initial)
  const offsetRef = useRef({ x: 0, y: 0 }); // top-left of grid in CSS px
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const hoverRef = useRef({ row: -1, col: -1 });
  const rafRef = useRef(null);

  // Sparse storage for purchased pixels (Map idx -> { c: '#rrggbb', exp: n })
  // We store in a ref to avoid re-render on every change
  const purchasedRef = useRef(new Map());

  // trigger UI update
  const [, tick] = useState(0);
  const triggerRender = useCallback(() => tick((n) => n + 1), []);

  // initial client-only setup
  useEffect(() => {
    setIsClient(true);

    // load from localStorage fallback (optional)
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

  // helper: persist purchases (debounced)
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

  // helper: compute price cents for current pixel (per-pixel exponent stored as exp; initial exp 0 => price 1 cent)
  const getPriceCents = useCallback((idx) => {
    const item = purchasedRef.current.get(idx);
    const exp = item ? item.exp : 0;
    return INITIAL_PRICE_CENTS * Math.pow(2, exp);
  }, []);

  // load visible window from backend (start .. end are indices)
  const loadWindow = useCallback(async (start = 0, end = 10000) => {
    setLoadingWindow(true);
    try {
      const res = await fetch(`/api/pixels/get?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to load window");
      const json = await res.json(); // format { idx: [color, intensity, buyCount] }
      // merge into purchasedRef
      const m = purchasedRef.current;
      for (const [k, v] of Object.entries(json)) {
        const idx = Number(k);
        // JSON shape: [color, intensity, buyCount]
        m.set(idx, { c: v[0], intensity: v[1], exp: (v[2] || 1) - 1 }); // buyCount->exp
      }
      purchasedRef.current = m;
      setPurchasedCount(m.size);
      persistLocal();
      triggerRender();
    } catch (e) {
      console.warn(e);
      // fallback: nothing
    } finally {
      setLoadingWindow(false);
    }
  }, [persistLocal, triggerRender]);

  // buy pixel: requests server; server handles wallet and atomic update
  const buyPixel = useCallback(async (idx, color, intensityVal) => {
    try {
      // call API
      const res = await fetch("/api/pixels/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelIndex: idx, color, intensity: intensityVal }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Purchase failed");
      }
      // update local map: server returned buyCountAfter or price
      // We'll increment exp locally (safe)
      const cur = purchasedRef.current.get(idx);
      const newExp = cur ? cur.exp + 1 : 1;
      purchasedRef.current.set(idx, { c: color, intensity: intensityVal, exp: newExp });
      setPurchasedCount(purchasedRef.current.size);
      persistLocal();
      triggerRender();
      // optionally update local balance via /api/me
      const me = await fetch("/api/me");
      if (me.ok) {
        const meJson = await me.json();
        setBalanceCents(meJson.balanceCents || 0);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [persistLocal, triggerRender]);

  // wallet top-up: create Stripe checkout session and redirect
  const addFunds = useCallback(async () => {
    const amount = prompt("Montant à ajouter en € (min 1):", "10");
    if (!amount) return;
    const amountFloat = parseFloat(amount);
    if (Number.isNaN(amountFloat) || amountFloat < 1) {
      alert("Montant invalide");
      return;
    }
    try {
      const res = await fetch("/api/wallet/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(amountFloat * 100) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Stripe session error");
      // redirect to Stripe checkout
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

    // resize backing store helper
    function resize() {
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

    // initialize center offset (center grid)
    function centerGrid() {
      const rect = canvas.getBoundingClientRect();
      const s = scaleRef.current;
      offsetRef.current.x = Math.round((rect.width - GRID_SIZE * s) / 2);
      offsetRef.current.y = Math.round((rect.height - GRID_SIZE * s) / 2);
    }
    resize();
    centerGrid();

    // draw
    function draw() {
      resize();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const s = scaleRef.current;
      const off = offsetRef.current;

      // background gradient
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#07102a");
      g.addColorStop(1, "#08162f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // visible range (grid coordinates)
      const startCol = Math.max(0, Math.floor((-off.x) / s));
      const startRow = Math.max(0, Math.floor((-off.y) / s));
      const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - off.x) / s));
      const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - off.y) / s));

      // subtle area for grid
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.01)";
      ctx.fillRect(off.x, off.y, GRID_SIZE * s, GRID_SIZE * s);
      ctx.restore();

      // draw visible cells; optimization: if s < 4 draw only purchased pixels
      const drawFull = s >= 4;

      const m = purchasedRef.current;
      if (!drawFull) {
        // draw only purchased pixels
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
        // draw all visible cells (purchased or not)
        for (let r = startRow; r <= endRow; r++) {
          const base = r * GRID_SIZE;
          for (let c = startCol; c <= endCol; c++) {
            const idx = base + c;
            const item = m.get(idx);
            const px = off.x + c * s;
            const py = off.y + r * s;
            if (!item) {
              // unpurchased subtle background
              ctx.fillStyle = "#ffffff";
              ctx.globalAlpha = 0.03;
              ctx.fillRect(px, py, s, s);
              ctx.globalAlpha = 1;
              // faint border
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

      // draw hover preview if inside grid
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

    // RAF loop
    function loop() {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // pointer/wheel handlers
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
      // treat as click if small movement
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
          // open sidebar
          setSidebarOpen(true);
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
      // only when pointer is over canvas (it is)
      e.preventDefault(); // prevent page zoom/scroll
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scaleRef.current;
      const delta = -e.deltaY;
      const zoomFactor = Math.exp(delta * 0.0016); // tuned
      let newScale = Math.min(64, Math.max(1.2, oldScale * zoomFactor));
      // keep world point under mouse stationary:
      const worldX = (mx - offsetRef.current.x) / oldScale;
      const worldY = (my - offsetRef.current.y) / oldScale;
      offsetRef.current.x = mx - worldX * newScale;
      offsetRef.current.y = my - worldY * newScale;
      scaleRef.current = newScale;
    }

    // attach listeners
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // resize
    const onResize = () => {
      // keep offsets as-is; resizing will update canvas backing store next loop
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

  // initial load once client ready
  useEffect(() => {
    if (!isClient) return;
    // preload a window near origin for demo: [0, 10k)
    loadWindow(0, 10000);
    // load user balance
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const me = await res.json();
          setBalanceCents(me.balanceCents || 0);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [isClient, loadWindow]);

  // UI handlers
  const handlePurchase = useCallback(async () => {
    if (selectedIdx == null) {
      alert("Sélectionne un pixel d'abord.");
      return;
    }
    const priceCents = getPriceCents(selectedIdx);
    if (!confirm(`Acheter le pixel #${selectedIdx} pour ${centsToEuroString(priceCents)} ?`)) return;
    const res = await buyPixel(selectedIdx, pickerColor, intensity);
    if (!res.ok) alert("Erreur d'achat : " + (res.error || "unknown"));
    else alert("Achat traité.");
  }, [selectedIdx, pickerColor, intensity, buyPixel, getPriceCents]);

  const handleAddFunds = useCallback(() => addFunds(), [addFunds]);

  // small helpers for HUD
  const hudZoomPercent = useMemo(() => Math.round(scaleRef.current * 100), [/* read on render */]);

  // UI layout: header fixed, sidebar fixed (right), canvas centered
  return (
    <div style={{ minHeight: "100vh", position: "relative", fontFamily: "Inter, system-ui, Arial, sans-serif", color: "#e6eef8" }}>
      {/* Background Particles (optional) */}
      <ParticlesBackground color="#60a5fa" density={36} />

      {/* Header (fixed) */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 64, display: "flex", alignItems: "center",
        padding: "0 18px", zIndex: 1200, background: "rgba(10,12,16,0.86)", borderBottom: "1px solid rgba(255,255,255,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#19b7ff" }}>▦ PixelGrid</div>
          <div style={{ color: "rgba(230,238,248,0.7)" }}>1,000,000 Pixels • {purchasedCount} Owned</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "rgba(200,230,255,0.95)" }}>Balance: <strong style={{ color: "#3fe0b0" }}>{centsToEuroString(balanceCents)}</strong></div>
          <button onClick={handleAddFunds} style={{
            background: "linear-gradient(90deg,#ff7a45,#ff6a33)", border: "none", padding: "8px 12px",
            borderRadius: 8, color: "#07102a", fontWeight: 800, cursor: "pointer"
          }}>Add Funds</button>
          <Link href="/auth/signin"><a style={{ display: "inline-block", width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center", lineHeight: "40px" }}>👤</a></Link>
        </div>
      </header>

      {/* Canvas container (centered) */}
      <main style={{ paddingTop: 84, paddingBottom: 24, display: "flex", gap: 18 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 84px)" }}>
          <div style={{ position: "relative", width: "calc(100% - 380px)", maxWidth: 1280, height: "72vh", borderRadius: 10, overflow: "hidden", background: "#000" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }} />
            {/* Zoom HUD bottom-left */}
            <div style={{
              position: "absolute", left: 12, bottom: 12, background: "rgba(0,0,0,0.6)", padding: "10px 12px",
              borderRadius: 10, color: "#cfe5ff", boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => { // zoom out small
                  const old = scaleRef.current; const newS = Math.max(1.2, old * 0.9); scaleRef.current = newS; triggerRender();
                }} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "none", color: "#fff" }}>🔍−</button>
                <div style={{ minWidth: 60, textAlign: "center" }}>{Math.round(scaleRef.current * 100)}%</div>
                <button onClick={() => { const old = scaleRef.current; const newS = Math.min(64, old * 1.1); scaleRef.current = newS; triggerRender(); }} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "none", color: "#fff" }}>🔍+</button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Click pixel to select</div>
            </div>
          </div>
        </div>

        {/* Sidebar fixed width */}
        <aside style={{ width: 360, paddingRight: 12, pointerEvents: "auto" }}>
          <div style={{ position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Price card */}
            <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))", padding: 16, borderRadius: 12 }}>
              <div style={{ color: "#9fc8ff", fontSize: 13 }}>Current Price</div>
              <div style={{ fontWeight: 900, fontSize: 28, marginTop: 6 }}>{centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}</div>
              <div style={{ color: "rgba(200,230,255,0.8)", fontSize: 12 }}>{selectedIdx != null ? (purchasedRef.current.get(selectedIdx)?.exp ?? 0) + " previous purchases" : "0 previous purchases"}</div>
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

            {/* Purchase button */}
            <button onClick={handlePurchase} style={{ background: "linear-gradient(90deg,#ff7a45,#ff6a33)", padding: "12px 14px", borderRadius: 10, border: "none", color: "#07102a", fontWeight: 900 }}>
               Purchase Pixel for {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) : INITIAL_PRICE_CENTS)}
            </button>

            {/* Info card */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12, color: "#cfe5ff" }}>
              <div style={{ fontSize: 13 }}>Each pixel starts at €0.01 and doubles in price every purchase.</div>
              <div style={{ marginTop: 8, color: "rgba(200,230,255,0.9)" }}>Next price: {centsToEuroString(selectedIdx != null ? getPriceCents(selectedIdx) * 2 : INITIAL_PRICE_CENTS * 2)}</div>
            </div>

            {/* Grid statistics */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 800, color: "#cfe5ff" }}>Grid Statistics</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(200,230,255,0.8)" }}>Pixels Owned</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{purchasedCount}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "rgba(200,230,255,0.8)" }}>Total Value</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{centsToEuroString(Array.from(purchasedRef.current.values()).reduce((acc, v) => {
                    const exp = v.exp || 0; return acc + INITIAL_PRICE_CENTS * Math.pow(2, exp);
                  }, 0))}</div>
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
