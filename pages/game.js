// pages/game.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';

/**
 * Client-only heavy canvas page for 1_000_000 pixels (1000x1000).
 * - No use of `window` / `document` at top-level → safe for SSR.
 * - All canvas / devicePixelRatio / event handling lives inside useEffect (client).
 * - Sparse storage: typed arrays in refs; persist non-default pixels to localStorage.
 *
 * How it works:
 * - Click small movement to select pixel (opens editor).
 * - Drag (hold mouse) to pan.
 * - Wheel to zoom (exponential), centered on cursor.
 * - Color picker previews live on hover & selection.
 * - Buy button updates typed arrays and persists (localStorage).
 */

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const STORAGE_KEY = 'mega_pixel_state_v3';
const INITIAL_PRICE_CENTS = 1;
const DEFAULT_COLOR_HEX = '#ffffff';
const DEFAULT_SCALE = 8;
const MIN_SCALE = 1.2;
const MAX_SCALE = 64;

function centsToEuroString(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
function hexToUint32(hex) {
  return parseInt((hex || '#000000').replace('#', ''), 16) >>> 0;
}
function uint32ToHex(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

export default function Game() {
  // refs for heavy mutable structures (keeps React renders minimal)
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(DEFAULT_SCALE);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const hoverRef = useRef({ row: -1, col: -1 });

  // typed arrays stored in refs: created on client inside effect
  const colorArrayRef = useRef(null); // Uint32Array
  const expArrayRef = useRef(null); // Uint8Array

  // UI state (React-driven)
  const [isClient, setIsClient] = useState(false); // used to avoid SSR use of canvas
  const [, setTick] = useState(0); // cheap re-render trigger
  const triggerRender = useCallback(() => setTick(n => n + 1), []);
  const [selected, setSelected] = useState(null); // { idx, row, col }
  const [pickerColor, setPickerColor] = useState('#7cc4ff');
  const [isBuying, setIsBuying] = useState(false);

  // buy request mechanism: used to request a buy from UI into effect-managed arrays
  const buyRequestRef = useRef({ id: 0, payload: null });
  const [buyRequestTick, setBuyRequestTick] = useState(0);
  const requestBuy = useCallback((payload) => {
    buyRequestRef.current.payload = payload;
    buyRequestRef.current.id++;
    setBuyRequestTick(buyRequestRef.current.id);
  }, []);

  // persist with debounce
  const persistTimer = useRef(null);
  const persistToStorage = useCallback(() => {
    if (!colorArrayRef.current || !expArrayRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        const out = {};
        const colors = colorArrayRef.current;
        const exps = expArrayRef.current;
        for (let i = 0; i < colors.length; i++) {
          if (exps[i] !== 0 || colors[i] !== 0) {
            out[i] = [uint32ToHex(colors[i] || 0), exps[i]];
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) {
        console.warn('Persist failed', e);
      }
    }, 250);
  }, []);

  // purchased count helper (scans arrays but triggered only on render request)
  const computePurchasedCount = useCallback(() => {
    const colors = colorArrayRef.current;
    const exps = expArrayRef.current;
    if (!colors || !exps) return 0;
    let c = 0;
    for (let i = 0; i < colors.length; i++) {
      if (colors[i] !== 0 || exps[i] !== 0) c++;
    }
    return c;
  }, []);

  const purchasedCount = useMemo(() => computePurchasedCount(), [/* updates via triggerRender */]);

  // ---- CLIENT-SIDE INITIALIZATION & RENDER LOOP ----
  useEffect(() => {
    // mark client
    setIsClient(true);

    // create typed arrays
    colorArrayRef.current = new Uint32Array(TOTAL_PIXELS);
    expArrayRef.current = new Uint8Array(TOTAL_PIXELS);

    // load persisted
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          const idx = Number(k);
          const [hex, exp] = v;
          colorArrayRef.current[idx] = hexToUint32(hex);
          expArrayRef.current[idx] = Math.min(30, Math.max(0, Number(exp) || 0));
        }
      }
    } catch (e) {
      console.warn('Load persisted error', e);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    dprRef.current = window.devicePixelRatio || 1;

    // helper: resize canvas backing store to CSS size * dpr
    function resizeCanvasToDisplaySize() {
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

    // center grid initially
    function centerGrid() {
      const rect = canvas.getBoundingClientRect();
      const s = scaleRef.current;
      offsetRef.current.x = Math.round((rect.width - GRID_SIZE * s) / 2);
      offsetRef.current.y = Math.round((rect.height - GRID_SIZE * s) / 2);
    }

    // initial center
    resizeCanvasToDisplaySize();
    centerGrid();

    // draw function
    function draw() {
      resizeCanvasToDisplaySize();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const s = scaleRef.current;
      const off = offsetRef.current;
      // clear + background
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#07102a');
      grad.addColorStop(1, '#08162f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // visible range
      const startCol = Math.max(0, Math.floor((-off.x) / s));
      const startRow = Math.max(0, Math.floor((-off.y) / s));
      const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - off.x) / s));
      const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - off.y) / s));

      // draw minor background for grid (subtle)
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.01)';
      ctx.fillRect(off.x, off.y, GRID_SIZE * s, GRID_SIZE * s);
      ctx.restore();

      const colors = colorArrayRef.current;
      const exps = expArrayRef.current;

      // choose whether to draw full visible grid or only purchased depending on scale
      const drawFull = s >= 4;

      if (!drawFull) {
        // draw only purchased pixels
        for (let idx = 0; idx < colors.length; idx++) {
          const c32 = colors[idx];
          const e = exps[idx];
          if (c32 === 0 && e === 0) continue;
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          if (col < startCol || col > endCol || row < startRow || row > endRow) continue;
          const px = Math.round(off.x + col * s);
          const py = Math.round(off.y + row * s);
          ctx.fillStyle = uint32ToHex(c32 || 0);
          ctx.fillRect(px, py, Math.ceil(s), Math.ceil(s));
        }
      } else {
        // draw each visible cell
        for (let r = startRow; r <= endRow; r++) {
          const base = r * GRID_SIZE;
          for (let c = startCol; c <= endCol; c++) {
            const idx = base + c;
            const c32 = colors[idx];
            const px = off.x + c * s;
            const py = off.y + r * s;
            if (c32 === 0 && exps[idx] === 0) {
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = 0.035;
              ctx.fillRect(px, py, s, s);
              ctx.globalAlpha = 1;
              ctx.strokeStyle = 'rgba(255,255,255,0.02)';
              ctx.lineWidth = 1;
              ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
            } else {
              ctx.fillStyle = uint32ToHex(c32 || 0);
              ctx.fillRect(px, py, s, s);
              ctx.strokeStyle = 'rgba(0,0,0,0.12)';
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
        ctx.strokeStyle = '#ffffff66';
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
        ctx.restore();
      }

      // grid lines when zoomed
      if (s >= 6) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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

    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // pointer logic
    function toGrid(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const s = scaleRef.current;
      const gx = (x - offsetRef.current.x) / s;
      const gy = (y - offsetRef.current.y) / s;
      return {
        row: Math.floor(gy),
        col: Math.floor(gx),
        localX: gx - Math.floor(gx),
        localY: gy - Math.floor(gy),
      };
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
          const exp = expArrayRef.current[idx];
          const colorVal = colorArrayRef.current[idx];
          const colorHex = colorVal ? uint32ToHex(colorVal) : DEFAULT_COLOR_HEX;
          setSelected({ idx, row: pos.row, col: pos.col, exp: exp || 0, colorHex });
          setPickerColor(colorHex);
        } else {
          setSelected(null);
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
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scaleRef.current;
      const delta = -e.deltaY;
      const zoomFactor = Math.exp(delta * 0.0016);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * zoomFactor));
      const worldX = (mx - offsetRef.current.x) / oldScale;
      const worldY = (my - offsetRef.current.y) / oldScale;
      offsetRef.current.x = mx - worldX * newScale;
      offsetRef.current.y = my - worldY * newScale;
      scaleRef.current = newScale;
      e.preventDefault();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // handle external buy requests (from UI)
    const buyChecker = setInterval(() => {
      const payload = buyRequestRef.current.payload;
      if (!payload) return;
      // payload: { idx, colorHex }
      const idx = payload.idx;
      const colorHex = payload.colorHex;
      // update arrays
      const prevExp = expArrayRef.current[idx] || 0;
      const nextExp = Math.min(30, prevExp + 1);
      expArrayRef.current[idx] = nextExp;
      colorArrayRef.current[idx] = hexToUint32(colorHex);
      buyRequestRef.current.payload = null;
      persistToStorage();
      triggerRender();
    }, 120);

    // resize observer to re-center on window resize
    function onResize() {
      resizeCanvasToDisplaySize();
      // keep current offset; optionally recenter if grid smaller than viewport
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      clearInterval(buyChecker);
    };
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // process buyRequest tick (UI -> effect sync): UI calls requestBuy which toggles buyRequestTick,
  // effect loop polls buyRequestRef, so we do not need an effect here. But we still allow immediate feedback:
  useEffect(() => {
    // used to trigger HUD updates after buys (persist handled in effect)
    triggerRender();
  }, [buyRequestTick, triggerRender]);

  // UI handler: purchase selected pixel (requests the effect to apply)
  const buySelected = useCallback(async () => {
    if (!selected) return;
    setIsBuying(true);
    // queue payload for effect to process (which updates arrays & persists)
    requestBuy({ idx: selected.idx, colorHex: pickerColor });
    // small UX delay
    await new Promise((r) => setTimeout(r, 180));
    setIsBuying(false);
    setSelected(null);
  }, [selected, pickerColor, requestBuy]);

  const resetAll = useCallback(() => {
    if (!confirm('Réinitialiser tous les pixels achetés ?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      // reset arrays (must be done client-side: reinitialize and reload page)
      if (colorArrayRef.current && expArrayRef.current) {
        colorArrayRef.current.fill(0);
        expArrayRef.current.fill(0);
      }
      // reload to reinit
      location.reload();
    } catch (e) {
      console.warn(e);
      location.reload();
    }
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    expArrayRef.current[selected.idx] = 0;
    colorArrayRef.current[selected.idx] = 0;
    persistToStorage();
    triggerRender();
    setSelected(null);
  }, [selected, persistToStorage, triggerRender]);

  // selected price display
  const selectedPriceDisplay = useMemo(() => {
    if (!selected) return centsToEuroString(INITIAL_PRICE_CENTS);
    const exp = expArrayRef.current[selected.idx] || 0;
    return centsToEuroString(INITIAL_PRICE_CENTS * (2 ** exp));
  }, [selected]);

  // render
  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      {/* ParticlesBackground is safe (it runs its canvas in useEffect) */}
      <ParticlesBackground color="#60a5fa" density={36} />

      {/* Nav */}
      <nav style={{
        position: 'absolute', left: 12, top: 12, right: 12, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', zIndex: 70, pointerEvents: 'auto'
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/"><a style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.04)',
            padding: '8px 12px',
            borderRadius: 10,
            color: '#e8f3ff',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 8px 20px rgba(2,6,22,0.5)'
          }}>Accueil</a></Link>
          <button onClick={resetAll} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#dfefff',
            padding: '6px 10px', borderRadius: 8, cursor: 'pointer'
          }}>Réinitialiser</button>
        </div>

        <div style={{ color: '#bcdcff', fontWeight: 600, fontSize: 13 }}>
          <span style={{ marginRight: 12 }}>Pixels achetés : {purchasedCount.toLocaleString()}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {Math.round((purchasedCount / TOTAL_PIXELS) * 10000) / 100}%
          </span>
        </div>
      </nav>

      {/* Title */}
      <header style={{
        position: 'absolute', top: 72, left: 0, right: 0, textAlign: 'center', zIndex: 70, pointerEvents: 'none'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 36,
          fontWeight: 900,
          color: '#e8f3ff',
          textShadow: '0 8px 36px rgba(76,154,255,0.10), 0 0 28px rgba(124,196,255,0.06)'
        }}>Mega Pixel Market — 1 000 × 1 000</h1>
        <p style={{ marginTop: 6, marginBottom: 0, color: 'rgba(223,239,255,0.9)' }}>
          Chaque pixel commence à <strong>{centsToEuroString(INITIAL_PRICE_CENTS)}</strong>. Le prix double à chaque achat.
        </p>
      </header>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)', width: 520, zIndex: 70
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cfe5ff', fontWeight: 700, fontSize: 13 }}>
          <div>{purchasedCount.toLocaleString()} / {TOTAL_PIXELS.toLocaleString()} achetés</div>
          <div>{Math.round((purchasedCount / TOTAL_PIXELS) * 10000) / 100}%</div>
        </div>
        <div style={{
          height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 999, marginTop: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 6px rgba(2,6,22,0.5)'
        }}>
          <div style={{
            height: '100%',
            width: `${(purchasedCount / TOTAL_PIXELS) * 100}%`,
            background: 'linear-gradient(90deg,#7cc4ff,#4285f4)',
            transition: 'width 420ms ease'
          }} />
        </div>
      </div>

      {/* Canvas */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40, pointerEvents: 'auto'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '92vw',
            height: '72vh',
            maxWidth: '1600px',
            maxHeight: '1000px',
            borderRadius: 12,
            boxShadow: '0 40px 120px rgba(2,6,22,0.7)',
            background: 'transparent',
            touchAction: 'none'
          }}
        />
      </div>

      {/* Editor panel */}
      <aside style={{
        position: 'absolute', right: 18, top: '36%', transform: 'translateY(-36%)', zIndex: 80,
        width: 320, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        borderRadius: 12, padding: 14, boxShadow: '0 12px 36px rgba(2,6,22,0.6)', pointerEvents: 'auto'
      }}>
        {selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e8f3ff' }}>Pixel #{selected.row},{selected.col}</div>
                <div style={{ fontSize: 12, color: '#cfe5ff', marginTop: 4 }}>
                  Prix actuel : <strong>{selectedPriceDisplay}</strong>
                </div>
              </div>
              <div>
                <div style={{
                  width: 48, height: 48, borderRadius: 8, background: pickerColor,
                  boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.25)'
                }} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, color: '#9fc8ff', display: 'block', marginBottom: 6 }}>Couleur (aperçu)</label>
              <input
                type="color"
                value={pickerColor}
                onChange={(e) => setPickerColor(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 8, border: 'none', padding: 4, cursor: 'pointer' }}
              />
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={buySelected} disabled={isBuying} style={{
                flex: 1, padding: '12px 10px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#f5c27a,#7cc4ff)', color: '#07102a', fontWeight: 900, fontSize: 15, cursor: 'pointer'
              }}>
                {isBuying ? 'Achat...' : `Acheter (${selectedPriceDisplay})`}
              </button>
              <button onClick={() => setSelected(null)} style={{
                padding: '10px 12px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#dfefff'
              }}>Fermer</button>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={deleteSelected} style={{
                flex: 1, padding: '8px 10px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,80,80,0.15)', color: '#ffb3b3'
              }}>Supprimer (dev)</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, color: '#e8f3ff', fontSize: 15 }}>Sélection</div>
            <div style={{ marginTop: 8, color: '#cfe5ff', fontSize: 13 }}>
              Clique sur la grille pour sélectionner un pixel. Pan : cliquer + glisser. Zoom : molette (centré sur pointeur).
            </div>
          </>
        )}
      </aside>

      {/* Legend bottom-left */}
      <div style={{ position: 'absolute', left: 18, bottom: 18, zIndex: 70, color: '#bcdcff' }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Aides</div>
        <div style={{ fontSize: 13 }}>• Zoom : molette — centré sur le curseur</div>
        <div style={{ fontSize: 13 }}>• Pan : clic + glisser</div>
        <div style={{ fontSize: 13 }}>• Sélection : clic (petit mouvement)</div>
      </div>
    </div>
  );
}




