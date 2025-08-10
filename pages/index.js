import { useState, useEffect } from 'react';
import styles from '../styles.module.css';

export default function Home() {
  // Initial pixels: 20x20 grid, price 1€, white color
  const size = 20;
  const [pixels, setPixels] = useState(() => {
    const arr = [];
    for (let i = 0; i < size * size; i++) {
      arr.push({ color: '#ffffff', price: 1 });
    }
    return arr;
  });
  
  const [selectedColor, setSelectedColor] = useState('#3367d6');
  const [totalCollected, setTotalCollected] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [glowingIndex, setGlowingIndex] = useState(null);

  // Achat d'un pixel
  function buyPixel(i) {
    setPixels((old) => {
      const p = old[i];
      const newPrice = p.price * 2;
      const newPixels = [...old];
      newPixels[i] = { color: selectedColor, price: newPrice };
      return newPixels;
    });
    setTotalCollected((old) => old + pixels[i].price);
    setGlowingIndex(i);
  }

  // Effet glow pop qui s'enlève au bout de 600ms
  useEffect(() => {
    if (glowingIndex === null) return;
    const timer = setTimeout(() => setGlowingIndex(null), 600);
    return () => clearTimeout(timer);
  }, [glowingIndex]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <button
        className={styles.darkToggle}
        onClick={() => setDarkMode((d) => !d)}
        aria-label="Toggle dark mode"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div className={styles.container}>
        <h1 className={styles.title}>Vente de Pixels</h1>

        <div className={styles.progressContainer} role="progressbar" aria-valuemin={0} aria-valuemax={size*size*100} aria-valuenow={totalCollected}>
          <div
            className={styles.progressBar}
            style={{ width: `${(totalCollected / (size*size*100)) * 100}%` }}
          >
            {totalCollected} € collectés
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="colorPicker">Choisissez la couleur du pixel : </label>
          <input
            type="color"
            id="colorPicker"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            aria-label="Sélecteur de couleur"
          />
        </div>

        <div className={styles.grid} role="grid" aria-label="Grille de pixels à acheter">
          {pixels.map((pixel, i) => (
            <button
              key={i}
              className={`${styles.pixel} ${glowingIndex === i ? styles.glowPop : ''}`}
              style={{ backgroundColor: pixel.color }}
              data-price={pixel.price}
              onClick={() => buyPixel(i)}
              aria-label={`Pixel numéro ${i + 1}, prix actuel ${pixel.price} euros`}
              role="gridcell"
            >
              {pixel.price} €
            </button>
          ))}
        </div>
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          background: ${darkMode ? '#121212' : '#f9f9f9'};
          color: ${darkMode ? '#eee' : '#333'};
          transition: background 0.3s ease, color 0.3s ease;
        }
        .dark {
          background: #121212;
          color: #eee;
        }
      `}</style>
    </div>
  );
}
