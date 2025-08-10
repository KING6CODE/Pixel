import { useEffect, useState } from 'react';

export default function Home() {
  const [pixels, setPixels] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPixels = async () => {
    const res = await fetch('https://ton-backend-replit-url/pixels');
    const data = await res.json();
    setPixels(data);
  };

  useEffect(() => {
    fetchPixels();
  }, []);

  const buyPixel = async (x, y) => {
    const buyerEmail = prompt('Ton email pour recevoir ton pixel ?');
    if (!buyerEmail) return alert('Email requis');

    // Ici tu devras intégrer Stripe Elements pour récupérer paymentMethodId
    // Pour test, on simule
    const paymentMethodId = 'pm_card_visa'; // test card Stripe

    setLoading(true);
    const res = await fetch('https://ton-backend-replit-url/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, buyerEmail, paymentMethodId }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      alert('Pixel acheté !');
      fetchPixels();
    } else {
      alert('Erreur : ' + data.error);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 20 }}>
      <h1>Pixel Battle</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 30px)',
          gridGap: 2,
        }}
      >
        {pixels.map(({ x, y, owner, price }) => (
          <div
            key={`${x}-${y}`}
            onClick={() => buyPixel(x, y)}
            style={{
              width: 30,
              height: 30,
              backgroundColor: owner ? '#4caf50' : '#ddd',
              cursor: 'pointer',
              border: '1px solid #999',
              fontSize: 10,
              textAlign: 'center',
              lineHeight: '30px',
              color: '#fff',
            }}
            title={`Prix: ${price}€\nPropriétaire: ${owner || 'Personne'}`}
          >
            {price}€
          </div>
        ))}
      </div>
      {loading && <p>Achat en cours...</p>}
    </div>
  );
}
