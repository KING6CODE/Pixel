import { useState } from 'react';

const GRID_SIZE = 10;

// Palier des prix pour les couleurs des contours
const PRICE_TIERS = [
  { minPrice: 1, border: '#aaa', name: '1€', glow: false },
  { minPrice: 2, border: '#4caf50', name: '2€', glow: false }, // vert
  { minPrice: 4, border: '#3367d6', name: '4€', glow: false }, // bleu
  { minPrice: 8, border: '#7e57c2', name: '8€', glow: false }, // violet
  { minPrice: 16, border: '#ffd700', name: '16€+', glow: true }, // doré glow
];

// Trouver le palier correspondant au prix (on prend le max minPrice <= price)
function getTierByPrice(price) {
  let tier = PRICE_TIERS[0];
  for (let i = 0; i < PRICE_TIERS.length; i++) {
    if (price >= PRICE_TIERS[i].minPrice) tier = PRICE_TIERS[i];
  }
  return tier;
}

export default function PixelPainter() {
  // Chaque pixel a sa couleur et son prix actuel
  const [pixels, setPixels] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill({ color: '#ffffff', price: 1 })
  );
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [color, setColor] = useState('#4285f4');

  // Acheter / améliorer le pixel : prix double à chaque achat
  function buyPixel() {
    if (selectedIndex === null) return;

    const currentPixel = pixels[selectedIndex];
    const newPrice = currentPixel.price * 2;

    const newPixels = [...pixels];
    newPixels[selectedIndex] = { color, price: newPrice };
    setPixels(newPixels);
    setSelectedIndex(null);
  }

  // Réinitialiser tous les pixels
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
          const tier = getTierByPrice(price);

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
              title={`Pixel #${i + 1}\nPrix actuel : ${price}€\nClique pour acheter ou changer la couleur (prix double)`}
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
        {PRICE_TIERS.map(({ minPrice, border, name, glow }) => (
          <div
            key={minPrice}
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

      {/* Panneau sélection couleur + achat */}
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
            Acheter/améliorer pixel #{selectedIndex + 1}
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
            onClick={buyPixel}
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
            Acheter / améliorer (prix double)
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
          borderRadius: 10,
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: 16,
          boxShadow: '0 6px 15px rgba(244,67,54,0.7)',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d32f2f')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f44336')}
      >
        Réinitialiser tous les pixels
      </button>
    </div>
  );
}




