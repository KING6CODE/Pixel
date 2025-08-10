import { useState, useEffect, useRef } from 'react';

const size = 20;

function generatePseudo() {
  return 'User' + Math.floor(1000 + Math.random() * 9000);
}

export default function Home() {
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
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [pixelOfTheDay, setPixelOfTheDay] = useState(null);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [questsCompleted, setQuestsCompleted] = useState({});

  const wrapperRef = useRef(null);

  // Initial pseudo & pixel du jour
  useEffect(() => {
    let p = localStorage.getItem('pseudo');
    if (!p) {
      p = generatePseudo();
      localStorage.setItem('pseudo', p);
    }
    setPseudo(p);

    setPixelOfTheDay(Math.floor(Math.random() * size * size));
  }, []);

  // Gestion zoom sur toute la page, centré sur la souris
  useEffect(() => {
    function onWheel(e) {
      e.preventDefault();
      const rect = wrapperRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom((z) => {
        let newZoom = z + (e.deltaY < 0 ? 0.1 : -0.1);
        newZoom = Math.min(Math.max(newZoom, 0.5), 3);

        setOffset((old) => {
          const scaleChange = newZoom / z;
          const newX = mouseX - scaleChange * (mouseX - old.x);
          const newY = mouseY - scaleChange * (mouseY - old.y);
          return { x: newX, y: newY };
        });
        return newZoom;
      });
    }

    const wrapper = wrapperRef.current;
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', onWheel);
  }, []);

  // Acheter pixel avec bonus pixel du jour (-20%)
  function buyPixel(i) {
    setPixels((old) => {
      const p = old[i];
      if (p.owner === pseudo) return old; // Pas racheter son propre pixel

      let price = p.price;
      if (i === pixelOfTheDay) price = Math.ceil(price * 0.8);

      const newPrice = price * 2;
      const newPixels = [...old];
      newPixels[i] = { color: selectedColor, price: newPrice, owner: pseudo };
      return newPixels;
    });

    let priceToAdd = pixels[i].price;
    if (i === pixelOfTheDay) priceToAdd = Math.ceil(priceToAdd * 0.8);

    setTotalCollected((old) => old + priceToAdd);
    setGlowingIndex(i);

    // Ajout XP
    setXp((old) => old + priceToAdd);

    // Gestion niveau simple (ex: tous les 100 xp)
    setLevel((oldLevel) => {
      const newLevel = Math.floor((xp + priceToAdd) / 100) + 1;
      return newLevel > oldLevel ? newLevel : oldLevel;
    });

    // Gestion quête simple : acheter pixel du jour
    if (i === pixelOfTheDay && !questsCompleted['pixelOfTheDay']) {
      setQuestsCompleted((old) => ({ ...old, pixelOfTheDay: true }));
      alert('🎉 Quête terminée : Pixel du jour acheté ! Bonus XP +50');
      setXp((old) => old + 50);
    }
  }

  // Glow pop effet
  useEffect(() => {
    if (glowingIndex === null) return;
    const timer = setTimeout(() => setGlowingIndex(null), 600);
    return () => clearTimeout(timer);
  }, [glowingIndex]);

  // Classements
  const ranking = Object.entries(
    pixels.reduce((acc, p) => {
      if (p.owner) acc[p.owner] = (acc[p.owner] || 0) + p.price;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Inventaire pixels possédés
  const myPixels = pixels
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => p.owner === pseudo);

  return (
    <>
      <style jsx global>{`
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          background: ${darkMode ? '#121212' : '#f9f9f9'};
          color: ${darkMode ? '#eee' : '#333'};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
          user-select: none;
        }
        button:focus {
          outline: 2px solid #4285f4;
          outline-offset: 2px;
        }
      `}</style>

      <div
        ref={wrapperRef}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
          width: '100vw',
          height: '100vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            zIndex: 999,
            background: 'transparent',
            border: 'none',
            color: darkMode ? '#eee' : '#333',
            fontSize: '1.3rem',
            cursor: 'pointer',
          }}
          aria-label="Basculer mode sombre"
        >
          {darkMode ? '☀️ Clair' : '🌙 Sombre'}
        </button>

        <div
          style={{
            maxWidth: 900,
            margin: '2rem auto',
            padding: '0 1rem',
            userSelect: 'none',
          }}
        >
          <h1 style={{ textAlign: 'center' }}>Vente de Pixels - Niveau {level}</h1>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={size * size * 100}
            aria-valuenow={totalCollected}
            style={{
              background: darkMode ? '#333' : '#eee',
              borderRadius: 12,
              height: 20,
              margin: '0 auto 1rem',
              maxWidth: 600,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: '#3367d6',
                height: '100%',
                width: `${(totalCollected / (size * size * 100)) * 100}%`,
                transition: 'width 0.4s ease',
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                lineHeight: '20px',
              }}
            >
              {totalCollected} €
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <strong>Pixel du jour</strong> (20% de réduction) :{' '}
            <span
              style={{
                padding: '0 0.3rem',
                border: '2px solid #ff6f61',
                borderRadius: 4,
                backgroundColor: '#fff0f0',
                color: '#ff6f61',
                fontWeight: 'bold',
                userSelect: 'none',
              }}
            >
              #{pixelOfTheDay + 1}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${size}, 20px)`,
              gridTemplateRows: `repeat(${size}, 20px)`,
              gap: 2,
              justifyContent: 'start',
              margin: '0 auto 2rem',
              cursor: 'pointer',
              userSelect: 'none',
              border: darkMode ? '1px solid #555' : '1px solid #ccc',
              background: darkMode ? '#222' : '#fff',
              width: 'fit-content',
            }}
            aria-label="Grille de pixels à acheter"
          >
            {pixels.map((p, i) => {
              const isPixelOfDay = i === pixelOfTheDay;
              const glowClass = glowingIndex === i ? 'glowPop' : '';
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
                    border: isPixelOfDay
                      ? '2px solid #ff6f61'
                      : darkMode
                      ? '1px solid #555'
                      : '1px solid #ddd',
                    backgroundColor: p.color,
                    boxShadow: glowingIndex === i ? '0 0 10px 3px #3367d6' : 'none',
                    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                    userSelect: 'none',
                  }}
                  className={glowClass}
                />
              );
            })}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label>
              Choisir couleur:{' '}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                aria-label="Sélectionner la couleur du pixel"
              />
            </label>
          </div>

          <h2>Mes pixels ({myPixels.length})</h2>
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

          <h2>Classement des meilleurs acheteurs</h2>
          {ranking.length === 0 && <p>Aucun pixel acheté pour le moment.</p>}
          <ol>
            {ranking.map(([user, amount]) => (
              <li key={user}>
                {user} - {amount} €
              </li>
            ))}
          </ol>

          <h2>Quêtes journalières</h2>
          <ul>
            <li
              style={{
                textDecoration: questsCompleted.pixelOfTheDay ? 'line-through' : 'none',
              }}
            >
              Acheter le pixel du jour (-20% prix) -{' '}
              {questsCompleted.pixelOfTheDay ? 'Terminé ✅' : 'En cours'}
            </li>
            <li>
              Atteindre 100€ dépensés -{' '}
              {totalCollected >= 100 ? 'Terminé ✅' : 'En cours'}
            </li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .glowPop {
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
      `}</style>
    </>
  );
}



