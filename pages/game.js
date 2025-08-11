// pages/game.js
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';
import styles from '../styles/Game.module.css';

const GRID_SIZE = 10;
const START_PRICE = 1;

/* util: convert hex -> hsl (used si couleur stockée en hex) */
function hexToHsl(hex) {
  if (!hex) return [210, 80, 60];
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return rgbToHsl(r, g, b);
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return rgbToHsl(r, g, b);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToCss(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getBorderPriceClass(price) {
  if (price < 2) return 'borderPrice1';
  if (price < 4) return 'borderPrice2';
  if (price < 8) return 'borderPrice4';
  if (price < 16) return 'borderPrice8';
  return 'borderPrice16';
}

export default function Game() {
  const total = GRID_SIZE * GRID_SIZE;
  const [pixels, setPixels] = useState(() =>
    Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE }))
  );

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [h, setH] = useState(210);
  const [s, setS] = useState(80);
  const [l, setL] = useState(60);
  const [isBuying, setIsBuying] = useState(false);

  // derived preview color (live)
  const previewColor = useMemo(() => hslToCss(h, s, l), [h, s, l]);

  // progression
  const purchasedCount = useMemo(() => pixels.filter(p => p.price > START_PRICE).length, [pixels]);
  const progressPercent = Math.round((purchasedCount / total) * 100);

  // when selecting pixel, init sliders from its color (support hsl(...) or hex)
  function openPixel(index) {
    setSelectedIndex(index);
    const cur = pixels[index]?.color ?? '#ffffff';
    // try to parse hsl like "hsl(h, s%, l%)"
    const m = /hsl\(\s*([0-9.]+)[, ]\s*([0-9.]+)%[,]?\s*([0-9.]+)%\s*\)/i.exec(cur);
    if (m) {
      setH(Math.round(Number(m[1])));
      setS(Math.round(Number(m[2])));
      setL(Math.round(Number(m[3])));
    } else {
      // assume hex
      const [hh, ss, ll] = hexToHsl(cur);
      setH(hh); setS(ss); setL(ll);
    }
  }

  function closePanel() {
    setSelectedIndex(null);
  }

  function buyPixel() {
    if (selectedIndex === null) return;
    setIsBuying(true);
    setTimeout(() => {
      setPixels(prev => {
        const next = [...prev];
        const cur = next[selectedIndex];
        const newPrice = cur.price * 2;
        next[selectedIndex] = { color: previewColor, price: newPrice };
        return next;
      });
      setIsBuying(false);
      closePanel();
    }, 220);
  }

  function resetAll() {
    if (!confirm('Réinitialiser tous les pixels et prix à 1€ ?')) return;
    setPixels(Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE })));
    setSelectedIndex(null);
  }

  // apply live preview to the pixel being edited (visual only until buy)
  function displayColorForIndex(i) {
    if (selectedIndex === i) return previewColor;
    return pixels[i].color;
  }

  // keyboard ESC closes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closePanel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.wrapper}>
      <ParticlesBackground color="#60a5fa" density={60} />

      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link href="/"><a className={styles.homeLink}>Accueil</a></Link>
        </div>
        <div className={styles.navRight}>
          <button className={styles.resetBtn} onClick={resetAll} aria-label="Réinitialiser">Réinitialiser</button>
        </div>
      </nav>

      <main className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Pixel Market</h1>
          <p className={styles.subtitle}>Chaque pixel commence à <strong>1€</strong> — le prix double à chaque achat.</p>

          <div className={styles.progressWrap} aria-hidden>
            <div className={styles.progressInfo}>
              <span>{purchasedCount}/{total} achetés</span>
              <small>{progressPercent}%</small>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </header>

        <section className={styles.gridArea} aria-label="Zone principale - grille centrée">
          <div className={styles.gridWrapper}>
            <div className={styles.grid} role="grid" aria-label="Grille de pixels 10 par 10">
              {pixels.map((p, i) => {
                const borderClass = getBorderPriceClass(p.price);
                return (
                  <button
                    key={i}
                    role="gridcell"
                    className={`${styles.pixel} ${styles[borderClass]}`}
                    onClick={() => openPixel(i)}
                    aria-label={`Pixel ${i + 1} - Prix ${p.price} euro`}
                    style={{ background: displayColorForIndex(i) }}
                  >
                    <span className={styles.pixelPrice}>{p.price}€</span>
                    {p.price > START_PRICE && <span className={styles.bought}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* panel (appears to the right on wide screens, below on small) */}
          <aside className={styles.panel} aria-hidden={selectedIndex === null}>
            {selectedIndex === null ? (
              <div>
                <h3>Choisissez un pixel</h3>
                <p>Cliquez sur un pixel pour modifier sa couleur et l'acheter (le prix double).</p>
              </div>
            ) : (
              <div>
                <h3>Pixel #{selectedIndex + 1}</h3>
                <p>Prix actuel : <strong>{pixels[selectedIndex].price}€</strong></p>

                <div className={styles.previewRow}>
                  <div className={styles.livePreview} style={{ background: previewColor }} aria-hidden />
                  <div>
                    <div className={styles.previewLabel}>Aperçu en direct</div>
                    <div className={styles.previewCode}>{previewColor}</div>
                  </div>
                </div>

                <div className={styles.sliders}>
                  <label>Teinte (H) {h}</label>
                  <input type="range" min="0" max="360" value={h} onChange={(e) => setH(Number(e.target.value))} />

                  <label>Saturation (S) {s}%</label>
                  <input type="range" min="0" max="100" value={s} onChange={(e) => setS(Number(e.target.value))} />

                  <label>Luminosité (L) {l}%</label>
                  <input type="range" min="0" max="100" value={l} onChange={(e) => setL(Number(e.target.value))} />
                </div>

                <div className={styles.actions}>
                  <button className={styles.buyBtn} onClick={buyPixel} disabled={isBuying}>
                    {isBuying ? 'Validation…' : `Valider (double le prix → ${pixels[selectedIndex].price * 2}€)`}
                  </button>
                  <button className={styles.cancelBtn} onClick={closePanel}>Annuler</button>
                </div>
              </div>
            )}
          </aside>
        </section>

        <footer className={styles.footer}>
          © 2025 PixelProfit — Transforme des pixels en opportunités
        </footer>
      </main>
    </div>
  );
}

