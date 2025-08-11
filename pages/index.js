import React, { useState, useEffect } from "react";
import styles from "../styles/grid.module.css";

const initialPixels = Array(100).fill(null).map(() => ({
  color: "#ffffff",
  price: 1,
  bought: false,
}));

const priceBorders = [
  { price: 1, className: styles.borderPrice1 },
  { price: 2, className: styles.borderPrice2 },
  { price: 4, className: styles.borderPrice4 },
  { price: 8, className: styles.borderPrice8 },
  { price: 16, className: styles.borderPrice16 },
];

// Fonction pour obtenir la classe bordure correspondant au prix
function getBorderClass(price) {
  if (price >= 16) return `${styles.borderPrice16} ${styles.glow}`;
  if (price >= 8) return styles.borderPrice8;
  if (price >= 4) return styles.borderPrice4;
  if (price >= 2) return styles.borderPrice2;
  return styles.borderPrice1;
}

export default function Home() {
  const [pixels, setPixels] = useState(initialPixels);
  const [selectedPixelIndex, setSelectedPixelIndex] = useState(null);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [showIntro, setShowIntro] = useState(true);

  // Couleur HSL construite
  const selectedColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  // Appliquer la couleur choisie au pixel et doubler le prix
  function handleValidate() {
    if (selectedPixelIndex === null) return;
    setPixels((prev) => {
      const newPixels = [...prev];
      newPixels[selectedPixelIndex] = {
        color: selectedColor,
        price: newPixels[selectedPixelIndex].price * 2,
        bought: true,
      };
      return newPixels;
    });
    setSelectedPixelIndex(null);
  }

  // Réinitialiser tous les pixels à blanc et prix 1€
  function handleReset() {
    setPixels(initialPixels);
    setSelectedPixelIndex(null);
  }

  // Fermer drawer (annuler)
  function handleCancel() {
    setSelectedPixelIndex(null);
  }

  // Fermeture intro
  function closeIntro() {
    setShowIntro(false);
  }

  // Désactiver scroll quand drawer ou intro ouverts
  useEffect(() => {
    if (showIntro || selectedPixelIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [showIntro, selectedPixelIndex]);

  return (
    <>
      {/* INTRO - fond sombre + texte blanc sur carte sombre */}
      {showIntro && (
        <div className={styles.introOverlay}>
          <div className={styles.introCard}>
            <h1>Bienvenue sur PixelBuy Pro</h1>
            <p>
              Ce site vous permet d’acheter et personnaliser une grille 10x10 de pixels.
              Chaque pixel a un prix qui double à chaque achat et une couleur que vous choisissez.
              Un contour coloré indique le prix, et vous pouvez améliorer vos pixels à volonté.
            </p>
            <p>
              Cliquez sur un pixel pour ouvrir le panneau d’achat, sélectionnez une couleur avec le slider HSL, puis validez.
            </p>
            <p>
              Un bouton "Réinitialiser tout" vous permet de repartir à zéro à tout moment.
            </p>
            <div className={styles.introActions}>
              <button onClick={closeIntro} className={styles.primaryBtn}>
                Commencer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE PRINCIPALE */}
      <div className={styles.page}>
        {/* Colonne gauche : grille + légende + reset */}
        <div className={styles.left}>
          <div className={styles.gridWrap}>
            <div className={styles.grid} role="grid" aria-label="Pixel grid 10x10">
              {pixels.map((pixel, idx) => (
                <div
                  key={idx}
                  className={`${styles.pixel} ${getBorderClass(pixel.price)}`}
                  onClick={() => setSelectedPixelIndex(idx)}
                  style={{ backgroundColor: pixel.color }}
                  title={`Pixel ${idx + 1}, Prix: ${pixel.price}€`}
                  role="gridcell"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedPixelIndex(idx);
                  }}
                >
                  <span className={styles.price}>{pixel.price}€</span>
                  {pixel.bought && (
                    <span className={styles.boughtBadge} aria-label="Pixel acheté">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Légende */}
            <div className={styles.legend} aria-label="Légende des prix">
              <div className={styles.legendItem}>
                <div className={`${styles.pixel} ${styles.borderPrice1}`} style={{backgroundColor:"#fff",width:"20px",height:"20px",borderRadius:"6px"}}></div>
                <span>1€ (gris clair)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.pixel} ${styles.borderPrice2}`} style={{backgroundColor:"#fff",width:"20px",height:"20px",borderRadius:"6px"}}></div>
                <span>2€ (vert doux)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.pixel} ${styles.borderPrice4}`} style={{backgroundColor:"#fff",width:"20px",height:"20px",borderRadius:"6px"}}></div>
                <span>4€ (bleu)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.pixel} ${styles.borderPrice8}`} style={{backgroundColor:"#fff",width:"20px",height:"20px",borderRadius:"6px"}}></div>
                <span>8€ (violet)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.pixel} ${styles.borderPrice16} ${styles.glow}`} style={{backgroundColor:"#fff",width:"20px",height:"20px",borderRadius:"6px"}}></div>
                <span>16€+ (doré brillant)</span>
              </div>
            </div>
            <div className={styles.resetRow}>
              <button onClick={handleReset} className={styles.primaryBtn} aria-label="Réinitialiser la grille">
                Réinitialiser tout
              </button>
            </div>
          </div>
        </div>

        {/* DRAWER - panneau d’achat animé depuis la droite */}
        <div
          className={`${styles.drawer} ${selectedPixelIndex !== null ? styles.drawerOpen : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawerTitle"
        >
          {selectedPixelIndex !== null && (
            <>
              <div className={styles.drawerHeader}>
                <div>
                  <h2 id="drawerTitle" className={styles.drawerTitle}>
                    Pixel #{selectedPixelIndex + 1}
                  </h2>
                  <p className={styles.drawerSub}>
                    Prix actuel : {pixels[selectedPixelIndex].price}€
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  aria-label="Annuler la sélection"
                  className={styles.ghostBtn}
                >
                  Annuler
                </button>
              </div>

              <div
                className={styles.colorPreview}
                style={{ backgroundColor: selectedColor }}
                aria-label={`Aperçu couleur sélectionnée : ${selectedColor}`}
              />

              <div className={styles.sliderRow}>
                <label htmlFor="hueRange">Teinte</label>
                <input
                  type="range"
                  id="hueRange"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => setHue(Number(e.target.value))}
                />
              </div>
              <div className={styles.sliderRow}>
                <label htmlFor="saturationRange">Saturation</label>
                <input
                  type="range"
                  id="saturationRange"
                  min="0"
                  max="100"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                />
              </div>
              <div className={styles.sliderRow}>
                <label htmlFor="lightnessRange">Luminosité</label>
                <input
                  type="range"
                  id="lightnessRange"
                  min="0"
                  max="100"
                  value={lightness}
                  onChange={(e) => setLightness(Number(e.target.value))}
                />
              </div>

              <div className={styles.btnRow}>
                <button
                  onClick={handleValidate}
                  className={styles.primaryBtn}
                  aria-label="Valider la couleur et acheter"
                >
                  Valider
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}





