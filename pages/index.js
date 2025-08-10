import { useState, useEffect } from 'react';
import styles from '../styles.module.css';

// Génère un pseudo simple aléatoire (ex: User1234)
function generatePseudo() {
  return 'User' + Math.floor(1000 + Math.random() * 9000);
}

export default function Home() {
  const size = 20;

  // Pseudo unique par session (stocké en localStorage)
  const [pseudo, setPseudo] = useState('');
  useEffect(() => {
    let p = localStorage.getItem('pseudo');
    if (!p) {
      p = generatePseudo();
      localStorage.setItem('pseudo', p);
    }
    setPseudo(p);
  }, []);

  // Pixels : couleur, prix, propriétaire
  const [pixels, setPixels] = useState(() => {
    const arr = [];
    for (let i = 0; i < size * size; i++) {
      arr.push({ color: '#ffffff', price: 1, owner: null });
    }
    return arr;
  });

  const [selectedColor, setSelectedColor] = useState('#3367d6');
  const [totalCollected, setTotalCollected] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [glowingIndex, setGlowingIndex] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Acheter un pixel
  function buyPixel(i) {
    setPixels((old) => {
      const p = old[i];
      const newPrice = p.price * 2;
      const newPixels = [...old];
      newPixels[i] = { color: selectedColor, price: newPrice, owner: pseudo };
      return newPixels;
    });
    setTotalCollected((old) => old + pixels[i].price);
    setGlowingIndex(i);
  }

  // Effet glow pop qui disparaît après 600ms
  useEffect(() => {
    if (glowingIndex === null) return;
    const timer = setTimeout(() => setGlowingIndex(null), 600);
    return () => clearTimeout(timer);
  }, [glowingIndex]);

  // Calcul classement des meilleurs acheteurs
  const ranking = Object.entries(
    pixels.reduce((acc, p) => {
      if (p.owner) acc[p.owner] = (acc[p.owner] || 0) + p.price;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5

  // Gestion zoom boutons
  function zoomIn() {
    setZoom((z) => Math.min(z + 0.1, 3));
  }
  function zoomOut() {
    setZoom((z) => Math.max(z - 0.1, 0.5));
  }

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

        {/* Zoom controls */}
        <div style={{ marginBottom: '0.5rem' }}>
          <button onClick={zoomOut} aria-label="Zoom out" style={{marginRight: '10px'}}>➖</button>
          <button onClick={zoomIn} aria-label="Zoom in">➕</button>
          <span style={{marginLeft: '10px'}}>Zoom: {(zoom*100).toFixed(0)}%</span>
        </div>

        {/* Grille avec zoom */}
        <div
          className={styles.grid}
          role="grid"
          aria-label="Grille de pixels à acheter"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {pixels.map((pixel, i) => (
            <button
              key={i}
              className={`${styles.pixel} ${glowingIndex === i ? styles.glowPop : ''}`}
              style={{ backgroundColor: pixel.color }}
              data-price={pixel.price}
              onClick={() => buyPixel(i)}
              aria-label={`Pixel numéro ${i + 1}, prix actuel ${pixel.price} euros, propriétaire ${pixel.owner || 'aucun'}`}
              role="gridcell"
            >
              {pixel.price} €
            </button>
          ))}
        </div>

        {/* Classement */}
        <section style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2>Top 5 des meilleurs acheteurs</h2>
          {ranking.length === 0 ? (
            <p>Aucun achat pour le moment.</p>
          ) : (
            <ol>
              {ranking.map(([owner, total], idx) => (
                <li key={owner}>
                  <strong>{owner}</strong> : {total} €
                  {owner === pseudo ? ' (Vous)' : ''}
                </li>
              ))}
            </ol>
          )}
        </section>
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
        button:focus {
          outline: 2px solid #4285f4;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

