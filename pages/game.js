import React, { useState } from 'react';
import styles from '../styles/Game.module.css';

export default function PixelGame() {
  const totalPixels = 100; // 10x10 grid

  // Initialiser un tableau de pixels : chaque pixel a un prix et une couleur (vide)
  const initialPixels = Array(totalPixels).fill(null).map(() => ({
    price: 1,
    bought: false,
    color: '#fff', // blanc par défaut
  }));

  const [pixels, setPixels] = useState(initialPixels);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#4285f4');

  // Nombre de pixels achetés pour la barre de progression
  const pixelsBoughtCount = pixels.filter(p => p.bought).length;

  // Fonction pour acheter un pixel
  function buyPixel(index) {
    setPixels(prevPixels => {
      const pixel = prevPixels[index];
      if (pixel.bought) return prevPixels; // déjà acheté, ne fait rien

      // Acheter : doublage du prix pour le prochain achat du même pixel (si jamais racheté ?)
      // Ici on considère qu'on peut acheter qu'une fois, mais on peut adapter.
      const newPixel = {
        ...pixel,
        bought: true,
        color: selectedColor,
        price: pixel.price * 2, // prépare le prix doublé si on voulait re-acheter
      };

      const newPixels = [...prevPixels];
      newPixels[index] = newPixel;
      return newPixels;
    });
  }

  // Barre de progression en %
  const progressPercent = Math.floor((pixelsBoughtCount / totalPixels) * 100);

  return (
    <>
      <nav className={styles.navbar}>
        <a href="/" className={styles.homeBtn}>Accueil</a>
        <div className={styles.progress}>
          <div>Pixels achetés : {pixelsBoughtCount} / {totalPixels}</div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Pixel Shop</h1>
          <p className={styles.subtitle}>Choisis ta couleur et achète ton pixel</p>
        </header>

        <div className={styles.page}>
          <div className={styles.grid}>
            {pixels.map((pixel, i) => (
              <div
                key={i}
                className={`${styles.pixel} ${pixel.bought ? styles.selected : ''}`}
                onClick={() => buyPixel(i)}
                style={{ backgroundColor: pixel.bought ? pixel.color : '#fff' }}
                title={`Prix: ${pixel.price} €${pixel.bought ? ' - ACHETÉ' : ''}`}
              >
                {!pixel.bought && pixel.price}
              </div>
            ))}
          </div>

          <aside className={styles.sidebar}>
            <h2>Choix couleur</h2>
            <div
              className={styles.colorPreview}
              style={{ backgroundColor: selectedColor }}
            >
              {selectedColor.toUpperCase()}
            </div>
            <input
              type="color"
              value={selectedColor}
              onChange={e => setSelectedColor(e.target.value)}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </aside>
        </div>
      </main>
    </>
  );
}



