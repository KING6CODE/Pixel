import { prisma } from "../../../lib/prisma";
import { stripe } from "../../../lib/stripe";

export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      const userId = session.metadata?.userId;
      const amountCents = Number(session.amount_total || session.metadata?.amountCents || 0);
      if (userId && amountCents > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { balanceCents: { increment: amountCents } }
        });
      }
    } catch (e) {
      console.error("Top-up error:", e);
    }
  }

  res.json({ received: true });
}
