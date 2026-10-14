import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const t = req.cookies.get("kas_session")?.value;
  let ok = false;
  if (t && process.env.AUTH_SECRET) {
    try { await jwtVerify(t, new TextEncoder().encode(process.env.AUTH_SECRET)); ok = true; } catch {}
  }
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!login|api/auth|_next|favicon.ico).*)"] };
