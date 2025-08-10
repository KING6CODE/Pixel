// En mémoire, pas de base de données (exemple simple)
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
  if (req.method === 'GET') {
    res.status(200).json({ pixels, history: history.slice(-10).reverse() }); // derniers 10
  } else {
    res.status(405).json({ error: 'Méthode non autorisée' });
  }
}
