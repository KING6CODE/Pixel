import { prisma } from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const start = Number(req.query.start ?? 0);
  const end   = Number(req.query.end ?? 10000); // max fenêtre
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= start || end - start > 20000)
    return res.status(400).json({ error: "Invalid range (max 20000)" });

  // On ne renvoie que les pixels achetés dans la plage
  const pixels = await prisma.pixel.findMany({
    where: { id: { gte: start, lt: end } },
    select: { id: true, color: true, intensity: true, buyCount: true }
  });

  // Map compact
  const out = {};
  for (const p of pixels) out[p.id] = [p.color, p.intensity, p.buyCount];
  res.json(out);
}
