import { getServerSession } from "next-auth/next";
import authOptions from "./auth/[...nextauth]";
import { prisma } from "../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Auth required" });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id:true, email:true, balanceCents:true }});
  res.json(me);
}
