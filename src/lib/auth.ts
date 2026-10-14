import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "KETUA" | "SISWA";
export type Session = { uid: string; role: Role; studentId: string | null };
const COOKIE = "kas_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET wajib diisi (min 32 karakter)");
  return new TextEncoder().encode(s);
};

// Matriks izin: ADMIN = bendahara (semua), KETUA = catat pembayaran & lihat, SISWA = hanya data sendiri.
export const PERMS = {
  "student:write": ["ADMIN"],
  "student:read": ["ADMIN", "KETUA"],
  "payment:write": ["ADMIN", "KETUA"],
  "income:write": ["ADMIN"],
  "expense:write": ["ADMIN"],
  "void": ["ADMIN"],
  "report:read": ["ADMIN", "KETUA"],
  "audit:read": ["ADMIN"],
} as const satisfies Record<string, Role[]>;

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload as unknown as Session; } catch { return null; }
}
export async function requirePerm(p: keyof typeof PERMS): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  if (!(PERMS[p] as readonly Role[]).includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}

export function hasPerm(s: Session | null, p: keyof typeof PERMS): s is Session {
  return !!s && (PERMS[p] as readonly Role[]).includes(s.role);
}
