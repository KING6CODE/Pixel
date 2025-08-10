// pages/index.js
import { useEffect, useState, useRef } from "react";

const GRID_SIZE = 10;
const BASE_PRICE = 1;

// Palette de couleurs disponibles pour peindre les pixels
const COLORS = [
  "#eee",
  "#f44336", // rouge
  "#4caf50", // vert
  "#2196f3", // bleu
  "#ffeb3b", // jaune
  "#9c27b0", // violet
  "#ff9800", // orange
  "#795548", // marron
  "#000000", // noir
];

export default function PixelGame() {
  const [zoom, setZoom] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [pixels, setPixels] = useState(() =>
    Array(GRID_SIZE * GRID_SIZE).fill(null).map(() => ({
      price: BASE_PRICE,
      color: COLORS[0], // gris clair par défaut
    }))
  );
  const [selectedColor, setSelectedColor] = useState(COLORS[1]); // couleur sélectionnée par défaut (rouge)
  const pageRef = useRef(null);

  // Calcul somme totale des prix (pour barre de progression)
  const totalPrice = pixels.reduce((acc, p) => acc + p.price, 0);
  // Prix max théorique (double prix pixel à chaque achat, max 32x base)
  const MAX_TOTAL_PRICE = GRID_SIZE * GRID_SIZE * BASE_PRICE * 32;

  // Zoom avec molette souris
  useEffect(() => {
    function onWheel(e) {
      if (e.ctrlKey) { // Ctrl + molette pour zoom (optionnel)
        e.preventDefault();
        const delta = -e.deltaY * 0.0025;
        setZoom((z) => {
          let nz = z + delta;
          if (nz < 0.5) nz = 0.5;
          if (nz > 3) nz = 3;
          return nz;
        });
      }
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Appliquer zoom à la page entière
  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.style.transform = `scale(${zoom})`;
      pageRef.current.style.transformOrigin = "top left";
      pageRef.current.style.width = `${100 / zoom}vw`;
      pageRef.current.style.height = `${100 / zoom}vh`;
    }
  }, [zoom]);

  // Acheter un pixel : double son prix et changer sa couleur
  function buyPixel(index) {
    setPixels((oldPixels) => {
      const pixel = oldPixels[index];
      const newPrice = pixel.price * 2;
      return oldPixels.map((p, i) =>
        i === index ? { price: newPrice, color: selectedColor } : p
      );
    });
  }

  // Obtenir couleur bordure selon prix
  function getBorderColor(price) {
    if (price < 2) return "#999";
    if (price < 4) return "#28a745";
    if (price < 8) return "#007bff";
    if (price < 16) return "#6f42c1";
    if (price < 32) return "#ffc107";
    return "#fd7e14";
  }

  return (
    <>
      <style jsx>{`
        :root {
          --bg-light: #f9f9f9;
          --bg-dark: #121212;
          --text-light: #222;
          --text-dark: #eee;
          --menu-bg-light: #fff;
          --menu-bg-dark: #333;
        }

        body {
          margin: 0;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          background-color: ${darkMode ? "var(--bg-dark)" : "var(--bg-light)"};
          color: ${darkMode ? "var(--text-dark)" : "var(--text-light)"};
          overflow: hidden;
        }

        .page {
          padding: 15px;
          width: 100vw;
          height: 100vh;
          box-sizing: border-box;
          background: radial-gradient(
            circle at center,
            ${darkMode ? "#222" : "#fff"} 0%,
            ${darkMode ? "#121212" : "#eee"} 100%
          );
          transition: background-color 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          user-select: none;
        }

        .topbar {
          width: 100%;
          max-width: 600px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          gap: 10px;
        }

        button {
          cursor: pointer;
          background-color: transparent;
          border: 1.5px solid currentColor;
          border-radius: 6px;
          padding: 8px 14px;
          font-weight: 600;
          color: inherit;
          transition: background-color 0.3s ease;
          min-width: 120px;
        }

        button:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .dropdown {
          position: relative;
          display: inline-block;
          min-width: 120px;
          z-index: 1000;
        }

        .dropdown button {
          width: 100%;
          text-align: left;
          padding-right: 30px;
          position: relative;
        }

        .dropdown button::after {
          content: "▼";
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          pointer-events: none;
        }

        .dropdown-content {
          display: none;
          position: absolute;
          background-color: ${darkMode ? "var(--menu-bg-dark)" : "var(--menu-bg-light)"};
          min-width: 200px;
          box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.25);
          padding: 12px 16px;
          border-radius: 8px;
          color: ${darkMode ? "#eee" : "#222"};
          top: 100%;
          left: 0;
          max-height: 200px;
          overflow-y: auto;
        }

        .dropdown:hover .dropdown-content {
          display: block;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(${GRID_SIZE}, 35px);
          grid-template-rows: repeat(${GRID_SIZE}, 35px);
          gap: 5px;
          justify-content: center;
          user-select: none;
          max-width: 600px;
          max-height: 600px;
          overflow: hidden;
          border-radius: 10px;
          background-color: ${darkMode ? "#222" : "#fff"};
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
          padding: 15px;
        }

        .pixel {
          width: 35px;
          height: 35px;
          background-color: var(--pixel-bg, #eee);
          border: 3px solid var(--pixel-border, #999);
          box-sizing: border-box;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #222;
          transition: all 0.25s ease;
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.1));
          user-select: none;
        }

        .pixel:hover {
          filter: drop-shadow(0 0 6px rgba(50, 150, 250, 0.8));
          transform: scale(1.1);
          z-index: 10;
        }

        .dark .pixel {
          color: #eee;
          filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
        }

        .color-picker {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
          flex-wrap: wrap;
          justify-content: center;
          max-width: 600px;
        }

        .color-swatch {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color 0.3s ease;
          box-shadow: 0 0 3px rgba(0, 0, 0, 0.15);
        }

        .color-swatch.selected {
          border-color: #2196f3;
          box-shadow: 0 0 6px #2196f3;
        }

        .progress-container {
          width: 100%;
          max-width: 600px;
          background-color: ${darkMode ? "#333" : "#ddd"};
          border-radius: 20px;
          overflow: hidden;
          height: 20px;
          margin-top: 20px;
          box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.2);
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #2196f3, #21cbf3);
          width: ${Math.min(100, (totalPrice / MAX_TOTAL_PRICE) * 100)}%;
          transition: width 0.3s ease;
        }

        .progress-text {
          margin-top: 6px;
          font-weight: 600;
          text-align: center;
        }
      `}</style>

      <div className={`page ${darkMode ? "dark" : ""}`} ref={pageRef}>
        <div className="topbar">
          <button onClick={() => setDarkMode(!darkMode)}>
            Mode {darkMode ? "Clair" : "Sombre"}
          </button>

          <div className="dropdown">
            <button aria-haspopup="true" aria-expanded="false">
              Menu
            </button>
            <div className="dropdown-content" role="menu" aria-label="Menu déroulant">
              <p>
                <b>Quêtes & Missions</b>
              </p>
              <ul>
                <li>Acheter un pixel avec la couleur sélectionnée</li>
                <li>Atteindre 100€ collectés</li>
                <li>Tester le zoom avec Ctrl + molette</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Palette de couleurs */}
        <div className="color-picker" aria-label="Sélecteur de couleurs">
          {COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch ${selectedColor === c ? "selected" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setSelectedColor(c)}
              aria-label={`Sélectionner la couleur ${c}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedColor(c);
              }}
            />
          ))}
        </div>

        {/* Grille de pixels */}
        <div className="grid" role="grid" aria-label="Grille de pixels à acheter">
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
                title={`Prix: ${pixel.price}€\nClique pour acheter avec la couleur sélectionnée`}
                role="gridcell"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") buyPixel(i);
                }}
              >
                <span>{pixel.price}€</span>
              </div>
            );
          })}
        </div>

        {/* Barre de progression */}
        <div className="progress-container" aria-label="Barre de progression du total des achats">
          <div className="progress-bar" />
        </div>
        <div className="progress-text" aria-live="polite" aria-atomic="true">
          Total collecté : {totalPrice}€ / {MAX_TOTAL_PRICE}€
        </div>
      </div>
    </>
  );
}







