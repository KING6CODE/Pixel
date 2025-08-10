import React, { useState, useEffect, useRef } from "react";
import BackgroundParticles from "./BackgroundParticles";
import "./styles.css";

const GRID_SIZE = 16;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const COLORS = [
  "#1E40AF", // bleu profond
  "#3B82F6", // bleu clair
  "#E6B89C", // or rose
  "#F9F7F1", // blanc cassé
  "#374151", // gris foncé
];

export default function App() {
  const [pixels, setPixels] = useState(
    Array(TOTAL_PIXELS).fill({ color: "#e0e7ff", bought: false })
  );
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  // Charger son achat pixel
  useEffect(() => {
    audioRef.current = new Audio("/buy-sound.mp3");
    audioRef.current.volume = 0.15;
  }, []);

  // Acheter un pixel (changer son état et jouer son)
  const buyPixel = (index) => {
    setPixels((prev) => {
      if (prev[index].bought) return prev; // déjà acheté
      const newPixels = [...prev];
      newPixels[index] = { color: selectedColor, bought: true };
      return newPixels;
    });
    audioRef.current?.play();
  };

  // Met à jour la progression (% pixels achetés)
  useEffect(() => {
    const boughtCount = pixels.filter((p) => p.bought).length;
    setProgress(Math.round((boughtCount / TOTAL_PIXELS) * 100));
  }, [pixels]);

  // Pour le menu dropdown simple
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <BackgroundParticles />
      <div className="page">
        <header className="header">
          <h1>🏠 OneClickHome</h1>
          <nav>
            <button
              className="menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <ul className={`menu ${menuOpen ? "open" : ""}`}>
              <li><a href="#missions">Missions</a></li>
              <li><a href="#progress">Progression</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </nav>
        </header>

        <section className="colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-btn ${selectedColor === c ? "selected" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setSelectedColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </section>

        <section className="grid" aria-label="Pixel grid">
          {pixels.map((p, i) => (
            <div
              key={i}
              className={`pixel ${p.bought ? "bought" : ""}`}
              style={{ backgroundColor: p.color }}
              onClick={() => buyPixel(i)}
              role="button"
              tabIndex={0}
              aria-pressed={p.bought}
              onKeyDown={(e) => {
                if (e.key === "Enter") buyPixel(i);
              }}
              title={p.bought ? "Pixel acheté" : "Clique pour acheter ce pixel"}
            />
          ))}
        </section>

        <button
          className="btn"
          onClick={() => alert("Fonction d'achat globale à implémenter")}
        >
          Acheter sélection ({selectedColor})
        </button>

        <section id="progress" aria-live="polite" aria-atomic="true">
          <h2>Progression des pixels achetés</h2>
          <progress value={progress} max="100"></progress>
          <p>{progress}% achetés</p>
        </section>

        <section id="missions" className="missions" aria-live="polite" aria-atomic="true">
          <h2>Missions à réaliser</h2>
          <Mission done={true} desc="Acheter ton premier pixel" />
          <Mission done={false} desc="Atteindre 25% de pixels achetés" />
          <Mission done={false} desc="Remplir toute la grille" />
        </section>

        <footer id="contact" style={{ marginTop: "3rem", fontSize: "0.85rem", textAlign: "center", color: "rgba(255 255 255 / 0.5)" }}>
          Contact - © OneClickHome 2025
        </footer>
      </div>
    </>
  );
}

function Mission({ done, desc }) {
  return (
    <div className={`mission ${done ? "done" : ""}`} role="listitem">
      <span className="desc">{desc}</span>
      {done && (
        <span aria-label="Terminé" role="img" className="checkmark">
          ✔️
        </span>
      )}
    </div>
  );
}









