// pages/game.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../styles/Game.module.css';

const GRID_SIZE = 10;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

function createInitialPixels() {
  // Tous à prix 1€, couleur initiale hsl(210, 70%, 80%) (bleu pastel)
  const baseHue = 210;
  const baseSat = 70;
  const baseLight = 80;
  return Array(TOTAL_PIXELS).fill().map(() => ({
    price: 1,
    color: `hsl(${baseHue}, ${baseSat}%, ${baseLight}%)`,
    h: baseHue,
    s: baseSat,
    l: baseLight,
    bought: false,
  }));
}

export default function PixelGame() {
  const [pixels, setPixels] = useState(createInitialPixels);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [h, setH] = useState(210);
  const [s, setS] = useState(70);
  const [l, setL] = useState(80);
  const [isBuying, setIsBuying] = useState(false);

  // Met à jour la couleur HSL du pixel sélectionné quand on change la couleur
  useEffect(() => {
    if (selectedIndex === null) return;
    setPixels(prev =>
      prev.map((p, i) =>
        i === selectedIndex
          ? {
              ...p,
              h,
              s,
              l,
              color: `hsl(${h}, ${s}%, ${l}%)`,
            }
          : p
      )
    );
  }, [h, s, l, selectedIndex]);

  const handlePixelClick = (index) => {
    setSelectedIndex(index);
    const p = pixels[index];
    setH(p.h);
    setS(p.s);
    setL(p.l);
  };

  const buyPixel = () => {
    if (selectedIndex === null) return;
    const pixel = pixels[selectedIndex];
    setIsBuying(true);
    setTimeout(() => {
      setPixels(prev => {
        const newPixels = [...prev];
        newPixels[selectedIndex] = {
          ...pixel,
          price: pixel.price * 2,
          bought: true,
          // Garde couleur actuelle
          h: pixel.h,
          s: pixel.s,
          l: pixel.l,
          color: `hsl(${pixel.h}, ${pixel.s}%, ${pixel.l}%)`,
        };
        return newPixels;
      });
      setIsBuying(false);
    }, 500);
  };

  // Pour les bordures selon prix (pour effet visuel)
  function getBorderClass(price) {
    if (price >= 16) return 'border-price-16';
    if (price >= 8) return 'border-price-8';
    if (price >= 4) return 'border-price-4';
    if (price >= 2) return 'border-price-2';
    return 'border-price-1';
  }

  // Compte pixels achetés
  const pixelsBought = pixels.filter(p => p.bought).length;
  const progressPercent = (pixelsBought / TOTAL_PIXELS) * 100;

  return (
    <div className={styles.container}>
      {/* Barre de navigation */}
      <nav className={styles.navbar}>
        <Link href="/">
          <a className={styles.homeBtn}>Accueil</a>
        </Link>
        <h1 className={styles.title}>PixelProfit</h1>
      </nav>

      {/* Titre et sous-titre centrés */}
      <header className={styles.headerCentered}>
        <h2 className={styles.mainTitle}>Achetez vos pixels, faites-les fructifier !</h2>
        <p className={styles.subtitle}>Chaque pixel commence à 1€ et double de prix à chaque achat.</p>
      </header>

      {/* Grille centrée */}
      <main className={styles.mainContent}>
        <div className={styles.grid}>
          {pixels.map((pixel, i) => (
            <div
              key={i}
              className={`${styles.pixel} ${styles[getBorderClass(pixel.price)]} ${selectedIndex === i ? styles.selected : ''}`}
              style={{ backgroundColor: pixel.color }}
              onClick={() => handlePixelClick(i)}
              title={`Prix: ${pixel.price}€`}
            >
              <span className={styles.price}>{pixel.price}€</span>
            </div>
          ))}
        </div>

        {/* Sidebar de sélection */}
        {selectedIndex !== null && (
          <aside className={styles.sidebar}>
            <h2>Pixel #{selectedIndex + 1}</h2>
            <p>Prix actuel : <strong>{pixels[selectedIndex].price}€</strong></p>

            <div className={styles.colorPicker}>
              <label>
                Teinte (H): {h}
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={h}
                  onChange={(e) => setH(+e.target.value)}
                />
              </label>
              <label>
                Saturation (S): {s}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={s}
                  onChange={(e) => setS(+e.target.value)}
                />
              </label>
              <label>
                Luminosité (L): {l}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={l}
                  onChange={(e) => setL(+e.target.value)}
                />
              </label>
            </div>

            <button
              className={styles.buyBtn}
              onClick={buyPixel}
              disabled={isBuying}
            >
              Acheter ce pixel
            </button>
          </aside>
        )}
      </main>

      {/* Barre de progression */}
      <footer className={styles.footer}>
        <div className={styles.progressWrapper}>
          <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
        </div>
        <p>{pixelsBought} pixel{pixelsBought !== 1 ? 's' : ''} acheté{pixelsBought !== 1 ? 's' : ''} sur {TOTAL_PIXELS}</p>
      </footer>
    </div>
  );
}
