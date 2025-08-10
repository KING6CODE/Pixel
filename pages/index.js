// pages/index.js
import { useEffect, useState, useRef } from 'react';

export default function PixelGame() {
  // State du zoom (1 = 100%)
  const [zoom, setZoom] = useState(1);

  // Mode sombre
  const [darkMode, setDarkMode] = useState(false);

  // Ref de la page pour appliquer zoom CSS
  const pageRef = useRef(null);

  // State pixels (chaque pixel a sa couleur et son prix)
  // Exemple: 10x10 grille = 100 pixels
  const GRID_SIZE = 10;
  const BASE_PRICE = 1;

  // pixels: tableau d'objets { price, color }
  const [pixels, setPixels] = useState(() => {
    const arr = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      arr.push({ price: BASE_PRICE, color: '#eee' });
    }
    return arr;
  });

  // Zoom via molette
  useEffect(() => {
    function onWheel(e) {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => {
        let nz = z + delta;
        if (nz < 0.5) nz = 0.5;  // limite dézoom
        if (nz > 3) nz = 3;      // limite zoom max
        return nz;
      });
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Applique le zoom sur le ref de la page
  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.style.transform = `scale(${zoom})`;
      pageRef.current.style.transformOrigin = 'top left';
      // Ajuster la taille pour éviter scroll bizarre
      pageRef.current.style.width = `${100 / zoom}%`;
      pageRef.current.style.height = `${100 / zoom}%`;
    }
  }, [zoom]);

  // Achète un pixel et augmente son prix (double)
  function buyPixel(index) {
    setPixels((oldPixels) => {
      const pixel = oldPixels[index];
      const newPrice = pixel.price * 2;
      // Couleurs contour selon prix
      const borderColor = getBorderColor(newPrice);

      const newPixels = [...oldPixels];
      newPixels[index] = {
        price: newPrice,
        color: borderColor === '#eee' ? '#ccc' : borderColor, // fond couleur douce, contour coloré
      };
      return newPixels;
    });
  }

  // Couleur du contour selon prix (palette, plus cher = plus chaud)
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
        }
        body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: ${darkMode ? 'var(--bg-dark)' : 'var(--bg-light)'};
          color: ${darkMode ? 'var(--text-dark)' : 'var(--text-light)'};
          overflow: hidden; /* éviter scroll page */
        }
        .page {
          padding: 10px;
          width: 100vw;
          height: 100vh;
          box-sizing: border-box;
          background: radial-gradient(circle at center, ${darkMode ? '#222' : '#fff'} 0%, ${darkMode ? '#121212' : '#eee'} 100%);
          transition: background-color 0.3s ease;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
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
        .grid {
          display: grid;
          grid-template-columns: repeat(${GRID_SIZE}, 30px);
          grid-template-rows: repeat(${GRID_SIZE}, 30px);
          gap: 3px;
          justify-content: center;
          user-select: none;
          margin-top: 10px;
        }
        .pixel {
          width: 30px;
          height: 30px;
          background-color: var(--pixel-bg, #eee);
          border: 3px solid var(--pixel-border, #999);
          box-sizing: border-box;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #222;
          transition: all 0.25s ease;
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.1));
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
        .dark .pixel {
          color: #eee;
          filter: drop-shadow(0 0 1px rgba(0,0,0,0.7));
        }
        .dropdown {
          position: relative;
          display: inline-block;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          background-color: ${darkMode ? '#333' : '#fff'};
          min-width: 160px;
          box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
          padding: 12px 16px;
          z-index: 1000;
          border-radius: 8px;
          color: ${darkMode ? '#eee' : '#222'};
        }
        .dropdown:hover .dropdown-content {
          display: block;
        }
      `}</style>

      <div className={`page ${darkMode ? 'dark' : ''}`} ref={pageRef}>

        <div className="topbar">
          <button onClick={() => setDarkMode(!darkMode)}>
            Mode {darkMode ? 'Clair' : 'Sombre'}
          </button>

          <div className="dropdown">
            <button>Menu ▼</button>
            <div className="dropdown-content">
              <p><b>Quêtes & Missions</b></p>
              <ul>
                <li>Acheter un pixel bonus du jour</li>
                <li>Atteindre 100€ collectés</li>
                <li>Zoomer pour trouver des pixels cachés</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid">
          {pixels.map((pixel, i) => {
            const borderColor = getBorderColor(pixel.price);
            return (
              <div
                key={i}
                className="pixel"
                onClick={() => buyPixel(i)}
                style={{
                  backgroundColor: pixel.color,
                  borderColor,
                  boxShadow: `0 0 8px ${borderColor}`,
                }}
                title={`Prix actuel : ${pixel.price}€\nClique pour acheter et doubler le prix`}
              >
                <span>{pixel.price}€</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}





