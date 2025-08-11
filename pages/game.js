// pages/game.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';

/**
 * pages/game.js
 * Canvas-based optimized implementation for 1_000_000 pixels (1000x1000).
 *
 * Storage:
 * - colorArray: Uint32Array length = GRID_SIZE*GRID_SIZE, stores 0 for default (white) or 0xRRGGBB value.
 * - expArray: Uint8Array length = GRID_SIZE*GRID_SIZE, stores exponent n where price = INITIAL_PRICE_CENTS * (2^n).
 *
 * Persistence:
 * - Only modified pixels (non-default) are saved to localStorage as a compact object { idx: [hex, exp], ... }.
 *
 * Interaction:
 * - Wheel: zoom (exponential) centered on cursor
 * - Drag (left mouse): pan
 * - Click (small movement): select pixel -> open editor
 * - Hover: highlight pixel under cursor, show live preview color if color picker chosen
 */

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const STORAGE_KEY = 'mega_pixel_state_v2';
const INITIAL_PRICE_CENTS = 1; // 1 centime = 0.01€
const DEFAULT_COLOR_HEX = '#ffffff'; // visual default

const MIN_SCALE = 1.2;   // px per pixel (very zoomed out)
const MAX_SCALE = 64;    // px per pixel (very zoomed in)
const DEFAULT_SCALE = 8; // starting pixel size (px)

function centsToEuroString(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
function hexToUint32(hex) {
  if (!hex) return 0;
  return parseInt(hex.replace('#', ''), 16) >>> 0;
}
function uint32ToHex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

export default function Game() {
  // refs for heavy mutable state (avoid re-render)
  const canvasRef = useRef(null);
  const dprRef = useRef(window.devicePixelRatio || 1);
  const offsetRef = useRef({ x: 0, y: 0 }); // top-left of grid in CSS px
  const scaleRef = useRef(DEFAULT_SCALE); // px per pixel
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const hoverRef = useRef({ row: -1, col: -1 });
  const tickingRef = useRef(false);

  // typed arrays stored in refs to avoid re-allocations
  const colorArrayRef = useRef(null); // Uint32Array
  const expArrayRef = useRef(null); // Uint8Array

  // UI state (keeps only UI bits that need React rendering)
  const [, setTick] = useState(0); // cheap rerender trigger
  const triggerRender = useCallback(() => setTick(n => n + 1), []);

  const [selected, setSelected] = useState(null); // { idx, row, col, exp, colorHex }
  const [pickerColor, setPickerColor] = useState('#7cc4ff'); // hex color from <input type="color">
  const [isBuying, setIsBuying] = useState(false);

  // initialize typed arrays and load persisted state
  useEffect(() => {
    colorArrayRef.current = new Uint32Array(TOTAL_PIXELS);
    expArrayRef.current = new Uint8Array(TOTAL_PIXELS); // default 0 exponent => price INITIAL_PRICE_CENTS
    // load persisted (compact)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw); // { idx: [hex, exp], ... }
        for (const [k, v] of Object.entries(parsed)) {
          const idx = Number(k);
          const [hex, exp] = v;
          colorArrayRef.current[idx] = hexToUint32(hex);
          expArrayRef.current[idx] = Math.min(30, Math.max(0, Number(exp) || 0)); // clamp exponent
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted pixel state', e);
    }
    triggerRender();
    // center grid in canvas after mount (in layout effect would be better, but this works)
    setTimeout(() => {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const s = scaleRef.current;
      // center grid area
      offsetRef.current.x = Math.round((rect.width - GRID_SIZE * s) / 2);
      offsetRef.current.y = Math.round((rect.height - GRID_SIZE * s) / 2);
      triggerRender();
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist changes with debounce (only modified pixels)
  const persistTimerRef = useRef(null);
  const persist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        // build compact object of non-default pixels
        const out = {};
        const colors = colorArrayRef.current;
        const exps = expArrayRef.current;
        for (let i = 0; i < TOTAL_PIXELS; i++) {
          if (exps[i] !== 0 || colors[i] !== 0) {
            out[i] = [uint32ToHex(colors[i] || 0), exps[i]];
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) {
        console.warn('Failed to persist pixel state', e);
      }
    }, 300);
  }, []);

  // compute purchased count quickly (scan expArray for non-zero OR color != 0)
  const getPurchasedCount = useCallback(() => {
    const exps = expArrayRef.current;
    const colors = colorArrayRef.current;
    let c = 0;
    for (let i = 0; i < exps.length; i++) {
      if (exps[i] !== 0 || colors[i] !== 0) c++;
    }
    return c;
  }, []);

  // drawing routine
  const drawRef = useRef(null);
  drawRef.current = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = dprRef.current = window.devicePixelRatio || 1;
    // resize backing store
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // clear
    ctx.clearRect(0, 0, w, h);

    // background gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#07102a');
    g.addColorStop(1, '#08162f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const s = scaleRef.current;
    const off = offsetRef.current;

    // quick visible range in grid coordinates
    const startCol = Math.max(0, Math.floor((-off.x) / s));
    const startRow = Math.max(0, Math.floor((-off.y) / s));
    const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - off.x) / s));
    const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - off.y) / s));

    // If zoomed out very far (s small), drawing every cell is heavy.
    // Strategy:
    // - if s < 4 px: draw only purchased pixels as colored rects; don't draw individual empty cells.
    // - if s >= 4 px: draw visible cell-by-cell for nicer visuals (grid lines, shadows).
    const drawFullGrid = s >= 4;

    // draw grid background area (clipped)
    const gridX = off.x;
    const gridY = off.y;
    const gridW = GRID_SIZE * s;
    const gridH = GRID_SIZE * s;
    // subtle border
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    // draw grid area (clipped)
    ctx.fillRect(gridX, gridY, gridW, gridH);
    ctx.restore();

    // draw purchased pixels (iterate entire typed arrays but skip invisible ones)
    const colors = colorArrayRef.current;
    const exps = expArrayRef.current;
    // Loop over purchased only: scanning all 1M every frame is heavy; but we optimize:
    // If purchased count is low (< ~5000), iterate over all and check; otherwise, iterate over visible range.
    // We approximate purchased count from scanning small sample? Simpler: estimate purchases by counting changed entries in localStorage parse would be heavy.
    // Practical approach: if s is small (zoomed out) we only draw purchased pixels by scanning full arrays but with simple checks.
    let purchasedCount = 0;
    // count could be expensive; we avoid full count each frame by calculating a partial count on demand when HUD requests it.

    if (!drawFullGrid) {
      // draw only purchased pixels (sparse-looking)
      // iterate in chunks to avoid blocking too long (but here single-threaded)
      for (let idx = 0; idx < colors.length; idx++) {
        const col = idx % GRID_SIZE;
        const row = Math.floor(idx / GRID_SIZE);
        const c32 = colors[idx];
        const e = exps[idx];
        if (c32 === 0 && e === 0) continue;
        // check visible
        if (col < startCol || col > endCol || row < startRow || row > endRow) continue;
        const px = Math.round(off.x + col * s);
        const py = Math.round(off.y + row * s);
        // fill pixel
        ctx.fillStyle = uint32ToHex(c32 || 0);
        ctx.fillRect(px, py, Math.ceil(s), Math.ceil(s));
      }
    } else {
      // draw every visible cell (grid)
      // draw background cells (unpurchased) as subtle squares (light)
      for (let r = startRow; r <= endRow; r++) {
        const base = r * GRID_SIZE;
        for (let c = startCol; c <= endCol; c++) {
          const idx = base + c;
          const px = off.x + c * s;
          const py = off.y + r * s;
          const c32 = colors[idx];
          if (c32 === 0 && expArrayRef.current[idx] === 0) {
            // unpurchased
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.035;
            ctx.fillRect(px, py, s, s);
            ctx.globalAlpha = 1;
            // border subtle
            ctx.strokeStyle = 'rgba(255,255,255,0.02)';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
          } else {
            ctx.fillStyle = uint32ToHex(c32 || 0);
            ctx.fillRect(px, py, s, s);
            // border for purchased
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = Math.max(1, s * 0.06);
            ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
          }
        }
      }
    }

    // hover highlight & live preview
    const hv = hoverRef.current;
    if (hv && hv.row >= 0 && hv.col >= 0 && hv.row < GRID_SIZE && hv.col < GRID_SIZE) {
      const px = off.x + hv.col * s;
      const py = off.y + hv.row * s;
      // Draw preview: if there's a pickerColor, show it translucent
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

    // draw faint grid lines only when zoomed enough
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

    // draw subtle frame or overlay (optional)
    // done
  }, []);

  // animation loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // pointer/interaction handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      // treat as click if movement small
      const dx = Math.abs(e.clientX - last.x);
      const dy = Math.abs(e.clientY - last.y);
      const dt = Date.now() - last.time;
      if (dx < 6 && dy < 6 && dt < 400) {
        // click -> select pixel
        const pos = toGrid(e.clientX, e.clientY);
        if (pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE) {
          const idx = pos.row * GRID_SIZE + pos.col;
          const exp = expArrayRef.current[idx];
          const colorVal = colorArrayRef.current[idx];
          const colorHex = colorVal ? uint32ToHex(colorVal) : DEFAULT_COLOR_HEX;
          setSelected({ idx, row: pos.row, col: pos.col, exp: exp || 0, colorHex });
          setPickerColor(colorHex);
        } else {
          // clicked outside grid -> close panel
          setSelected(null);
        }
      }
    }
    function onPointerMove(e) {
      if (draggingRef.current && (e.buttons & 1)) {
        // pan
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
        // request render (we're in RAF loop so it's fine)
      } else {
        // hover update
        const pos = toGrid(e.clientX, e.clientY);
        if (pos.row !== hoverRef.current.row || pos.col !== hoverRef.current.col) {
          hoverRef.current.row = pos.row;
          hoverRef.current.col = pos.col;
        }
      }
    }

    function onWheel(e) {
      // zoom centered on cursor
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scaleRef.current;
      // exponential zoom factor
      const delta = -e.deltaY; // positive -> zoom in
      const zoomFactor = Math.exp(delta * 0.0016); // tweak for feeling
      let newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * zoomFactor));
      // keep world point under mouse stationary:
      const worldX = (mx - offsetRef.current.x) / oldScale;
      const worldY = (my - offsetRef.current.y) / oldScale;
      offsetRef.current.x = mx - worldX * newScale;
      offsetRef.current.y = my - worldY * newScale;
      scaleRef.current = newScale;
      // small re-render
      e.preventDefault();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // buy logic
  const buySelected = useCallback(async () => {
    if (!selected) return;
    setIsBuying(true);
    // simulate a small delay for UX
    await new Promise(r => setTimeout(r, 160));
    const idx = selected.idx;
    const currentExp = expArrayRef.current[idx] || 0;
    const nextExp = Math.min(30, currentExp + 1); // clamp exponent to avoid absurd values
    expArrayRef.current[idx] = nextExp;
    colorArrayRef.current[idx] = hexToUint32(pickerColor);
    persist();
    triggerRender();
    setIsBuying(false);
    setSelected(null);
  }, [selected, pickerColor, persist, triggerRender]);

  // delete pixel (for testing)
  const deleteSelected = useCallback(() => {
    if (!selected) return;
    const idx = selected.idx;
    expArrayRef.current[idx] = 0;
    colorArrayRef.current[idx] = 0;
    persist();
    triggerRender();
    setSelected(null);
  }, [selected, persist, triggerRender]);

  // computed HUD values (lightweight)
  const purchasedCount = useMemo(() => {
    // to avoid scanning 1M on every render, compute only when requested via triggerRender
    return getPurchasedCount();
  }, [getPurchasedCount, /* triggered by setTick */]);

  const percentSold = Math.round((purchasedCount / TOTAL_PIXELS) * 10000) / 100;

  // UI: price display for selected
  const selectedPriceDisplay = useMemo(() => {
    if (!selected) return centsToEuroString(INITIAL_PRICE_CENTS);
    const idx = selected.idx;
    const exp = expArrayRef.current[idx] || 0;
    const priceCents = INITIAL_PRICE_CENTS * (2 ** exp);
    return centsToEuroString(priceCents);
  }, [selected]);

  // small helpers for CSS in JS UI
  const hudStyle = {
    position: 'absolute', left: 20, top: 20, zIndex: 60, color: '#d8eeff', fontWeight: 700
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
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
          <button onClick={() => { if (confirm('Réinitialiser tout ?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); } }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#dfefff',
            padding: '6px 10px', borderRadius: 8, cursor: 'pointer'
          }}>Réinitialiser</button>
        </div>

        <div style={{ color: '#bcdcff', fontWeight: 600, fontSize: 13 }}>
          <span style={{ marginRight: 12 }}>Pixels achetés : {purchasedCount.toLocaleString()}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{percentSold}%</span>
        </div>
      </nav>

      {/* Title center */}
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
          <div>{percentSold}%</div>
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

      {/* Canvas center */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40, pointerEvents: 'auto'
      }}>
        <canvas ref={canvasRef} style={{
          width: '92vw', height: '72vh', maxWidth: '1600px', maxHeight: '1000px',
          borderRadius: 12, boxShadow: '0 40px 120px rgba(2,6,22,0.7)', background: 'transparent', touchAction: 'none'
        }} />
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
                  Prix actuel : <strong>
                    {centsToEuroString(INITIAL_PRICE_CENTS * (2 ** (expArrayRef.current[selected.idx] || 0)))}
                  </strong>
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



