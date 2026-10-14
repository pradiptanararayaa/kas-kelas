import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

const schema = z.object({ username: z.string().trim().min(1).max(50), password: z.string().min(1).max(100) });
const DUMMY = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5ZpZ0K0o8bJ8rW8Zl8x0mXqzv6wQy1e";

export async function POST(req: Request) {
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { username: p.data.username } });
  const ok = await bcrypt.compare(p.data.password, u?.passwordHash ?? DUMMY);
  if (!u || !u.active || !ok) return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  await createSession({ uid: u.id, role: u.role, studentId: u.studentId });
  return NextResponse.json({ ok: true, role: u.role });
}
