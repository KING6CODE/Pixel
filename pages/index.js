import { useState } from 'react';

const GRID_SIZE = 10;

export default function PixelPainter() {
  // Initialise pixels avec couleur blanche
  const [pixels, setPixels] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill('#ffffff')
  );
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [color, setColor] = useState('#4285f4'); // couleur par défaut sélectionnée

  // Appliquer couleur au pixel sélectionné
  function applyColor() {
    if (selectedIndex === null) return;
    const newPixels = [...pixels];
    newPixels[selectedIndex] = color;
    setPixels(newPixels);
    setSelectedIndex(null);
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '40px auto',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      <h1 style={{ marginBottom: 20, color: '#3367d6' }}>Pixel Painter 🎨</h1>

      {/* Grille pixels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 4,
          border: '2px solid #3367d6',
          borderRadius: 8,
          padding: 8,
          background: '#f0f4ff',
          boxShadow: '0 4px 10px rgba(51, 103, 214, 0.3)',
        }}
      >
        {pixels.map((color, i) => (
          <div
            key={i}
            onClick={() => setSelectedIndex(i)}
            style={{
              width: 50,
              height: 50,
              backgroundColor: color,
              borderRadius: 4,
              boxShadow:
                selectedIndex === i
                  ? '0 0 8px 3px #3367d6'
                  : 'inset 0 0 5px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'box-shadow 0.3s ease',
            }}
            title={`Pixel #${i + 1}\nClique pour changer la couleur`}
          />
        ))}
      </div>

      {/* Panneau sélection couleur */}
      {selectedIndex !== null && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            background: '#fff',
            maxWidth: 300,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <h2 style={{ color: '#3367d6' }}>
            Modifier couleur du pixel #{selectedIndex + 1}
          </h2>

          {/* Input couleur (color picker) */}
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
              borderRadius: 6,
            }}
          />

          {/* Slider pour luminosité */}
          <label
            htmlFor="luminosity"
            style={{ display: 'block', marginBottom: 6, color: '#555' }}
          >
            Luminosité
          </label>
          <input
            id="luminosity"
            type="range"
            min="0"
            max="100"
            value={Math.round(getLuminosity(color))}
            onChange={(e) => {
              const lum = Number(e.target.value);
              const newColor = setLuminosity(color, lum);
              setColor(newColor);
            }}
            style={{ width: '100%', marginBottom: 20 }}
          />

          <button
            onClick={applyColor}
            style={{
              padding: '12px 25px',
              backgroundColor: '#3367d6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              boxShadow: '0 4px 10px rgba(51,103,214,0.6)',
              transition: 'background-color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a4fb8')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3367d6')}
          >
            Valider la couleur
          </button>

          <button
            onClick={() => setSelectedIndex(null)}
            style={{
              marginTop: 15,
              padding: '8px 20px',
              backgroundColor: '#ccc',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

// Utilitaires pour luminosité (approximation)

function getLuminosity(hex) {
  // Convertit hex en rgb
  const rgb = hexToRgb(hex);
  if (!rgb) return 100;
  // Calcul luminosité perçue
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 2.55; // 0-100
}

function setLuminosity(hex, lum) {
  // Convertit hex en hsl, modifie luminosité, reconvertit en hex
  const hsl = hexToHSL(hex);
  if (!hsl) return hex;
  hsl.l = lum / 100;
  return HSLToHex(hsl);
}

// Convertisseur hex -> rgb
function hexToRgb(hex) {
  let c = hex.substring(1);
  if (c.length === 3)
    c =
      c[0] +
      c[0] +
      c[1] +
      c[1] +
      c[2] +
      c[2]; /* raccourci #fff -> #ffffff */
  const bigint = parseInt(c, 16);
  if (isNaN(bigint)) return null;
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

// Convertisseur hex -> hsl (valeurs entre 0 et 1)
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

// Convertisseur hsl -> hex
function HSLToHex(hsl) {
  const { h, s, l } = hsl;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // gris
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


