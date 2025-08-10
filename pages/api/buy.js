let pixels = [];
let history = [];

function initPixels() {
  if (pixels.length === 0) {
    for (let i = 1; i <= 100; i++) {
      pixels.push({ id: i, price: 1, owner: null });
    }
  }
}
initPixels();

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { id, pseudo } = req.body;

    if (!id || !pseudo) {
      res.status(400).json({ success: false, error: 'Id et pseudo obligatoires' });
      return;
    }

    const pixel = pixels.find((p) => p.id === id);
    if (!pixel) {
      res.status(404).json({ success: false, error: 'Pixel introuvable' });
      return;
    }

    // Prix d'achat = prix actuel
    const priceToPay = pixel.price;

    // Simule paiement OK (tu pourras intégrer Stripe)
    // Ensuite:
    const oldOwner = pixel.owner;
    pixel.owner = pseudo;
    pixel.price = priceToPay * 2; // double prix pour prochaine vente

    // Historique
    history.push({ id, buyer: pseudo, price: priceToPay, oldOwner });

    // Ici tu distribuerais 60% à oldOwner et 40% à toi (à intégrer via Stripe Connect)
    // Pour l’instant c’est juste simulation.

    res.status(200).json({ success: true, price: priceToPay });
  } else {
    res.status(405).json({ success: false, error: 'Méthode non autorisée' });
  }
}
