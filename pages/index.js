// pages/index.js
import { useState, useRef, useEffect } from "react";
import styles from "../styles/styles.module.css";

export default function Home() {
  const gridSize = 20;
  const [pixels, setPixels] = useState(Array(gridSize * gridSize).fill("#ccc"));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const containerRef = useRef(null);
  const totalPixels = gridSize * gridSize;

  // Son à l'achat
  const playPurchaseSound = () => {
    const audio = new Audio("/purchase.mp3");
    audio.play();
  };

  // Fond animé avec particules
  useEffect(() => {
    const canvas = document.getElementById("bgCanvas");
    const ctx = canvas.getContext("2d");
    let particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1,
      dx: Math.random() * 0.5 - 0.25,
      dy: Math.random() * 0.5 - 0.25,
    }));

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = darkMode ? "#111" : "#f8f9fa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = darkMode ? "#00f5ff" : "#0077ff";
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      requestAnimationFrame(animate);
    }
    animate();
    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, [darkMode]);

  // Achat de pixel
  const handlePixelClick = (index) => {
    if (pixels[index] !== "#ccc") return;
    const newPixels = [...pixels];
    newPixels[index] = selectedColor;
    setPixels(newPixels);
    setProgress((prev) => prev + 1);
    playPurchaseSound();
  };

  // Zoom souris
  const handleWheel = (e) => {
    e.preventDefault();
    let newZoom = zoom + e.deltaY * -0.001;
    newZoom = Math.min(Math.max(0.5, newZoom), 3); // limites de zoom
    setZoom(newZoom);
  };

  return (
    <div
      className={`${styles.page} ${darkMode ? styles.dark : ""}`}
      ref={containerRef}
      onWheel={handleWheel}
    >
      <canvas id="bgCanvas" className={styles.background}></canvas>

      <header className={styles.header}>
        <h1>🎯 Pixel Quest</h1>
        <div className={styles.controls}>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
          />
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${(progress / totalPixels) * 100}%` }}
        ></div>
        <span>
          {progress} / {totalPixels} pixels achetés
        </span>
      </div>

      <div
        className={styles.grid}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {pixels.map((color, i) => (
          <div
            key={i}
            className={`${styles.pixel} ${
              color !== "#ccc" ? styles.owned : ""
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handlePixelClick(i)}
          ></div>
        ))}
      </div>

      <aside className={styles.sidebar}>
        <h2>🎁 Missions</h2>
        <ul>
          <li>Acheter 5 pixels rouges</li>
          <li>Former un carré 3x3</li>
          <li>Acheter le pixel du jour ⭐</li>
        </ul>
      </aside>
    </div>
  );
}

