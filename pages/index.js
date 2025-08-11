// pages/index.js
import { useEffect, useMemo, useRef, useState } from 'react';
import ParticlesBackground from '../components/ParticlesBackground';
import styles from '../styles/grid.module.css';

const GRID_SIZE = 10;
const START_PRICE = 1;

/* helper: get border class based on price */
function getBorderClass(price) {
  if (price < 2) return 'border-price-1';
  if (price < 4) return 'border-price-2';
  if (price < 8) return 'border-price-4';
  if (price < 16) return 'border-price-8';
  return 'border-price-16';
}

/* convert HSL to CSS string */
function hslToCss(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}

export default function Home() {
  const total = GRID_SIZE * GRID_SIZE;

  // pixels state: each { color: 'hsl(...)' , price: number }
  const [pixels, setPixels] = useState(() =>
    Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE }))
  );

  // UI states
  const [selectedIndex, setSelectedIndex] = useState(null); // index of clicked pixel
  const [panelOpen, setPanelOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [h, setH] = useState(210); // default hue
  const [s, setS] = useState(80);
  const [l, setL] = useState(60);
  const [isBuying, setIsBuying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  // derived color preview
  const previewColor = useMemo(() => hslToCss(h, s, l), [h, s, l]);

  // update progress
  const purchasedCount = pixels.filter((p) => p.price > START_PRICE).length;
  const progressPercent = Math.round((purchasedCount / total) * 100);

  // handle open panel
  function openPanel(index) {
    setSelectedIndex(index);
    // initialize sliders from current pixel color if HSL parse possible
    const cur = pixels[index].color;
    // try to parse HSL like "hsl(H S% L%)" - but we always store hsl strings from UI, so try regex
    const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(cur);
    if (m) {
      setH(Number(m[1]));
      setS(Number(m[2]));
      setL(Number(m[3]));
    } else {
      // fallback keep current sliders
    }
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedIndex(null);
  }

  // validate: apply color and double price
  function validatePixel() {
    if (selectedIndex == null) return;
    setIsBuying(true);
    setTimeout(() => {
      setPixels((prev) => {
        const next = [...prev];
        const cur = next[selectedIndex];
        const newPrice = cur.price * 2;
        next[selectedIndex] = { color: previewColor, price: newPrice };
        return next;
      });
      setIsBuying(false);
      closePanel();
    }, 220); // small delay for animation
  }

  // reset all
  function resetAll() {
    if (!confirm('Réinitialiser tous les pixels et prix à 1€ ?')) return;
    setPixels(Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE })));
    setSelectedIndex(null);
    setPanelOpen(false);
  }

  // keyboard escape closes panel
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closePanel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // zoom with ctrl+wheel (safe)
  useEffect(() => {
    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => {
        const delta = -e.deltaY * 0.0025;
        let nz = z + delta;
        if (nz < 0.6) nz = 0.6;
        if (nz > 2.2) nz = 2.2;
        return Math.round(nz * 100) / 100;
      });
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="app-shell" style={{ position: 'relative' }}>
      {/* background particles */}
      <ParticlesBackground color="#60a5fa" density={70} />

      {/* Intro / tutorial overlay */}
      {introOpen && (
        <div className={styles.introOverlay} role="dialog" aria-modal="true">
          <div className={styles.introCard}>
            <h2>Bienvenue — Pixel Market</h2>
            <p>
              Achète et personnalise des pixels sur une grille 10×10. Chaque pixel commence à <strong>1€</strong>.
              À chaque achat, le prix double (1 → 2 → 4 → 8 → 16 → 32 …) — la bordure change selon le palier.
            </p>
            <p>
              Clique sur un pixel pour ouvrir le panneau, choisis sa couleur avec les sliders H / S / L, puis <strong>Valider</strong> pour appliquer la couleur et améliorer le pixel.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="introActions">
              <button className="tourBtn" onClick={() => setIntroOpen(false)}>Entrer dans la grille</button>
            </div>
          </div>
        </div>
      )}

      {/* main card */}
      <main className={styles.page} ref={containerRef} style={{ transform: `scale(${zoom})` }}>
        {/* header row */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Pixel Market — 10×10</div>
            <div className={styles.subtitle}>Achetez, améliorez, personnalisez — frontend only pour l'instant.</div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ textAlign: 'right', fontSize: 13, color: 'rgba(232,240,255,0.85)' }}>
              <div>Progression: <strong>{purchasedCount}/{total}</strong></div>
              <div style={{ marginTop: 6, width: 180 }}>
                <div className={styles.progressBar} aria-hidden>
                  <div className={styles.progress} style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <button className={styles.primaryBtn} onClick={resetAll} title="Réinitialiser tout">
              Réinitialiser tout
            </button>
          </div>
        </div>

        {/* left column: grid and legend */}
        <section className={styles.left}>
          <div className={styles.gridWrap}>
            <div className={styles.grid} role="grid" aria-label="Grille de pixels 10 par 10">
              {pixels.map((p, i) => {
                const borderClass = getBorderClass(p.price);
                const borderClassName = styles[borderClass] || '';
                const glowClass = p.price >= 16 ? `${styles['border-price-16']} ${styles.glow}` : borderClassName;
                return (
                  <button
                    key={i}
                    className={`${styles.pixel} ${styles[borderClass] || ''} ${p.price >= 16 ? styles.glow : ''}`}
                    onClick={() => openPanel(i)}
                    aria-label={`Pixel ${i + 1} - Prix ${p.price} euro`}
                    style={{ background: p.color }}
                  >
                    <span className="price">{p.price}€</span>
                    {p.price > START_PRICE && <span className="boughtBadge">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.legend} aria-hidden>
            <div className="item">
              <div style={{ width: 12, height: 12, background: '#d1d5db', borderRadius: 4 }}></div>
              <div style={{ fontSize: 13 }}>1€ — contour gris</div>
            </div>
            <div className="item">
              <div style={{ width: 12, height: 12, background: '#86efac', borderRadius: 4 }}></div>
              <div style={{ fontSize: 13 }}>2€ — vert doux</div>
            </div>
            <div className="item">
              <div style={{ width: 12, height: 12, background: '#93c5fd', borderRadius: 4 }}></div>
              <div style={{ fontSize: 13 }}>4€ — bleu</div>
            </div>
            <div className="item">
              <div style={{ width: 12, height: 12, background: '#c4b5fd', borderRadius: 4 }}></div>
              <div style={{ fontSize: 13 }}>8€ — violet</div>
            </div>
            <div className="item">
              <div style={{ width: 12, height: 12, background: '#ffd580', borderRadius: 4, boxShadow: '0 0 8px rgba(255,213,130,0.4)' }}></div>
              <div style={{ fontSize: 13 }}>16€+ — doré (glow)</div>
            </div>
          </div>
        </section>

        {/* right column panel (drawer) */}
        <aside className={styles.panel} aria-hidden={!panelOpen}>
          <h3>{selectedIndex != null ? `Pixel #${selectedIndex + 1}` : 'Sélectionnez un pixel'}</h3>

          {selectedIndex == null ? (
            <p style={{ color: 'rgba(232,240,255,0.85)' }}>Clique sur un pixel pour ouvrir le panneau. Ici tu pourras choisir la couleur et valider l’achat (frontend).</p>
          ) : (
            <>
              <div style={{ marginBottom: 8, color: 'rgba(232,240,255,0.92)' }}>
                Prix actuel: <strong>{pixels[selectedIndex].price}€</strong>
              </div>

              {/* color preview */}
              <div className={styles.colorPreview} style={{ background: previewColor }} aria-hidden />

              {/* sliders H S L */}
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

              <div style={{ marginTop: 8, color: 'rgba(232,240,255,0.85)', fontSize: 13 }}>
                Aperçu couleur: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 6 }}>{previewColor}</code>
              </div>

              <div className={styles.btnRow}>
                <button className={styles.primaryBtn} onClick={validatePixel} disabled={isBuying}>
                  {isBuying ? '... Validation' : 'Valider (double le prix)'}
                </button>
                <button className={styles.ghostBtn} onClick={closePanel}>Annuler</button>
              </div>
            </>
          )}

          <div className={styles.resetRow}>
            <small style={{ color: 'rgba(232,240,255,0.6)' }}>Réinitialiser rétablit tout à blanc et 1€</small>
          </div>
        </aside>
      </main>
    </div>
  );
}






