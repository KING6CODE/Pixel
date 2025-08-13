import { getServerSession } from "next-auth/next";
import authOptions from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Auth required" });

  const { amountCents } = req.body || {};
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 100) // min 1€
    return res.status(400).json({ error: "Minimum top-up is 100 cents" });

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: "PixelGrid Wallet Top-Up" },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    metadata: { userId: session.user.id, amountCents: String(amount) },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/game?topup=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/game?topup=cancel`,
  });

  res.json({ id: checkout.id, url: checkout.url });
}
