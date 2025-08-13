import { getServerSession } from "next-auth/next";
import authOptions from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

function priceCentsForBuyCount(n) {
  // n = buyCount BEFORE purchase; first purchase n=0 -> 1ct
  return Math.pow(2, Math.max(0, n)) * 1; // centimes
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Auth required" });

  const { pixelIndex, color, intensity } = req.body || {};
  const idx = Number(pixelIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 1000000)
    return res.status(400).json({ error: "Invalid pixel index" });

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return res.status(400).json({ error: "Invalid color" });
  const inten = Number(intensity);
  if (!Number.isInteger(inten) || inten < 0 || inten > 30)
    return res.status(400).json({ error: "Invalid intensity" });

  // Récupérer état actuel
  const existing = await prisma.pixel.findUnique({ where: { id: idx } });
  const buyCount = existing ? existing.buyCount : 0; // before purchase
  const priceCents = priceCentsForBuyCount(buyCount);

  // Wallet utilisateur
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { balanceCents: true }});
  if (user.balanceCents < priceCents)
    return res.status(402).json({ error: "Insufficient wallet balance" });

  // Transaction atomique
  const result = await prisma.$transaction(async (tx) => {
    // Débiter
    await tx.user.update({
      where: { id: session.user.id },
      data: { balanceCents: { decrement: priceCents } }
    });

    if (existing) {
      await tx.pixel.update({
        where: { id: idx },
        data: {
          color, intensity, buyCount: { increment: 1 }
        }
      });
    } else {
      await tx.pixel.create({
        data: { id: idx, color, intensity, buyCount: 1 }
      });
    }

    await tx.purchase.create({
      data: {
        userId: session.user.id,
        pixelIndex: idx,
        color, intensity,
        countAfter: (buyCount + 1),
        priceCents
      }
    });

    return { priceCents, newCount: buyCount + 1 };
  });

  res.json({ ok: true, priceCents: result.priceCents, buyCountAfter: result.newCount });
}
