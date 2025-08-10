import React, { useState, useEffect } from "react";
import BackgroundParticles from "../components/BackgroundParticles";
import styles from "./styles.module.css";

const COLORS = [
  "#eee", // default empty
  "#f87171", // rouge clair
  "#34d399", // vert clair
  "#60a5fa", // bleu clair
  "#a78bfa", // violet clair
  "#fbbf24", // jaune clair
];

const PRICES = [1, 2, 4, 8, 16];

export default function Home() {
  const gridSize = 20;
  const [pixels, setPixels] = useState(() => {
    // Init 20x20 pixels avec couleur 0 (vide) et price 1 par défaut
    const arr = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      arr.push({ colorIndex: 0, price: 1, owned: false });
    }
    return arr;
  });

  const [selectedColor, setSelectedColor] = useState(1);
  const [balance, setBalance] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mise à jour barre de progression selon % de pixels achetés
  useEffect(() => {
    const ownedCount = pixels.filter((p) => p.owned).length;
    setProgress(Math.round((ownedCount / pixels.length) * 100));
  }, [pixels]);

  // Achat pixel si possible
  function buyPixel(index) {
    setPixels((oldPixels) => {
      const p = oldPixels[index];
      if (p.owned) return oldPixels;
      const price = p.price;
      if (balance < price) {
        alert("Solde insuffisant !");
        return oldPixels;
      }
      const newPixels = [...oldPixels];
      newPixels[index] = { ...p, owned: true, colorIndex: selectedColor };
      setBalance((b) => b - price);
      return newPixels;
    });
  }

  // Changer couleur pixel déjà acheté
  function recolorPixel(index) {
    setPixels((oldPixels) => {
      const p = oldPixels[index];
      if (!p.owned) return oldPixels;
      const newPixels = [...oldPixels];
      newPixels[index] = { ...p, colorIndex: selectedColor };
      return newPixels;
    });
  }

  // Gestion clic pixel (acheter ou recolor)
  function handlePixelClick(i) {
    const p = pixels[i];
    if (p.owned) {
      recolorPixel(i);
    } else {
      buyPixel(i);
    }
  }

  // Zoom in / out
  function zoomIn() {
    setZoom((z) => Math.min(z + 0.2, 3));
  }
  function zoomOut() {
    setZoom((z) => Math.max(z - 0.2, 0.6));
  }

  // Toggle menu déroulant couleur
  function toggleDropdown() {
    setShowDropdown((v) => !v);
  }

  // Reset la grille (debug)
  function resetGrid() {
    if (confirm("Réinitialiser toute la grille ?")) {
      setPixels(
        Array(gridSize * gridSize).fill({ colorIndex: 0, price: 1, owned: false })
      );
      setBalance(100);
    }
  }

  return (
    <>
      <BackgroundParticles />
      <div className={styles.container} style={{ userSelect: "none" }}>
        <header className={styles.menu}>
          <div>
            <strong>🏠 OneClickHome</strong>
          </div>

          <div className="dropdown" style={{ position: "relative" }}>
            <button
              onClick={toggleDropdown}
              style={{
                background: "rgba(255 255 255 / 0.15)",
                border: "none",
                borderRadius: 8,
                padding: "0.3rem 0.6rem",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                userSelect: "none",
              }}
            >
              Couleur choisie{" "}
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 20,
                  backgroundColor: COLORS[selectedColor],
                  borderRadius: 6,
                  verticalAlign: "middle",
                  boxShadow: "0 0 8px white",
                }}
              ></span>
            </button>
            {showDropdown && (
              <div
                className="dropdown-content"
                style={{
                  position: "absolute",
                  top: "120%",
                  left: 0,
                  background: "rgba(0,0,0,0.8)",
                  borderRadius: 10,
                  boxShadow: "0 0 15px rgba(0,0,0,0.6)",
                  padding: "0.5rem 0",
                  zIndex: 20,
                  width: 150,
                }}
              >
                {COLORS.slice(1).map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedColor(i + 1);
                      setShowDropdown(false);
                    }}
                    style={{
                      backgroundColor: c,
                      color: "white",
                      fontWeight: "700",
                      padding: "0.4rem 1rem",
                      border: "none",
                      borderRadius: 6,
                      margin: "0.1rem 0",
                      cursor: "pointer",
                      boxShadow:
                        selectedColor === i + 1
                          ? "0 0 12px 3px white"
                          : "none",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ color: "white", fontWeight: 700 }}>
            Solde : {balance}€
          </div>

          <div>
            <button
              onClick={zoomIn}
              style={{
                marginRight: 8,
                padding: "0.3rem 0.8rem",
                borderRadius: 6,
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                userSelect: "none",
                boxShadow: "0 0 8px #3b82f6",
              }}
              title="Zoom +"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              style={{
                padding: "0.3rem 0.8rem",
                borderRadius: 6,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                userSelect: "none",
                boxShadow: "0 0 8px #2563eb",
              }}
              title="Zoom -"
            >
              -
            </button>
          </div>
        </header>

        <div
          className={styles.grid}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        >
          {pixels.map((p, i) => (
            <div
              key={i}
              className={`${styles.pixel} pixel price-${p.price} ${
                p.owned ? "glow" : ""
              }`}
              style={{ backgroundColor: COLORS[p.colorIndex] }}
              onClick={() => handlePixelClick(i)}
              title={
                p.owned
                  ? `Pixel acheté - Couleur: ${COLORS[p.colorIndex]}`
                  : `Prix: ${p.price}€`
              }
            >
              {p.owned ? "✓" : ""}
            </div>
          ))}
        </div>

        <div className={styles.progressBar} aria-label="Progression des pixels achetés">
          <div
            className={styles.progress}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <footer style={{ textAlign: "center", color: "white", marginTop: 24 }}>
          <button
            onClick={resetGrid}
            style={{
              padding: "0.6rem 1.2rem",
              fontWeight: "700",
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 0 10px #ef4444",
              userSelect: "none",
            }}
          >
            Réinitialiser la grille
          </button>
        </footer>
      </div>
    </>
  );
}
