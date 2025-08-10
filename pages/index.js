import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles.module.css'; // CSS module local

const GRID_SIZE = 20;
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

// Composant particules Canvas simple
function ParticlesBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    function random(min, max) {
      return Math.random() * (max - min) + min;
    }

    // Crée 50 particules
    particles.current = Array.from({ length: 50 }).map(() => ({
      x: random(0, width),
      y: random(0, height),
      vx: random(-0.3, 0.3),
      vy: random(-0.3, 0.3),
      radius: random(1, 3),
      alpha: random(0.1, 0.3),
    }));

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.fillStyle = `rgba(100, 100, 255, ${p.alpha})`;
        ctx.shadowColor = `rgba(100, 100, 255, ${p.alpha * 2})`;
        ctx.shadowBlur = 4;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    // Resize handler
    function onResize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particlesCanvas} aria-hidden="true" />;
}

export default function Home() {
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

  const buyPixel = (index) => {
    setPixels((oldPixels) => {
      const newPixels = [...oldPixels];
      const pixel = newPixels[index];
      const oldPrice = pixel.price;
      const newPrice = oldPrice * 2;

      const newHistory = [...pixel.history, { price: newPrice, date: new Date() }];

      newPixels[index] = {
        price: newPrice,
        color: selectedColor,
        history: newHistory,
        glowing: true,
      };

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

  const getBorderStyle = (price) => {
    const color = getBorderColor(price);
    return {
      border: `3px solid ${color}`,
      boxShadow:
        price >= 16 ? `0 0 10px 3px ${color}` : 'none',
      borderRadius: 4,
      transition: 'border-color 0.3s, box-shadow 0.3s',
    };
  };

  const formatDate = (d) =>
    d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

  return (
    <div className={`${styles.app} ${darkMode ? styles.dark : ''}`}>
      <ParticlesBackground />
      <button
        className={styles.darkToggle}
        onClick={() => setDarkMode(!darkMode)}
        aria-label="Basculer le mode sombre"
      >
        {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
      </button>

      <header className={styles.header}>
        <h1>Vente de Pixels</h1>
        <div className={styles.progressBarContainer} aria-label="Progression totale des ventes">
          <div
            className={styles.progressBar}
            style={{ width: `${Math.min((totalCollected / 1000) * 100, 100)}%` }}
          />
          <span>Total collecté : {totalCollected} €</span>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.palette}>
          <label>
            Choisir couleur :
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              aria-label="Choisir la couleur du pixel"
            />
          </label>
        </div>

        <div className={styles.grid} role="grid" aria-label="Grille des pixels à acheter">
          {pixels.map((pixel, i) => (
            <div
              key={i}
              role="gridcell"
              tabIndex={0}
              aria-label={`Pixel n°${i + 1}, prix actuel ${pixel.price} euros`}
              className={`${styles.pixel} ${pixel.glowing ? styles.glowPop : ''}`}
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

        {selectedPixel !== null && (
          <aside className={styles.sidePanel} aria-live="polite">
            <button
              className={styles.closeBtn}
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






