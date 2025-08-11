// pages/game.js
import { useEffect, useRef, useState } from 'react';
import ParticlesBackground from '../components/ParticlesBackground';
import styles from '../styles/Game.module.css';

const GRID_SIZE = 10;
const START_PRICE = 1;

function getBorderClass(price) {
  if (price < 2) return 'border-price-1';
  if (price < 4) return 'border-price-2';
  if (price < 8) return 'border-price-4';
  if (price < 16) return 'border-price-8';
  return 'border-price-16';
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

  function handlePixelClick(index) {
    setSelectedIndex(index);
  }

  function buyPixel() {
    if (selectedIndex === null) return;
    const newPixels = [...pixels];
    newPixels[selectedIndex] = {
      color: `hsl(${h}, ${s}%, ${l}%)`,
      price: newPixels[selectedIndex].price * 2,
      bought: true,
    };
    setPixels(newPixels);
    setIsBuying(false);
  }

  return (
    <>
      <ParticlesBackground color="#7cc4ff" density={60} />
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>PixelProfit - Acheter des pixels</h1>
          <a href="/" className={styles.homeBtn}>Accueil</a>
        </header>

        <div className={styles.page}>
          <div className={styles.grid}>
            {pixels.map((pixel, i) => (
              <div
                key={i}
                className={`${styles.pixel} ${styles[getBorderClass(pixel.price)]} ${selectedIndex === i ? styles.selected : ''}`}
                style={{ backgroundColor: pixel.color }}
                onClick={() => handlePixelClick(i)}
              >
                <span className={styles.price}>{pixel.price}€</span>
              </div>
            ))}
          </div>

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
        </div>

        <footer className={styles.footer}>
          © 2025 PixelProfit - Votre source de pixels rentables
        </footer>
      </div>
    </>
  );
}

