import React, { useState, useEffect, useRef } from 'react';

const size = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ParticlesBackground({ width, height }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Init particles
    const count = 50;
    particles.current = [];
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 2 + Math.random() * 2,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
      });
    }

    let animationFrameId;
    let mouseX = width / 2;
    let mouseY = height / 2;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.current.forEach((p) => {
        // Move particle
        p.x += p.speedX;
        p.y += p.speedY;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.speedX = -p.speedX;
        if (p.y < 0 || p.y > height) p.speedY = -p.speedY;

        // Draw particle
        ctx.beginPath();
        const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
        const alpha = clamp(1 - dist / 200, 0, 0.7);
        ctx.fillStyle = `rgba(51,103,214,${alpha})`;
        ctx.shadowColor = `rgba(51,103,214,${alpha})`;
        ctx.shadowBlur = 4;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100vw',
        height: '100vh',
      }}
      aria-hidden="true"
    />
  );
}

export default function PixelGame() {
  const [pixels, setPixels] = useState(() =>
    Array(size * size).fill(0).map(() => ({
      price: 1,
      owner: null,
      color: '#eeeeee',
    }))
  );
  const [selectedColor, setSelectedColor] = useState('#3367d6');
  const [myPixels, setMyPixels] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [questsCompleted, setQuestsCompleted] = useState({ pixelOfTheDay: false });
  const [totalCollected, setTotalCollected] = useState(0);
  const [pixelOfTheDay, setPixelOfTheDay] = useState(Math.floor(Math.random() * size * size));
  const [glowingIndex, setGlowingIndex] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // Zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef(null);

  const minScale = 0.5;
  const maxScale = 3;

  // User name (simple prompt)
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username') || '';
    }
    return '';
  });

  useEffect(() => {
    if (userName) localStorage.setItem('username', userName);
  }, [userName]);

  // Buy pixel handler
  function buyPixel(i) {
    if (!userName) {
      const name = prompt('Entrez votre pseudo pour acheter un pixel :');
      if (!name) return alert('Pseudo requis');
      setUserName(name);
      return;
    }

    setPixels((oldPixels) => {
      const p = oldPixels[i];
      const basePrice = p.price;
      const discount = i === pixelOfTheDay ? 0.8 : 1;
      const finalPrice = basePrice * discount;

      // Just for demo, no actual payment
      // Update pixel: price double, color selected, owner userName
      const newPrice = basePrice * 2;
      const newPixels = [...oldPixels];
      newPixels[i] = {
        price: newPrice,
        owner: userName,
        color: selectedColor,
      };

      // Update myPixels
      setMyPixels((oldMyPixels) => {
        const exists = oldMyPixels.find((px) => px.index === i);
        if (exists) {
          return oldMyPixels.map((px) =>
            px.index === i ? { ...px, price: newPrice, color: selectedColor } : px
          );
        } else {
          return [...oldMyPixels, { index: i, price: newPrice, color: selectedColor }];
        }
      });

      // Update ranking
      setRanking((oldRanking) => {
        const found = oldRanking.find(([name]) => name === userName);
        if (found) {
          return oldRanking
            .map(([name, amt]) => (name === userName ? [name, amt + finalPrice] : [name, amt]))
            .sort((a, b) => b[1] - a[1]);
        } else {
          return [...oldRanking, [userName, finalPrice]].sort((a, b) => b[1] - a[1]);
        }
      });

      // Update total collected
      setTotalCollected((old) => old + finalPrice);

      // Glow effect
      setGlowingIndex(i);
      setTimeout(() => setGlowingIndex(null), 700);

      // Quests
      if (i === pixelOfTheDay) {
        setQuestsCompleted((old) => ({ ...old, pixelOfTheDay: true }));
      }

      return newPixels;
    });
  }

  // Zoom handler centered on mouse
  function handleWheel(e) {
    e.preventDefault();

    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let newScale = scale - e.deltaY * 0.001;
    newScale = clamp(newScale, minScale, maxScale);

    // Calculate translate to keep zoom centered on mouse
    const scaleRatio = newScale / scale;
    const newTranslateX = translate.x - (mouseX - translate.x) * (scaleRatio - 1);
    const newTranslateY = translate.y - (mouseY - translate.y) * (scaleRatio - 1);

    setScale(newScale);
    setTranslate({ x: newTranslateX, y: newTranslateY });
  }

  // Toggle dark mode
  function toggleDarkMode() {
    setDarkMode((old) => !old);
  }

  return (
    <>
      <ParticlesBackground width={window.innerWidth} height={window.innerHeight} />

      <div
        style={{
          height: '100vh',
          overflow: 'hidden',
          background: darkMode ? '#121212' : '#f5f5f5',
          color: darkMode ? '#ddd' : '#222',
          transition: 'background 0.3s, color 0.3s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem',
          userSelect: 'none',
        }}
      >
        <header style={{ marginBottom: 20, width: '100%', maxWidth: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>PixelGame 🎮</h1>
          <button
            onClick={toggleDarkMode}
            aria-label="Basculer mode sombre"
            style={{
              cursor: 'pointer',
              padding: '0.3rem 0.7rem',
              fontSize: 16,
              borderRadius: 6,
              border: '1px solid',
              backgroundColor: darkMode ? '#333' : '#fff',
              color: darkMode ? '#ddd' : '#222',
            }}
          >
            {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
          </button>
        </header>

        <div
          ref={wrapperRef}
          onWheel={handleWheel}
          style={{
            border: darkMode ? '2px solid #555' : '2px solid #ccc',
            width: size * 22,
            height: size * 22,
            overflow: 'hidden',
            transformOrigin: '0 0',
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            background: darkMode ? '#222' : '#fff',
            userSelect: 'none',
          }}
          aria-label="Zone de jeu des pixels"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${size}, 20px)`,
              gridTemplateRows: `repeat(${size}, 20px)`,
              gap: 2,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {pixels.map((p, i) => {
              const isPixelOfDay = i === pixelOfTheDay;
              const glowClass = glowingIndex === i ? 'glowPop' : '';
              const borderColor = (() => {
                if (isPixelOfDay) return '#ff6f61';
                if (p.price >= 64) return 'gold';
                if (p.price >= 32) return 'violet';
                if (p.price >= 16) return 'blue';
                if (p.price >= 8) return 'green';
                if (p.price >= 4) return 'gray';
                return darkMode ? '#555' : '#ddd';
              })();

              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => buyPixel(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') buyPixel(i);
                  }}
                  aria-label={`Pixel ${i + 1}, prix ${p.price} euros, ${
                    p.owner ? 'possédé par ' + p.owner : 'non possédé'
                  }`}
                  style={{
                    width: 20,
                    height: 20,
                    border: `2px solid ${borderColor}`,
                    backgroundColor: p.color,
                    boxShadow: glowingIndex === i ? '0 0 10px 3px #3367d6' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                  className={glowClass}
                />
              );
            })}
          </div>
        </div>

        {/* Color picker */}
        <div style={{ marginTop: 15 }}>
          <label htmlFor="colorPicker">Couleur choisie: </label>
          <input
            id="colorPicker"
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            aria-label="Sélecteur de couleur"
          />
        </div>

        {/* Menus déroulants */}
        <div
          style={{
            marginTop: 20,
            width: '100%',
            maxWidth: 800,
            color: darkMode ? '#ddd' : '#222',
          }}
        >
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}>
              Mes pixels ({myPixels.length})
            </summary>
            {myPixels.length === 0 && <p>Vous ne possédez aucun pixel.</p>}
            <ul>
              {myPixels.map((p) => (
                <li key={p.index}>
                  Pixel #{p.index + 1} - Couleur:{' '}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 15,
                      height: 15,
                      backgroundColor: p.color,
                      border: '1px solid #000',
                      verticalAlign: 'middle',
                      marginRight: 5,
                    }}
                  />
                  Prix actuel: {p.price} €
                </li>
              ))}
            </ul>
          </details>

          <details style={{ marginTop: 15 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}>
              Classement des meilleurs acheteurs
            </summary>
            {ranking.length === 0 && <p>Aucun acheteur pour le moment.</p>}
            <ol>
              {ranking.map(([name, amount], i) => (
                <li key={name}>
                  {name} - Investi {amount.toFixed(2)} €
                </li>
              ))}
            </ol>
          </details>

          <details style={{ marginTop: 15 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}>
              Quêtes journalières
            </summary>
            <ul>
              <li>
                Pixel du jour:{' '}
                <strong
                  style={{
                    color: questsCompleted.pixelOfTheDay ? 'limegreen' : 'orange',
                  }}
                >
                  {questsCompleted.pixelOfTheDay ? 'Terminé' : 'À faire'}
                </strong>
              </li>
              <li>
                Bonus pour achat du pixel du jour : 20% de réduction sur le prix !
              </li>
            </ul>
          </details>

          <div style={{ marginTop: 20, fontStyle: 'italic' }}>
            Total collecté par la communauté: <strong>{totalCollected.toFixed(2)} €</strong>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glowPop {
          animation: glowPopAnim 0.7s ease forwards;
        }
        @keyframes glowPopAnim {
          0% {
            box-shadow: 0 0 0 0 #3367d6;
          }
          50% {
            box-shadow: 0 0 15px 6px #3367d6;
          }
          100% {
            box-shadow: 0 0 0 0 #3367d6;
          }
        }
        summary {
          list-style: none;
          user-select: none;
          outline: none;
        }
        summary::-webkit-details-marker {
          display: none;
        }
        details[open] summary::before {
          content: '▼ ';
          color: #3367d6;
        }
        summary::before {
          content: '▶ ';
          color: #3367d6;
        }
      `}</style>
    </>
  );
}




