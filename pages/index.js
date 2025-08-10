import { useState, useEffect, useRef } from 'react';
import styles from '../styles.module.css';

function generatePseudo() {
  return 'User' + Math.floor(1000 + Math.random() * 9000);
}

export default function Home() {
  const size = 20;
  const [pseudo, setPseudo] = useState('');
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
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // Pour le décalage scrollé/zoomé
  const [pixelOfTheDay, setPixelOfTheDay] = useState(null);

  const gridRef = useRef(null);

  // Pseudo par session
  useEffect(() => {
    let p = localStorage.getItem('pseudo');
    if (!p) {
      p = generatePseudo();
      localStorage.setItem('pseudo', p);
    }
    setPseudo(p);
  }, []);

  // Pixel du jour (aléatoire à chaque chargement)
  useEffect(() => {
    setPixelOfTheDay(Math.floor(Math.random() * size * size));
  }, []);

  // Acheter pixel avec gestion bonus pixel du jour (-20%)
  function buyPixel(i) {
    setPixels((old) => {
      const p = old[i];
      let price = p.price;
      if (i === pixelOfTheDay) price = Math.ceil(price * 0.8); // 20% moins cher
      const newPrice = price * 2;
      const newPixels = [...old];
      newPixels[i] = { color: selectedColor, price: newPrice, owner: pseudo };
      return newPixels;
    });

    let priceToAdd = pixels[i].price;
    if (i === pixelOfTheDay) priceToAdd = Math.ceil(priceToAdd * 0.8);
    setTotalCollected((old) => old + priceToAdd);
    setGlowingIndex(i);
  }

  // Glow pop effet
  useEffect(() => {
    if (glowingIndex === null) return;
    const timer = setTimeout(() => setGlowingIndex(null), 600);
    return () => clearTimeout(timer);
  }, [glowingIndex]);

  // Classement
  const ranking = Object.entries(
    pixels.reduce((acc, p) => {
      if (p.owner) acc[p.owner] = (acc[p.owner] || 0) + p.price;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Zoom centré sur la souris
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    function onWheel(e) {
      e.preventDefault();
      const rect = grid.getBoundingClientRect();

      // Position souris relative à la grille
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom((z) => {
        let newZoom = z + (e.deltaY < 0 ? 0.1 : -0.1);
        if (newZoom < 0.5) newZoom = 0.5;
        if (newZoom > 3) newZoom = 3;

        // Calcul offset pour garder la souris fixe par rapport au zoom
        setOffset((old) => {
          const scaleChange = newZoom / z;
          const newX = mouseX - scaleChange * (mouseX - old.x);
          const newY = mouseY - scaleChange * (mouseY - old.y);
          return { x: newX, y: newY };
        });

        return newZoom;
      });
    }

    grid.addEventListener('wheel', onWheel, { passive: false });
    return () => grid.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className={styles.animatedBackground} />

      <button
        className={styles.darkToggle}
        onClick={() => setDarkMode((d) => !d)}
        aria-label="Toggle dark mode"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div className={styles.container}>
        <h1 className={styles.title}>Vente de Pixels</h1>

        <div
          className={styles.progressContainer}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={size * size * 100}
          aria-valuenow={totalCollected}
        >
          <div
            className={styles.progressBar}
            style={{ width: `${(totalCollected / (size * size * 100)) * 100}%` }}
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

        <div style={{ marginBottom: '0.5rem' }}>
          <span>
            Pixel du jour : #{pixelOfTheDay + 1} (20% moins cher !){' '}
            <span role="img" aria-label="feu">
              🔥
            </span>
          </span>
        </div>

        <div
          ref={gridRef}
          className={styles.grid}
          role="grid"
          aria-label="Grille de pixels à acheter"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          {pixels.map((pixel, i) => (
            <button
              key={i}
              className={`${styles.pixel} ${
                glowingIndex === i ? styles.glowPop : ''
              } ${i === pixelOfTheDay ? styles.pixelOfTheDay : ''}`}
              style={{ backgroundColor: pixel.color }}
              data-price={pixel.price}
              onClick={() => buyPixel(i)}
              aria-label={`Pixel numéro ${i + 1}, prix actuel ${
                i === pixelOfTheDay
                  ? Math.ceil(pixel.price * 0.8)
                  : pixel.price
              } euros, propriétaire ${pixel.owner || 'aucun'}`}
              role="gridcell"
            >
              {i === pixelOfTheDay
                ? Math.ceil(pixel.price * 0.8)
                : pixel.price}{' '}
              €
            </button>
          ))}
        </div>

        <section
          style={{
            marginTop: '2rem',
            textAlign: 'left',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <h2>Top 5 des meilleurs acheteurs</h2>
          {ranking.length === 0 ? (
            <p>Aucun achat pour le moment.</p>
          ) : (
            <ol>
              {ranking.map(([owner, total]) => (
                <li key={owner}>
                  <strong>{owner}</strong> : {total} €
                  {owner === pseudo ? ' (Vous)' : ''}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <style jsx>{`
        .dark {
          background: #121212;
          color: #eee;
        }
        body {
          margin: 0;
          background: #f9f9f9;
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
        }
        button:focus {
          outline: 2px solid #4285f4;
          outline-offset: 2px;
        }
      `}</style>

      <style jsx global>{`
        .${styles.container} {
          max-width: 900px;
          margin: 0 auto;
          padding: 1rem;
          text-align: center;
          position: relative;
          z-index: 1;
        }
        .${styles.title} {
          margin: 1rem 0;
          font-size: 2.5rem;
        }
        .${styles.grid} {
          display: grid;
          grid-template-columns: repeat(${size}, 20px);
          grid-template-rows: repeat(${size}, 20px);
          gap: 2px;
          justify-content: start;
          margin: 0 auto;
          cursor: pointer;
          user-select: none;
          border: 1px solid #ccc;
          background: white;
          width: fit-content;
          overflow: hidden;
          touch-action: none;
          transition: transform 0.2s ease;
        }
        .${styles.pixel} {
          width: 20px;
          height: 20px;
          border: 1px solid #ddd;
          font-size: 10px;
          color: #333;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;
          user-select: none;
          position: relative;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .${styles.glowPop} {
          animation: glowPop 0.6s ease forwards;
        }
        @keyframes glowPop {
          0% {
            box-shadow: 0 0 0px 0px rgba(51, 103, 214, 0);
            transform: scale(1);
            border-color: #3367d6;
          }
          50% {
            box-shadow: 0 0 10px 3px rgba(51, 103, 214, 0.7);
            transform: scale(1.3);
            border-color: #3367d6;
          }
          100% {
            box-shadow: 0 0 0px 0px rgba(51, 103, 214, 0);
            transform: scale(1);
            border-color: #3367d6;
          }
        }
        .${styles.pixelOfTheDay} {
          border: 2px solid #ff6f61;
          animation: pulse 2s infinite;
          z-index: 10;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 5px 2px #ff6f61;
          }
          50% {
            box-shadow: 0 0 15px 6px #ff6f61;
          }
          100% {
            box-shadow: 0 0 5px 2px #ff6f61;
          }
        }
        .${styles.progressContainer} {
          background: #eee;
          border-radius: 10px;
          width: 100%;
          max-width: 600px;
          height: 20px;
          margin: 1rem auto;
          overflow: hidden;
        }
        .${styles.progressBar} {
          background: #3367d6;
          height: 100%;
          width: 0;
          color: white;
          font-weight: bold;
          text-align: center;
          line-height: 20px;
          transition: width 0.4s ease;
        }
        .${styles.darkToggle} {
          position: fixed;
          top: 10px;
          right: 10px;
          background: transparent;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          z-index: 20;
          color: inherit;
        }
        .${styles.animatedBackground} {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(45deg, #3367d6, #4285f4, #a1c4fd);
          background-size: 600% 600%;
          animation: gradientBG 20s ease infinite;
          z-index: 0;
          opacity: 0.15;
        }
        @keyframes gradientBG {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}


