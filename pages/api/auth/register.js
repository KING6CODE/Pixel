import { prisma } from "../../../lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid body" });
  const { email, password, name } = parse.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name }
  });
  res.status(201).json({ id: user.id, email: user.email });
}
