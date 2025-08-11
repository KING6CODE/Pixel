// pages/game.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';

/**
 * Game page - Canvas-based 1_000_000 pixels (1000x1000).
 *
 * Key ideas:
 * - The complete grid is 1000x1000 (1_000_000 pixels). We do NOT create DOM nodes for every pixel.
 * - Only purchased pixels are persisted in a Map (sparse storage) and in localStorage.
 * - Canvas draws only the visible rectangle of pixels for high performance.
 * - Zoom with mouse wheel (over canvas) centered on mouse. Drag to pan.
 * - Click a pixel to open the editor panel (color picker + buy). Preview is live.
 * - Prices are stored in cents (integer). Initial price = 1 (cent) => 0.01€.
 */

const GRID_SIZE = 1000;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const STORAGE_KEY = 'pixel_canvas_state_v1';
const INITIAL_PRICE_CENTS = 1; // 1 centime
const MIN_SCALE = 2 / 16; // minimum pixel size in CSS px (very zoomed out)
const MAX_SCALE = 64; // max pixel size in CSS px (very zoomed in)
const DEFAULT_SCALE = 8; // initial pixelsize (CSS px per pixel)

function centsToEuroString(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function Game() {
  // canvas refs
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // viewport / world transform (offset in pixels, scale = pixelsize)
  const [scale, setScale] = useState(DEFAULT_SCALE); // CSS px per pixel
  const offsetRef = useRef({ x: 0, y: 0 }); // top-left offset in CSS px

  // interaction states
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const [isPointerDown, setIsPointerDown] = useState(false);

  // purchased pixels map: key = index (row*GRID_SIZE + col) => { color: '#rrggbb', price: nextPriceCents }
  const purchasedRef = useRef(new Map());

  // editor UI state
  const [selected, setSelected] = useState(null); // { idx, row, col, currentPriceCents, color }
  const [pickerColor, setPickerColor] = useState('#7cc4ff'); // hex preview color
  const [previewHSL, setPreviewHSL] = useState(null); // optional HSL representation

  // stats derived
  const purchasedCount = useMemo(() => purchasedRef.current.size, [/* intentionally empty, will update via effect*/]);

  // we need a small state trigger to re-render HUD when purchases change
  const [, tick] = useState(0);
  const triggerRender = useCallback(() => { tick(n => n + 1); }, []);

  // load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        // obj is expected as { "<idx>": { c: "#rrggbb", p: priceCents }, ... }
        const m = new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
        purchasedRef.current = m;
        triggerRender();
      }
    } catch (e) {
      console.warn('Could not load pixel state', e);
    }
  }, [triggerRender]);

  // persist to localStorage on change (debounced simple)
  const persistTimer = useRef(null);
  const persist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        // convert Map to plain object
        const obj = Object.fromEntries(
          Array.from(purchasedRef.current.entries()).map(([k, v]) => [String(k), v])
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch (e) {
        console.warn('Failed to persist', e);
      }
    }, 300);
  }, []);

  // canvas drawing
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // background subtle texture / gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#07102a');
    g.addColorStop(1, '#0b1633');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const offset = offsetRef.current;
    const s = scale;

    // draw grid background box with subtle shadow
    const gridPixelSize = s;
    // determine visible cell range
    const startCol = Math.max(0, Math.floor((-offset.x) / gridPixelSize));
    const startRow = Math.max(0, Math.floor((-offset.y) / gridPixelSize));
    const endCol = Math.min(GRID_SIZE - 1, Math.ceil((w - offset.x) / gridPixelSize));
    const endRow = Math.min(GRID_SIZE - 1, Math.ceil((h - offset.y) / gridPixelSize));

    // optional: draw faint grid area frame
    // fill area for clarity
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    const gx = offset.x + 0;
    const gy = offset.y + 0;
    const gw = GRID_SIZE * gridPixelSize;
    const gh = GRID_SIZE * gridPixelSize;
    // draw a subtle rounded rect background for the grid (only if visible)
    if (gx < w && gy < h && gx + gw > 0 && gy + gh > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(8,18,36,0.4)';
      // large rect (clipped to canvas)
      ctx.fillRect(gx, gy, Math.min(gw, w - gx), Math.min(gh, h - gy));
      ctx.restore();
    }

    // draw purchased pixels inside visible range
    // We'll iterate purchased map keys within visible region for efficiency if many purchases exist.
    // But Map isn't indexed; however purchased count is likely small relative to 1M.
    // We'll draw in two passes:
    // 1) Draw purchased pixels by iterating Map entries and checking visibility
    // 2) Draw grid lines / unpurchased block optionally (but we avoid per-cell draw of unpurchased ones)

    // Draw purchased pixels:
    purchasedRef.current.forEach((v, k) => {
      const row = Math.floor(k / GRID_SIZE);
      const col = k % GRID_SIZE;
      if (col < startCol || col > endCol || row < startRow || row > endRow) return;
      const px = offset.x + col * gridPixelSize;
      const py = offset.y + row * gridPixelSize;
      // draw pixel square
      ctx.fillStyle = v.c || '#ffffff';
      ctx.fillRect(px, py, gridPixelSize, gridPixelSize);
      // border for better contrast
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = Math.max(1, gridPixelSize * 0.06);
      ctx.strokeRect(px + 0.5, py + 0.5, gridPixelSize - 1, gridPixelSize - 1);
    });

    // If scale is large enough, draw small price text or placeholder for unpurchased pixels? We'll draw price only for pixels within selected vicinity.
    // Draw highlighted preview for selected pixel (live preview)
    if (selected) {
      const { row, col } = selected;
      const px = offset.x + col * gridPixelSize;
      const py = offset.y + row * gridPixelSize;
      // draw preview fill with slight alpha and border
      ctx.fillStyle = pickerColor;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(px, py, gridPixelSize, gridPixelSize);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = Math.max(1, gridPixelSize * 0.08);
      ctx.strokeRect(px + 0.5, py + 0.5, gridPixelSize - 1, gridPixelSize - 1);
    }

    // optionally draw faint grid lines if zoomed enough
    if (gridPixelSize >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      // verticals
      const fromCol = Math.max(0, startCol);
      const toCol = Math.min(GRID_SIZE, endCol + 1);
      ctx.beginPath();
      for (let c = fromCol; c <= toCol; c++) {
        const x = Math.round(offset.x + c * gridPixelSize) + 0.5;
        ctx.moveTo(x, Math.max(0, offset.y + startRow * gridPixelSize));
        ctx.lineTo(x, Math.min(h, offset.y + (endRow + 1) * gridPixelSize));
      }
      // horizontals
      const fromRow = Math.max(0, startRow);
      const toRow = Math.min(GRID_SIZE, endRow + 1);
      for (let r = fromRow; r <= toRow; r++) {
        const y = Math.round(offset.y + r * gridPixelSize) + 0.5;
        ctx.moveTo(Math.max(0, offset.x + startCol * gridPixelSize), y);
        ctx.lineTo(Math.min(w, offset.x + (endCol + 1) * gridPixelSize), y);
      }
      ctx.stroke();
    }

    // If zoomed in sufficiently, show price text for visible purchased pixels or hovered pixel
    if (gridPixelSize >= 10) {
      ctx.font = `${Math.max(10, Math.round(gridPixelSize * 0.28))}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      purchasedRef.current.forEach((v, k) => {
        const row = Math.floor(k / GRID_SIZE);
        const col = k % GRID_SIZE;
        if (col < startCol || col > endCol || row < startRow || row > endRow) return;
        const px = offset.x + col * gridPixelSize + gridPixelSize / 2;
        const py = offset.y + row * gridPixelSize + gridPixelSize / 2;
        ctx.fillStyle = 'rgba(10,10,10,0.9)';
        ctx.fillText((v.p / 100).toFixed(2) + '€', px + 0.6, py + 0.6);
      });
    }

    // request next frame if needed
    // Note: we'll call draw via rAF loop (rafRef)
  }, [scale, selected, pickerColor]);

  // animation loop (keeps canvas responsive)
  useEffect(() => {
    const render = () => {
      draw();
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Helpers: convert screen coords to grid col/row
  const screenToGrid = useCallback((sx, sy) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = sx - rect.left;
    const y = sy - rect.top;
    const gridX = (x - offsetRef.current.x) / scale;
    const gridY = (y - offsetRef.current.y) / scale;
    const col = Math.floor(gridX);
    const row = Math.floor(gridY);
    return { row, col, localX: gridX - col, localY: gridY - row };
  }, [scale]);

  // pointer handlers for panning & selecting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onPointerDown(e) {
      // left button: start drag (pan)
      if (e.button === 0) {
        draggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setIsPointerDown(true);
      }
      // prevent default to keep pointer capture consistent
      canvas.setPointerCapture?.(e.pointerId);
    }

    function onPointerUp(e) {
      if (draggingRef.current) {
        draggingRef.current = false;
        setIsPointerDown(false);
        // small movement -> interpret as click (select pixel)
        const dx = Math.abs(e.clientX - lastMouseRef.current.x);
        const dy = Math.abs(e.clientY - lastMouseRef.current.y);
        if (dx < 6 && dy < 6) {
          const { row, col } = screenToGrid(e.clientX, e.clientY);
          if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
            const idx = row * GRID_SIZE + col;
            // open editor for this pixel
            const existing = purchasedRef.current.get(idx);
            const curPrice = existing ? existing.p : INITIAL_PRICE_CENTS;
            const curColor = existing ? existing.c : '#ffffff';
            setSelected({ idx, row, col, curPrice, curColor });
            setPickerColor(existing ? existing.c : '#ffffff');
            // show preview HSL optional (not used further)
          } else {
            // clicked outside grid -> close panel
            setSelected(null);
          }
        }
      }
      canvas.releasePointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      offsetRef.current.x += dx;
      offsetRef.current.y += dy;
      // small bounds to allow scrolling beyond edges slightly
      // no hard clamp so you can pan out
    }

    // wheel for zoom (centered on mouse)
    function onWheel(e) {
      // if user holds Shift we pan horizontally perhaps; but primary: zoom with wheel
      // We'll use wheel to zoom when AltKey OR CtrlKey OR MetaKey OR when over canvas
      // To match user request "zoom with molette", we zoom whenever the pointer is over the canvas.
      const rect = canvas.getBoundingClientRect();
      const isOver = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!isOver) return;
      e.preventDefault();

      const wheel = -e.deltaY; // positive = zoom in
      const zoomFactor = Math.exp(wheel * 0.0015); // smooth scaling
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));

      // mouse position in canvas coords
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // world coord before zoom
      const worldX = (mx - offsetRef.current.x) / scale;
      const worldY = (my - offsetRef.current.y) / scale;

      // update scale then adjust offset so that worldX/worldY remains under mouse
      offsetRef.current.x = mx - worldX * newScale;
      offsetRef.current.y = my - worldY * newScale;
      setScale(newScale);
    }

    // attach events
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
  }, [scale, screenToGrid]);

  // handle buying a pixel
  const buySelected = useCallback(() => {
    if (!selected) return;
    const idx = selected.idx;
    const existing = purchasedRef.current.get(idx);
    const currentPrice = existing ? existing.p : INITIAL_PRICE_CENTS;
    // Simulate payment (no backend) => the buyer pays currentPrice
    // After purchase, the pixel color becomes chosen color and the next price doubles
    const nextPrice = currentPrice * 2;
    purchasedRef.current.set(idx, { c: pickerColor, p: nextPrice });
    persist();
    triggerRender();
    // close editor
    setSelected(null);
  }, [selected, pickerColor, persist, triggerRender]);

  // cancel editor
  const cancelSelected = useCallback(() => {
    setSelected(null);
  }, []);

  // quick reset (dangerous)
  const resetAll = useCallback(() => {
    if (!confirm('Tout supprimer ? Réinitialiser tous les pixels achetés (permanent) ?')) return;
    purchasedRef.current.clear();
    persist();
    triggerRender();
  }, [persist, triggerRender]);

  // ensure initial offset centers the grid on first render
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    function center() {
      const rect = c.getBoundingClientRect();
      // center grid in canvas initially
      const gridPixelSize = scale;
      offsetRef.current.x = Math.round((rect.width - GRID_SIZE * gridPixelSize) / 2);
      offsetRef.current.y = Math.round((rect.height - GRID_SIZE * gridPixelSize) / 2);
    }
    // center after small delay to compute sizes
    setTimeout(center, 50);
    // also recenter on resize
    const onResize = () => center();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scale]);

  // helper to format purchased count (derived)
  const purchasedCountDisplay = useMemo(() => purchasedRef.current.size, [/* intentionally empty */]);

  // UI rendering
  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <ParticlesBackground color="#60a5fa" density={40} />

      {/* Nav */}
      <nav style={{
        position: 'absolute', left: 0, top: 12, right: 0, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', zIndex: 40, padding: '6px 20px'
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

        <div style={{ color: '#bcdcff', fontWeight: 600, fontSize: 14 }}>
          <span style={{ marginRight: 12 }}>Pixels achetés : {purchasedRef.current.size.toLocaleString()}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{Math.round((purchasedRef.current.size / TOTAL_PIXELS) * 100)}%</span>
        </div>
      </nav>

      {/* Title */}
      <header style={{
        position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', zIndex: 30,
        pointerEvents: 'none'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 36,
          fontWeight: 900,
          color: '#e8f3ff',
          textShadow: '0 6px 32px rgba(124,196,255,0.12), 0 0 30px rgba(76,154,255,0.06)'
        }}>Mega Pixel Market — 1 000 × 1 000</h1>
        <p style={{ marginTop: 6, marginBottom: 0, color: 'rgba(223,239,255,0.9)', pointerEvents: 'auto' }}>
          Chaque pixel commence à <strong>{centsToEuroString(INITIAL_PRICE_CENTS)}</strong>. Le prix double après chaque achat.
        </p>
      </header>

      {/* HUD progress bar */}
      <div style={{
        position: 'absolute', top: 132, left: '50%', transform: 'translateX(-50%)', width: 520, zIndex: 30
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cfe5ff', fontWeight: 700, fontSize: 13 }}>
          <div>{purchasedRef.current.size.toLocaleString()} / {TOTAL_PIXELS.toLocaleString()} achetés</div>
          <div>{Math.round((purchasedRef.current.size / TOTAL_PIXELS) * 100)}%</div>
        </div>
        <div style={{
          height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 999, marginTop: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 6px rgba(2,6,22,0.5)'
        }}>
          <div style={{
            height: '100%',
            width: `${(purchasedRef.current.size / TOTAL_PIXELS) * 100}%`,
            background: 'linear-gradient(90deg,#7cc4ff,#4285f4)',
            transition: 'width 420ms ease'
          }} />
        </div>
      </div>

      {/* Canvas (centered container) */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 20, pointerEvents: 'auto'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '90vw',
            height: '70vh',
            maxWidth: '1600px',
            maxHeight: '1000px',
            borderRadius: 12,
            boxShadow: '0 40px 120px rgba(2,6,22,0.7)',
            background: 'transparent',
            touchAction: 'none'
          }}
        />
      </div>

      {/* Editor panel (floating on right) */}
      <div style={{
        position: 'absolute', right: 22, top: '40%', transform: 'translateY(-40%)', zIndex: 45,
        width: 300, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        borderRadius: 12, padding: 14, boxShadow: '0 12px 36px rgba(2,6,22,0.6)'
      }}>
        {selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e8f3ff' }}>Pixel #{selected.row},{selected.col}</div>
                <div style={{ fontSize: 12, color: '#cfe5ff', marginTop: 4 }}>Prix actuel : <strong>{centsToEuroString(selected.curPrice ?? selected.curPrice)}</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 8, background: pickerColor, boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.25)'
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

            <div style={{ marginTop: 10 }}>
              <button
                onClick={buySelected}
                style={{
                  width: '100%', padding: '12px 10px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#f5c27a,#7cc4ff)', color: '#07102a', fontWeight: 900, fontSize: 15
                }}
              >
                Acheter (tu payes {selected ? centsToEuroString(selected.curPrice ?? INITIAL_PRICE_CENTS) : centsToEuroString(INITIAL_PRICE_CENTS)})
              </button>
            </div>

            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={cancelSelected} style={{
                flex: 1, padding: '8px 10px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#dfefff'
              }}>Annuler</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, color: '#e8f3ff', fontSize: 15 }}>Sélection</div>
            <div style={{ marginTop: 8, color: '#cfe5ff' }}>Clique sur la grille pour sélectionner un pixel. Pan (cliquer + glisser) et zoom à la molette.</div>
          </>
        )}
      </div>

      {/* small help / legend bottom-left */}
      <div style={{ position: 'absolute', left: 18, bottom: 18, zIndex: 40, color: '#bcdcff' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Aides</div>
        <div style={{ fontSize: 13 }}>• Zoom : molette (sur la grille) — centrée sur le pointeur</div>
        <div style={{ fontSize: 13 }}>• Pan : cliquer + glisser</div>
        <div style={{ fontSize: 13 }}>• Sélection : clic (petit mouvement)</div>
      </div>
    </div>
  );
}


