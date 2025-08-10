// pages/index.js
import { useEffect, useState, useRef } from 'react';

const GRID_SIZE = 10;
const BASE_PRICE = 1;

// Palette de couleurs possibles pour pixels
const COLORS = [
  '#eee',       // couleur neutre / vide
  '#3367d6',    // bleu principal
  '#28a745',    // vert
  '#ffc107',    // jaune
  '#fd7e14',    // orange
  '#dc3545',    // rouge
  '#6f42c1',    // violet
  '#000000',    // noir
];

export default function PixelGame() {
  // Zoom sur la page (1 = 100%)
  const [zoom, setZoom] = useState(1);

  // Mode sombre toggle
  const [darkMode, setDarkMode] = useState(false);

  // Pixels state : chaque pixel a { price, colorIndex }
  const [pixels, setPixels] = useState(() => {
    const arr = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      arr.push({ price: BASE_PRICE, colorIndex: 0 });
    }
    return arr;
  });

  // Progression totale (somme des prix / prix max)
  const totalPrice = pixels.reduce((sum, p) => sum + p.price, 0);
  const maxPrice = GRID_SIZE * GRID_SIZE * 64; // prix max hypothétique (ex: 64€ max pixel)

  // Ref de la page pour zoom CSS
  const pageRef = useRef(null);

  // Gestion zoom molette souris
  useEffect(() => {
    function onWheel(e) {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        setZoom((z) => {
          let nz = z + delta;
          if (nz < 0.5) nz = 0.5;
          if (nz > 3) nz = 3;
          return nz;
        });
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Applique zoom sur page
  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.style.transform = `scale(${zoom})`;
      pageRef.current.style.transformOrigin = 'top left';
      pageRef.current.style.width = `${100 / zoom}%`;
      pageRef.current.style.height = `${100 / zoom}%`;
    }
  }, [zoom]);

  // Clique sur pixel : change couleur suivante et double prix (max 64)
  function buyPixel(index) {
    setPixels((oldPixels) => {
      const pixel = oldPixels[index];
      const nextColorIndex = (pixel.colorIndex + 1) % COLORS.length;
      const newPrice = Math.min(pixel.price * 2, 64);
      const newPixels = [...oldPixels];
      newPixels[index] = { price: newPrice, colorIndex: nextColorIndex };
      return newPixels;
    });
  }

  // Couleur bordure selon prix (palette chaude)
  function getBorderColor(price) {
    if (price < 2) return '#999';     // gris
    if (price < 4) return '#28a745';  // vert
    if (price < 8) return '#007bff';  // bleu
    if (price < 16) return '#6f42c1'; // violet
    if (price < 32) return '#ffc107'; // doré
    return '#fd7e14';                 // orange foncé au-delà
  }

  return (
    <>
      <style jsx>{`
        :root {
          --bg-light: #f9f9f9;
          --bg-dark: #121212;
          --text-light: #222;
          --text-dark: #eee;
          --pixel-size: 30px;
        }
        body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: ${darkMode ? 'var(--bg-dark)' : 'var(--bg-light)'};
          color: ${darkMode ? 'var(--text-dark)' : 'var(--text-light)'};
          overflow: hidden;
        }
        .page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          box-sizing: border-box;
          background: ${darkMode ? '#121212' : '#fff'};
          padding: 12px;
          transition: background-color 0.3s ease;
          user-select: none;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 2px solid ${darkMode ? '#444' : '#ccc'};
          background-color: ${darkMode ? '#222' : '#fafafa'};
          z-index: 50;
        }
        button {
          cursor: pointer;
          background-color: transparent;
          border: 1.5px solid currentColor;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          color: inherit;
          transition: background-color 0.3s ease;
        }
        button:hover {
          background-color: rgba(0,0,0,0.1);
        }
        .dropdown {
          position: relative;
          display: inline-block;
        }
        .dropdown button {
          min-width: 100px;
          text-align: center;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          top: 110%;
          left: 0;
          background-color: ${darkMode ? '#333' : '#fff'};
          min-width: 220px;
          max-height: 300px;
          overflow-y: auto;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          padding: 12px 16px;
          border-radius: 8px;
          color: ${darkMode ? '#eee' : '#222'};
          z-index: 1000;
        }
        .dropdown:hover .dropdown-content {
          display: block;
        }
        .grid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(${GRID_SIZE}, var(--pixel-size));
          grid-template-rows: repeat(${GRID_SIZE}, var(--pixel-size));
          gap: 4px;
          justify-content: center;
          background-color: ${darkMode ? '#222' : '#ddd'};
          padding: 10px;
          border-radius: 10px;
          box-shadow: inset 0 0 8px ${darkMode ? '#000' : '#bbb'};
          user-select: none;
          flex-shrink: 0;
        }
        .pixel {
          width: var(--pixel-size);
          height: var(--pixel-size);
          background-color: var(--pixel-bg, #eee);
          border: 3px solid var(--pixel-border, #999);
          box-sizing: border-box;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: ${darkMode ? '#eee' : '#222'};
          cursor: pointer;
          transition: all 0.25s ease;
          user-select: none;
          box-shadow: 0 0 4px rgba(0,0,0,0.1);
          position: relative;
        }
        .pixel:hover {
          filter: drop-shadow(0 0 6px rgba(50,150,250,0.8));
          transform: scale(1.1);
          z-index: 10;
        }
        .pixel span {
          pointer-events: none;
          user-select: none;
        }
        .progress-container {
          margin-top: 12px;
          width: 100%;
          max-width: 400px;
          background-color: ${darkMode ? '#333' : '#eee'};
          border-radius: 12px;
          overflow: hidden;
          height: 18px;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
          user-select: none;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3367d6, #4285f4);
          width: ${Math.min((totalPrice / maxPrice) * 100, 100)}%;
          transition: width 0.3s ease;
        }
        .progress-text {
          margin-top: 6px;
          font-weight: 600;
          color: ${darkMode ? '#ddd' : '#333'};
          user-select: none;
        }
        .footer {
          margin-top: auto;
          padding-top: 8px;
          font-size: 12px;
          text-align: center;
          color: ${darkMode ? '#555' : '#999'};
          user-select: none;
        }
      `}</style>

      <div className="page" ref={pageRef}>

        {/* Topbar avec toggle dark mode + menu déroulant */}
        <div className="topbar" role="navigation" aria-label="Menu principal">
          <button onClick={() => setDarkMode(!darkMode)} aria-pressed={darkMode} aria-label="Basculer mode sombre">
            Mode {darkMode ? 'Clair' : 'Sombre'}
          </button>

          <div className="dropdown">
            <button aria-haspopup="true" aria-expanded="false" aria-controls="dropdown-menu">Menu ▼</button>
            <div id="dropdown-menu" className="dropdown-content" role="menu" tabIndex="-1">
              <p><b>Quêtes & Missions</b></p>
              <ul>
                <li>🎯 Acheter un pixel (clique sur un pixel)</li>
                <li>🎯 Changer la couleur d'un pixel</li>
                <li>🎯 Atteindre 100€ collectés</li>
                <li>🎯 Zoomer avec Ctrl+molette souris</li>
              </ul>
              <hr />
              <p><b>Infos</b></p>
              <p>Pixels achetés doublent leur prix à chaque clic (max 64€)</p>
            </div>
          </div>
        </div>

        {/* Grille pixels */}
        <div className="grid" role="grid" aria-label="Grille de pixels achetables">
          {pixels.map(({ price, colorIndex }, i) => {
            const borderColor = getBorderColor(price);
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={`Pixel ${i + 1}, prix ${price} euros, couleur ${COLORS[colorIndex]}`}
                className="pixel"
                onClick={() => buyPixel(i)}
                style={{
                  backgroundColor: COLORS[colorIndex],
                  borderColor,
                  boxShadow: `0 0 8px ${borderColor}`,
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    buyPixel(i);
                  }
                }}
                title={`Prix actuel : ${price}€\nClique pour acheter et changer couleur`}
              >
                <span>{price}€</span>
              </div>
            );
          })}
        </div>

        {/* Barre de progression */}
        <div className="progress-container" role="progressbar" aria-valuemin={0} aria-valuemax={maxPrice} aria-valuenow={totalPrice} aria-label="Progression des achats de pixels">
          <div className="progress-bar"></div>
        </div>
        <div className="progress-text">
          Progression : {totalPrice}€ / {maxPrice}€
        </div>

        <div className="footer">
          &copy; 2025 OneClickHome - Jeu de pixels interactif
        </div>
      </div>
    </>
  );
}






