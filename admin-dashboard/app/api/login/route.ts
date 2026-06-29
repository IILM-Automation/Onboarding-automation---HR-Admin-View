import { NextRequest, NextResponse } from "next/server";
import { issueSession, SESSION_COOKIE } from "@/lib/auth";
import type { Role } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let password = "";
  let role: Role = "admin";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
    if (body?.role === "hr" || body?.role === "admin") role = body.role;
  } catch {
    /* ignore malformed body */
  }

  const value = issueSession(role, password);
  if (!value) {
    return NextResponse.json({ ok: false, detail: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
