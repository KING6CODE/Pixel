// pages/index.js
import { useEffect, useState, useRef } from "react";

const GRID_SIZE = 10;
const BASE_PRICE = 1;

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

// Son clic achat (base64 wav très simple)
const CLICK_SOUND =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";

function ParticlesBackground() {
  const canvasRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Initialiser particules
    const PARTICLE_COUNT = 60;
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 2,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      alpha: 0.1 + Math.random() * 0.4,
      alphaDirection: Math.random() > 0.5 ? 1 : -1,
    }));

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#2196f3";

      particles.current.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.alpha += p.alphaDirection * 0.005;
        if (p.alpha <= 0.1) {
          p.alpha = 0.1;
          p.alphaDirection = 1;
        }
        if (p.alpha >= 0.5) {
          p.alpha = 0.5;
          p.alphaDirection = -1;
        }

        // Rebondir sur les bords
        if (p.x < 0 || p.x > width) p.speedX *= -1;
        if (p.y < 0 || p.y > height) p.speedY *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(33, 150, 243, ${p.alpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    // Resize canvas
    function onResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}

export default function PixelGame() {
  const [zoom, setZoom] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [pixels, setPixels] = useState(() =>
    Array(GRID_SIZE * GRID_SIZE)
      .fill(null)
      .map(() => ({
        price: BASE_PRICE,
        color: COLORS[0],
      }))
  );
  const [selectedColor, setSelectedColor] = useState(COLORS[1]);
  const [missions, setMissions] = useState([
    {
      id: 1,
      desc: "Acheter 1 pixel",
      done: false,
      reward: "Bonus 5€ sur pixel aléatoire",
      condition: (stats) => stats.pixelsBought >= 1,
    },
    {
      id: 2,
      desc: "Acheter 5 pixels",
      done: false,
      reward: "Bonus 10€ sur pixel aléatoire",
      condition: (stats) => stats.pixelsBought >= 5,
    },
    {
      id: 3,
      desc: "Atteindre 100€ total collecté",
      done: false,
      reward: "Bonus 20€ sur pixel aléatoire",
      condition: (stats) => stats.totalPrice >= 100,
    },
  ]);
  const [pixelsBoughtCount, setPixelsBoughtCount] = useState(0);

  const pageRef = useRef(null);
  const audioRef = useRef(null);

  // Calcul total prix
  const totalPrice = pixels.reduce((acc, p) => acc + p.price, 0);
  const MAX_TOTAL_PRICE = GRID_SIZE * GRID_SIZE * BASE_PRICE * 32;

  // Jouer son clic achat
  function playClickSound() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }

  // Acheter pixel avec gestion missions
  function buyPixel(index) {
    setPixels((oldPixels) => {
      const pixel = oldPixels[index];
      const newPrice = pixel.price * 2;

      if (newPrice > BASE_PRICE * 32) return oldPixels; // Limite max

      playClickSound();

      // Mise à jour pixels
      const newPixels = oldPixels.map((p, i) =>
        i === index ? { price: newPrice, color: selectedColor } : p
      );

      // Met à jour missions avec stats actualisés
      const newPixelsBoughtCount = pixelsBoughtCount + 1;
      const stats = {
        pixelsBought: newPixelsBoughtCount,
        totalPrice: newPixels.reduce((acc, p) => acc + p.price, 0),
      };

      // Mise à jour missions done
      setMissions((oldMissions) =>
        oldMissions.map((m) => {
          if (!m.done && m.condition(stats)) {
            // Appliquer récompense
            rewardBonus(m.id, newPixels);
            return { ...m, done: true };
          }
          return m;
        })
      );

      setPixelsBoughtCount(newPixelsBoughtCount);

      return newPixels;
    });
  }

  // Donne bonus en ajoutant argent sur pixel aléatoire
  function rewardBonus(missionId, currentPixels) {
    const bonusMap = {
      1: 5,
      2: 10,
      3: 20,
    };
    const bonus = bonusMap[missionId] || 0;

    if (bonus <= 0) return;

    const idx = Math.floor(Math.random() * currentPixels.length);

    setPixels((oldPixels) => {
      const oldPixel = oldPixels[idx];
      const newPrice = Math.min(oldPixel.price + bonus, BASE_PRICE * 32);
      const newPixel = { ...oldPixel, price: newPrice };
      return oldPixels.map((p, i) => (i === idx ? newPixel : p));
    });

    alert(`Mission accomplie ! Tu as reçu un bonus de ${bonus}€ sur un pixel aléatoire 🎉`);
  }

  // Zoom avec molette + Ctrl
  useEffect(() => {
    function onWheel(e) {
      if (e.ctrlKey) {
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

  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.style.transform = `scale(${zoom})`;
      pageRef.current.style.transformOrigin = "top left";
      pageRef.current.style.width = `${100 / zoom}vw`;
      pageRef.current.style.height = `${100 / zoom}vh`;
    }
  }, [zoom]);

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
      <ParticlesBackground />
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
          position: relative;
          margin: 10px;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          user-select: none;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .btn {
          cursor: pointer;
          background-color: #2196f3;
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          transition: background-color 0.3s ease;
        }
        .btn:hover {
          background-color: #1769aa;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(${GRID_SIZE}, 1fr);
          grid-template-rows: repeat(${GRID_SIZE}, 1fr);
          gap: 1px;
          border: 1px solid #ccc;
          background-color: #ccc;
          max-width: 650px;
          max-height: 650px;
          user-select: none;
        }

        .pixel {
          aspect-ratio: 1 / 1;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: #333;
          user-select: none;
        }
        .pixel:hover {
          border-color: #2196f3;
        }

        .pixel.bought {
          color: white;
          font-weight: 700;
          text-shadow: 0 0 4px #0008;
        }

        .colors {
          display: flex;
          gap: 10px;
        }

        .color-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color 0.3s ease;
        }
        .color-btn.selected {
          border-color: #2196f3;
          box-shadow: 0 0 6px #2196f3aa;
        }

        .missions {
          max-width: 650px;
          background-color: ${darkMode ? "#222" : "#eee"};
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          color: ${darkMode ? "#eee" : "#111"};
        }

        .mission {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .mission.done {
          color: #28a745;
          font-weight: 700;
        }

        .mission .desc {
          flex-grow: 1;
        }
      `}</style>
      <div className="page" ref={pageRef}>
        <div className="header">
          <h1>Pixel Game 🎮</h1>
          <button className="btn" onClick={() => setDarkMode((d) => !d)}>
            {darkMode ? "Mode clair" : "Mode sombre"}
          </button>
        </div>
        <div className="colors" aria-label="Palette de couleurs">
          {COLORS.slice(1).map((c) => (
            <button
              key={c}
              aria-label={`Couleur ${c}`}
              className={`color-btn ${selectedColor === c ? "selected" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setSelectedColor(c)}
            />
          ))}
        </div>

        <div className="grid" role="grid" aria-label="Grille de pixels à acheter">
          {pixels.map((p, i) => (
            <div
              key={i}
              role="gridcell"
              aria-pressed="false"
              tabIndex={0}
              className={`pixel ${p.price > BASE_PRICE ? "bought" : ""}`}
              onClick={() => buyPixel(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") buyPixel(i);
              }}
              style={{
                backgroundColor: p.color,
                borderColor: getBorderColor(p.price),
              }}
              title={`Pixel n°${i + 1} - Prix : ${p.price}€`}
            >
              {p.price}€
            </div>
          ))}
        </div>

        <div className="missions" aria-live="polite" aria-label="Liste des missions">
          <h2>Missions</h2>
          {missions.map((m) => (
            <div
              key={m.id}
              className={`mission ${m.done ? "done" : ""}`}
              aria-checked={m.done}
              role="checkbox"
            >
              <div className="desc">{m.desc}</div>
              <div>{m.done ? "✅ " : "❌ "}</div>
            </div>
          ))}
        </div>
      </div>

      <audio ref={audioRef} src={CLICK_SOUND} preload="auto" />
    </>
  );
}








