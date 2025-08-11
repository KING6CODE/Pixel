import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from '../styles/Game.module.css';

export default function Game() {
  const initialPixels = Array.from({ length: 100 }, (_, i) => {
    // Prix aléatoire pour l'exemple
    const prices = [1, 2, 4, 8, 16];
    const price = prices[Math.floor(Math.random() * prices.length)];
    return {
      price,
      color: `hsl(210, 60%, ${90 - price * 4}%)`, // couleurs bleues dégradées
    };
  });

  const [pixels, setPixels] = useState(initialPixels);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [h, setH] = useState(210);
  const [s, setS] = useState(60);
  const [l, setL] = useState(70);
  const [isBuying, setIsBuying] = useState(false);

  // Met à jour la couleur du pixel sélectionné quand H, S ou L changent
  useEffect(() => {
    if (selectedIndex === null) return;
    const newColor = `hsl(${h}, ${s}%, ${l}%)`;
    setPixels((pixels) =>
      pixels.map((p, i) => (i === selectedIndex ? { ...p, color: newColor } : p))
    );
  }, [h, s, l]);

  const handlePixelClick = (index) => {
    setSelectedIndex(index);
    // On récupère la couleur actuelle pour synchroniser les sliders
    const color = pixels[index].color;
    // Extraction HSL simplifiée (fonctionne car on génère toujours en hsl)
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      setH(Number(hslMatch[1]));
      setS(Number(hslMatch[2]));
      setL(Number(hslMatch[3]));
    }
  };

  const buyPixel = () => {
    if (selectedIndex === null) return;
    setIsBuying(true);
    setTimeout(() => {
      alert(`Pixel #${selectedIndex + 1} acheté à ${pixels[selectedIndex].price}€ !`);
      setIsBuying(false);
    }, 800);
  };

  const pixelsBoughtCount = pixels.filter((p) => p.price === 0).length;

  // Classe bordure selon prix (existant)
  const getBorderClass = (price) => {
    if (price <= 1) return 'border-price-1';
    if (price <= 2) return 'border-price-2';
    if (price <= 4) return 'border-price-4';
    if (price <= 8) return 'border-price-8';
    return 'border-price-16';
  };

  return (
    <>
      <Head>
        <title>PixelProfit - Acheter un pixel rentable</title>
        <meta name="description" content="Achetez des pixels rentables pour votre visibilité en ligne." />
      </Head>

      <nav className={styles.navbar}>
        <Link href="/">
          <a className={styles.homeBtn}>Accueil</a>
        </Link>
        <div className={styles.progress}>
          Pixels achetés : {pixelsBoughtCount} / {pixels.length}
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(pixelsBoughtCount / pixels.length) * 100}%` }}
            />
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>PixelProfit</h1>
          <p className={styles.subtitle}>Investissez dans des pixels rentables et boostez votre visibilité</p>
        </header>

        <div className={styles.page}>
          <div className={styles.grid}>
            {pixels.map((pixel, i) => (
              <div
                key={i}
                className={`${styles.pixel} ${styles[getBorderClass(pixel.price)]} ${selectedIndex === i ? styles.selected : ''}`}
                style={{ backgroundColor: pixel.color }}
                onClick={() => handlePixelClick(i)}
                title={`Pixel #${i + 1} - Prix: ${pixel.price}€`}
              >
                <span className={styles.price}>{pixel.price}€</span>
              </div>
            ))}
          </div>

          {selectedIndex !== null && (
            <aside className={styles.sidebar}>
              <h2>Pixel #{selectedIndex + 1}</h2>
              <p>Prix actuel : <strong>{pixels[selectedIndex].price}€</strong></p>

              <div className={styles.colorPreview} style={{ backgroundColor: pixels[selectedIndex].color }}>
                Couleur sélectionnée
              </div>

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
      </main>
    </>
  );
}


