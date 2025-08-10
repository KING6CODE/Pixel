// pages/index.js
import React, { useState, useEffect } from 'react';
import Particles from 'react-tsparticles'; // lib particules légère
import './styles.css';

const GRID_SIZE = 20; // 20x20 pixels
const BASE_PRICE = 1;

const BORDER_COLORS = [
  { price: 1, color: 'gray' },
  { price: 2, color: 'green' },
  { price: 4, color: 'blue' },
  { price: 8, color: 'purple' },
  { price: 16, color: 'gold' },
];

function getBorderColor(price) {
  for (let i = BORDER_COLORS.length - 1; i >= 0; i--) {
    if (price >= BORDER_COLORS[i].price) return BORDER_COLORS[i].color;
  }
  return 'gray';
}

export default function Home() {
  // pixels = [{price, color, history: [{price, date}]}]
  const [pixels, setPixels] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill(null).map(() => ({
      price: BASE_PRICE,
      color: '#ffffff',
      history: [],
      glowing: false,
    }))
  );

  const [selectedPixel, setSelectedPixel] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const [darkMode, setDarkMode] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);

  // Gestion de l'achat pixel
  const buyPixel = (index) => {
    setPixels((oldPixels) => {
      const newPixels = [...oldPixels];
      const pixel = newPixels[index];
      const oldPrice = pixel.price;
      const newPrice = oldPrice * 2;

      // Mise à jour historique
      const newHistory = [...pixel.history, { price: newPrice, date: new Date() }];

      newPixels[index] = {
        price: newPrice,
        color: selectedColor,
        history: newHistory,
        glowing: true,
      };

      // Ajouter glow pendant 600ms puis retirer
      setTimeout(() => {
        setPixels((pxs) => {
          const copy = [...pxs];
          if (copy[index]) copy[index].glowing = false;
          return copy;
        });
      }, 600);

      setTotalCollected((old) => old + newPrice);

      return newPixels;
    });
  };

  // Récupérer contour
  const getBorderStyle = (price) => {
    const color = getBorderColor(price);
    const style = {
      border: `3px solid ${color}`,
      boxShadow:
        price >= 16 ? `0 0 10px 3px ${color}` : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      borderRadius: 4,
    };
    return style;
  };

  // Format date
  const formatDate = (d) =>
    d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

  return (
    <div className={darkMode ? 'app dark' : 'app'}>
      {/* Toggle mode sombre */}
      <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
      </button>

      {/* Particules en fond */}
      <Particles
        className="particles-bg"
        options={{
          fpsLimit: 60,
          interactivity: { events: { onHover: { enable: true, mode: 'repulse' } } },
          particles: {
            color: { value: darkMode ? '#aaa' : '#555' },
            links: { enable: false },
            move: { enable: true, speed: 1, direction: 'none', outMode: 'bounce' },
            number: { value: 40 },
            size: { value: 3, random: true },
            opacity: { value: 0.2 },
          },
        }}
      />

      <header>
        <h1>Vente de Pixels</h1>
        <div className="progress-bar-container" aria-label="Progression totale des ventes">
          <div className="progress-bar" style={{ width: `${Math.min(totalCollected / 1000 * 100, 100)}%` }} />
          <span>Total collecté : {totalCollected} €</span>
        </div>
      </header>

      <div className="container">
        <div className="palette">
          <label>
            Choisir couleur:
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              aria-label="Choisir la couleur du pixel"
            />
          </label>
        </div>

        <div className="grid" role="grid" aria-label="Grille des pixels à acheter">
          {pixels.map((pixel, i) => (
            <div
              key={i}
              role="gridcell"
              tabIndex={0}
              aria-label={`Pixel n°${i + 1}, prix actuel ${pixel.price} euros`}
              className={`pixel ${pixel.glowing ? 'glow-pop' : ''}`}
              style={{
                backgroundColor: pixel.color,
                ...getBorderStyle(pixel.price),
              }}
              onClick={() => {
                buyPixel(i);
                setSelectedPixel(i);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  buyPixel(i);
                  setSelectedPixel(i);
                }
              }}
            >
              {pixel.price} €
            </div>
          ))}
        </div>

        {/* Panneau latéral */}
        {selectedPixel !== null && (
          <aside className="side-panel" aria-live="polite">
            <button
              className="close-btn"
              aria-label="Fermer le panneau d'historique"
              onClick={() => setSelectedPixel(null)}
            >
              ✖
            </button>
            <h2>Historique du pixel #{selectedPixel + 1}</h2>
            <ul>
              {pixels[selectedPixel].history.length === 0 ? (
                <li>Pas d'historique, pixel acheté à {pixels[selectedPixel].price / 2} €</li>
              ) : (
                pixels[selectedPixel].history.map((h, idx) => (
                  <li key={idx}>
                    {h.price} € le {formatDate(h.date)}
                  </li>
                ))
              )}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}





