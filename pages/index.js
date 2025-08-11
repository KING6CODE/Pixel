// pages/index.js
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/BackgroundParticles';
import styles from '../styles/PixelArt.module.css';

const GRID_SIZE = 10;
const START_PRICE = 1;
const STORAGE_KEY = 'pixel_grid_v1';

// helper: convert H S L to CSS with modern syntax (space separated)
const hslCss = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

// choose border class key by price
function borderKey(price) {
  if (price < 2) return 'borderPrice1';
  if (price < 4) return 'borderPrice2';
  if (price < 8) return 'borderPrice4';
  if (price < 16) return 'borderPrice8';
  return 'borderPrice16';
}

export default function Home() {
  const total = GRID_SIZE * GRID_SIZE;

  // initialize pixels from localStorage when possible (client-side safe)
  const [pixels, setPixels] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {
      // ignore parse errors
    }
    // default: white color and price 1
    return Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE }));
  });

  // persist pixels to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pixels));
    } catch (e) {}
  }, [pixels]);

  // intro overlay state — when true overlay mounted; when false removed from DOM
  const [introOpen, setIntroOpen] = useState(() => {
    // show intro only if not dismissed before
    try {
      if (typeof window !== 'undefined') {
        const dismissed = localStorage.getItem(`${STORAGE_KEY}_intro_dismissed`);
        return !dismissed;
      }
    } catch (e) {}
    return true;
  });

  // drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIndex, setDrawerIndex] = useState(null);

  // HSL sliders (for preview)
  const [h, setH] = useState(210);
  const [s, setS] = useState(75);
  const [l, setL] = useState(55);
  const previewColor = useMemo(() => hslCss(h, s, l), [h, s, l]);

  const [isProcessing, setIsProcessing] = useState(false);

  // audio click (tiny feedback) — safe to construct in effect
  const clickAudioRef = useRef(null);
  useEffect(() => {
    try {
      // very tiny silent wav (placeholder) — replace with a nicer file if you want
      clickAudioRef.current = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=');
    } catch (e) {
      clickAudioRef.current = null;
    }
  }, []);

  // open drawer for a pixel index
  function openDrawer(index) {
    // set HSL from current color if it's hsl(...) format
    const cur = pixels[index]?.color || '#ffffff';
    const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(cur);
    if (m) {
      setH(Number(m[1])); setS(Number(m[2])); setL(Number(m[3]));
    } else {
      // otherwise keep current sliders
    }
    setDrawerIndex(index);
    setDrawerOpen(true);
  }

  // close drawer
  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerIndex(null);
  }

  // validate: apply preview color to pixel and double its price
  function validatePixel() {
    if (drawerIndex == null) return;
    setIsProcessing(true);
    // small delay for UX
    setTimeout(() => {
      setPixels(prev => {
        const next = [...prev];
        const cur = next[drawerIndex];
        const doubled = Math.min(cur.price * 2, 2 ** 12); // cap to avoid insane numbers
        next[drawerIndex] = { color: previewColor, price: doubled };
        return next;
      });
      // play tiny sound
      try { clickAudioRef.current?.play(); } catch (e) {}
      setIsProcessing(false);
      closeDrawer();
    }, 220);
  }

  // reset everything
  function resetAll() {
    if (!confirm('Réinitialiser tous les pixels à blanc et prix à 1€ ?')) return;
    setPixels(Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE })));
    // clear localStorage flag if you want
  }

  // count purchased
  const purchasedCount = pixels.filter(p => p.price > START_PRICE).length;
  const progressPct = Math.round((purchasedCount / total) * 100);

  // close on Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (drawerOpen) closeDrawer(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // when user dismisses intro, store dismiss to avoid showing again
  function enterSite() {
    setIntroOpen(false);
    try { localStorage.setItem(`${STORAGE_KEY}_intro_dismissed`, '1'); } catch (e) {}
  }

  return (
    <div className="app-shell" style={{ position: 'relative' }}>
      {/* background particles */}
      <ParticlesBackground color="#60a5fa" density={70} />

      {/* Intro overlay (mounted only while introOpen true) */}
      {introOpen && (
        <div className={styles.introOverlay} role="dialog" aria-modal="true">
          <div className={styles.introCard} style={{ background: 'linear-gradient(180deg, rgba(6,10,20,0.96), rgba(6,10,20,0.98))' }}>
            <h2 style={{ color: '#fff' }}>Bienvenue sur Pixel Market</h2>
            <p style={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.45 }}>
              Grille 10×10 — chaque pixel commence à <strong>1€</strong>. Clique sur un pixel pour l’éditer.
              À chaque validation le prix double (1 → 2 → 4 → 8 → 16 → ...). Les contours changent selon le palier.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.78)' }}>
              Cette version est frontend-only : la logique d’achat est visuelle et stockée localement dans ton navigateur.
            </p>
            <div className="introActions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className={styles.tourBtn} onClick={() => enterSite()}>Entrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <main className={styles.page} role="main" aria-label="Pixel Market">
        {/* header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Pixel Market — 10×10</div>
            <div className={styles.subtitle}>Clique sur un pixel pour l’éditer — prévisualisation H/S/L, validation double le prix.</div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ textAlign: 'right', color: 'rgba(232,240,255,0.85)', fontSize: 13 }}>
              <div>Progress: <strong>{purchasedCount}/{total}</strong></div>
              <div style={{ width: 180, marginTop: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', height: 10, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#f5c27a,#7cc4ff)' }} />
                </div>
              </div>
            </div>

            <Link href="/galerie" legacyBehavior>
              <a style={{ color: '#e8f0ff', textDecoration: 'underline', fontWeight: 700 }}>Voir la galerie</a>
            </Link>

            <button className={styles.primaryBtn} onClick={resetAll}>Réinitialiser tout</button>
          </div>
        </div>

        {/* left column */}
        <section className={styles.left}>
          <div className={styles.gridWrap}>
            <div className={styles.grid} role="grid" aria-label="Grille 10 par 10">
              {pixels.map((p, i) => {
                const bk = borderKey(p.price);
                const borderClass = styles[bk];
                const glowClass = p.price >= 16 ? styles.glow : '';
                return (
                  <button
                    key={i}
                    onClick={() => openDrawer(i)}
                    className={`${styles.pixel} ${borderClass || ''} ${glowClass}`}
                    aria-label={`Pixel ${i+1} - prix ${p.price} euro`}
                    style={{ background: p.color }}
                  >
                    <span className="price" style={{ fontSize: 12, color: 'rgba(6,10,22,0.9)' }}>{p.price}€</span>
                    {p.price > START_PRICE && <span className="boughtBadge">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.legend} aria-hidden>
            <div className={styles.legendItem}><div style={{ width: 12, height: 12, background: '#d1d5db', borderRadius: 4 }}></div><div style={{ fontSize: 13 }}>1€ — contour gris</div></div>
            <div className={styles.legendItem}><div style={{ width: 12, height: 12, background: '#86efac', borderRadius: 4 }}></div><div style={{ fontSize: 13 }}>2€ — vert</div></div>
            <div className={styles.legendItem}><div style={{ width: 12, height: 12, background: '#93c5fd', borderRadius: 4 }}></div><div style={{ fontSize: 13 }}>4€ — bleu</div></div>
            <div className={styles.legendItem}><div style={{ width: 12, height: 12, background: '#c4b5fd', borderRadius: 4 }}></div><div style={{ fontSize: 13 }}>8€ — violet</div></div>
            <div className={styles.legendItem}><div style={{ width: 12, height: 12, background: '#ffd580', borderRadius: 4, boxShadow: '0 0 8px rgba(255,213,130,0.4)' }}></div><div style={{ fontSize: 13 }}>16€+ — doré</div></div>
          </div>
        </section>

        {/* right column (static info panel) */}
        <aside className={styles.panel} aria-hidden>
          <h3 style={{ color: '#e8f0ff' }}>Infos rapides</h3>
          <p style={{ color: 'rgba(232,240,255,0.86)' }}>
            Clique sur un pixel pour l’éditer. Le drawer à droite te permet de sélectionner la couleur via H / S / L, puis valider pour appliquer la couleur et doubler le prix.
          </p>
          <div style={{ marginTop: 12 }}>
            <strong>Remarques :</strong>
            <ul style={{ color: 'rgba(232,240,255,0.8)', marginTop: 8 }}>
              <li>Les modifications sont sauvegardées localement (localStorage).</li>
              <li>La galerie affiche la grille sans prix — pratique pour exposer.</li>
            </ul>
          </div>
        </aside>
      </main>

      {/* drawer overlay (blocks background when drawer open) */}
      <div
        className={`${styles.drawerOverlay} ${drawerOpen ? styles.drawerOverlayVisible : ''}`}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />

      {/* drawer panel */}
      <aside
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>{drawerIndex != null ? `Pixel #${drawerIndex + 1}` : 'Éditer pixel'}</div>
            <div className={styles.drawerSub}>Prix actuel: {drawerIndex != null ? pixels[drawerIndex].price + '€' : '--'}</div>
          </div>
          <div>
            <button className={styles.ghostBtn} onClick={closeDrawer} aria-label="Fermer drawer">×</button>
          </div>
        </div>

        <div>
          <div className={styles.colorPreview} style={{ background: previewColor }} />
          <div className={styles.sliderRow}>
            <label>Hue</label>
            <input type="range" min="0" max="360" value={h} onChange={(e) => setH(Number(e.target.value))} />
            <div style={{ width: 40, textAlign: 'right' }}>{h}</div>
          </div>
          <div className={styles.sliderRow}>
            <label>Sat</label>
            <input type="range" min="0" max="100" value={s} onChange={(e) => setS(Number(e.target.value))} />
            <div style={{ width: 40, textAlign: 'right' }}>{s}%</div>
          </div>
          <div className={styles.sliderRow}>
            <label>Light</label>
            <input type="range" min="0" max="100" value={l} onChange={(e) => setL(Number(e.target.value))} />
            <div style={{ width: 40, textAlign: 'right' }}>{l}%</div>
          </div>

          <div style={{ marginTop: 8, color: 'rgba(232,240,255,0.9)', fontSize: 13 }}>
            Aperçu: <code style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>{previewColor}</code>
          </div>

          <div className={styles.btnRow}>
            <button className={styles.primaryBtn} onClick={validatePixel} disabled={isProcessing}>
              {isProcessing ? 'En cours...' : 'Valider (double prix)'}
            </button>
            <button className={styles.ghostBtn} onClick={closeDrawer}>Annuler</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <small style={{ color: 'rgba(232,240,255,0.6)' }}>Changements locaux (frontend).</small>
          </div>
        </div>
      </aside>
    </div>
  );
}




