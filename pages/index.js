import { useState } from 'react';

const GRID_SIZE = 10;

// Prix associés aux couleurs (tu peux personnaliser)
const PRICE_TIERS = [
  { price: 1, border: '#aaa', name: '1€', glow: false },
  { price: 2, border: '#4caf50', name: '2€', glow: false }, // vert
  { price: 4, border: '#3367d6', name: '4€', glow: false }, // bleu
  { price: 8, border: '#7e57c2', name: '8€', glow: false }, // violet
  { price: 16, border: '#ffd700', name: '16€+', glow: true }, // doré glow
];

// Fonction pour associer prix selon la couleur choisie
function getPriceByColor(color) {
  // Simplification : on regarde la teinte H (en degrés) et on définit un palier
  // on convertit la couleur en HSL et on choisit un palier

  const hsl = hexToHSL(color);
  if (!hsl) return 1;
  const h = hsl.h * 360;

  if (h < 30 || h > 330) return 16; // rouge / doré
  if (h < 60) return 8; // orange/violet
  if (h < 150) return 4; // vert/bleu
  if (h < 270) return 2; // bleu clair/vert clair
  return 1;
}

export default function PixelPainter() {
  // Pixels : array of {color, price}
  const [pixels, setPixels] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill({ color: '#ffffff', price: 1 })
  );
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [color, setColor] = useState('#4285f4');

  function applyColor() {
    if (selectedIndex === null) return;
    const price = getPriceByColor(color);

    const newPixels = [...pixels];
    newPixels[selectedIndex] = { color, price };
    setPixels(newPixels);
    setSelectedIndex(null);
  }

  function resetAll() {
    setPixels(Array(GRID_SIZE * GRID_SIZE).fill({ color: '#ffffff', price: 1 }));
    setSelectedIndex(null);
  }

  return (
    <div
      style={{
        maxWidth: 650,
        margin: '40px auto',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        textAlign: 'center',
        userSelect: 'none',
        padding: 20,
        background: '#f9fbff',
        borderRadius: 15,
        boxShadow: '0 6px 20px rgba(51, 103, 214, 0.2)',
      }}
    >
      <h1 style={{ marginBottom: 20, color: '#3367d6' }}>Pixel Painter 🎨</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 6,
          border: '3px solid #3367d6',
          borderRadius: 12,
          padding: 12,
          background: '#ffffff',
        }}
      >
        {pixels.map(({ color: pxColor, price }, i) => {
          // Trouver style contour selon prix
          const tier =
            PRICE_TIERS.find((t) => t.price === price) || PRICE_TIERS[0];

          return (
            <div
              key={i}
              onClick={() => setSelectedIndex(i)}
              style={{
                width: 50,
                height: 50,
                backgroundColor: pxColor,
                borderRadius: 6,
                border: `3px solid ${tier.border}`,
                boxShadow: tier.glow
                  ? `0 0 8px 3px ${tier.border}`
                  : 'inset 0 0 5px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
              }}
              title={`Pixel #${i + 1}\nPrix : ${price}€\nClique pour changer la couleur`}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = `0 0 10px 4px ${tier.border}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = tier.glow
                  ? `0 0 8px 3px ${tier.border}`
                  : 'inset 0 0 5px rgba(0,0,0,0.1)';
              }}
            >
              {/* Afficher prix en bas à droite */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 3,
                  right: 3,
                  fontSize: 12,
                  color: tier.border,
                  fontWeight: 'bold',
                  textShadow: '0 0 3px #fff',
                  userSelect: 'none',
                }}
              >
                {price}€
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          flexWrap: 'wrap',
          color: '#444',
          fontSize: 14,
          userSelect: 'none',
        }}
      >
        {PRICE_TIERS.map(({ price, border, name, glow }) => (
          <div
            key={price}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'default',
            }}
            title={`${name} : contour couleur`}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: `3px solid ${border}`,
                boxShadow: glow ? `0 0 6px 2px ${border}` : 'none',
              }}
            ></div>
            <span>{name}</span>
          </div>
        ))}
      </div>

      {/* Panneau sélection couleur */}
      {selectedIndex !== null && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 6px 30px rgba(0,0,0,0.1)',
            background: '#fff',
            maxWidth: 320,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <h2 style={{ color: '#3367d6' }}>
            Modifier couleur du pixel #{selectedIndex + 1}
          </h2>

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: '100%',
              height: 50,
              border: 'none',
              cursor: 'pointer',
              marginTop: 10,
              marginBottom: 20,
              borderRadius: 8,
            }}
          />

          <button
            onClick={applyColor}
            style={{
              padding: '14px 30px',
              backgroundColor: '#3367d6',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              boxShadow: '0 6px 15px rgba(51,103,214,0.7)',
              transition: 'background-color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a4fb8')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3367d6')}
          >
            Valider la couleur (prix calculé)
          </button>

          <button
            onClick={() => setSelectedIndex(null)}
            style={{
              marginTop: 16,
              padding: '10px 25px',
              backgroundColor: '#ccc',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Bouton reset */}
      <button
        onClick={resetAll}
        style={{
          marginTop: 40,
          padding: '12px 30px',
          backgroundColor: '#f44336',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 5px 15px rgba(244,67,54,0.6)',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d32f2f')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f44336')}
      >
        Réinitialiser tout
      </button>
    </div>
  );
}

// Convertisseurs hex <-> hsl
function hexToRgb(hex) {
  let c = hex.substring(1);
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const bigint = parseInt(c, 16);
  if (isNaN(bigint)) return null;
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}
function hexToHSL(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let r = rgb.r / 255,
    g = rgb.g / 255,
    b = rgb.b / 255;
  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) h = s = 0;
  else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        h = 0;
    }
    h /= 6;
  }
  return { h, s, l };
}



