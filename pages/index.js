import { useEffect, useState } from 'react';

export default function Home() {
  const [pixels, setPixels] = useState([]);
  const [selectedPixel, setSelectedPixel] = useState(null);
  const [pseudo, setPseudo] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);

  // Charge les pixels et historique
  async function loadData() {
    const res = await fetch('/api/pixels');
    const data = await res.json();
    setPixels(data.pixels);
    setHistory(data.history);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Acheter un pixel
  async function buyPixel() {
    if (!pseudo) {
      setMessage('Merci de renseigner un pseudo.');
      return;
    }
    const res = await fetch('/api/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedPixel.id, pseudo }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(`Pixel #${selectedPixel.id} acheté pour ${data.price} € !`);
      setSelectedPixel(null);
      setPseudo('');
      loadData();
    } else {
      setMessage(data.error);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>Pixel Battle - Acheter un pixel</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {pixels.map((p) => (
          <div
            key={p.id}
            onClick={() => setSelectedPixel(p)}
            style={{
              width: 50,
              height: 50,
              backgroundColor: p.owner ? '#4285f4' : '#ddd',
              color: '#fff',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              border: selectedPixel?.id === p.id ? '3px solid #fbbc05' : '1px solid #999',
              userSelect: 'none',
            }}
            title={p.owner ? `Propriétaire: ${p.owner}\nPrix: ${p.price} €` : `Libre à ${p.price} €`}
          >
            #{p.id}
            <small>{p.price} €</small>
          </div>
        ))}
      </div>

      {selectedPixel && (
        <div style={{ marginTop: 20, padding: 10, border: '1px solid #ccc' }}>
          <h3>
            Acheter le pixel #{selectedPixel.id} {selectedPixel.owner ? `(actuellement ${selectedPixel.owner})` : '(libre)'}
          </h3>
          <p>Prix : {selectedPixel.price} €</p>
          <input
            placeholder="Ton pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            style={{ padding: 8, width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <button onClick={buyPixel} style={{ padding: '10px 20px', backgroundColor: '#3367d6', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Acheter
          </button>
          <button
            onClick={() => setSelectedPixel(null)}
            style={{ marginLeft: 10, padding: '10px 20px', backgroundColor: '#999', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Annuler
          </button>
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <h2>Historique des ventes récentes</h2>
        <ul>
          {history.length === 0 && <li>Aucune vente pour le moment.</li>}
          {history.map((h, i) => (
            <li key={i}>
              Pixel #{h.id} vendu à <strong>{h.buyer}</strong> pour <strong>{h.price} €</strong>. Ancien propriétaire :{' '}
              {h.oldOwner || 'aucun'}
            </li>
          ))}
        </ul>
      </div>

      {message && <div style={{ marginTop: 20, color: 'green', fontWeight: 'bold' }}>{message}</div>}
    </div>
  );
}

