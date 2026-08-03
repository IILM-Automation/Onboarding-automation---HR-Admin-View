import { NextRequest, NextResponse } from "next/server";
import { issueSession, SESSION_COOKIE } from "@/lib/auth";
import { isCampus, type Scope } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let password = "";
  let scope: Scope = "admin";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
    if (body?.scope === "admin" || isCampus(body?.scope)) scope = body.scope;
  } catch {
    /* ignore malformed body */
  }

  const value = issueSession(scope, password);
  if (!value) {
    return NextResponse.json({ ok: false, detail: "Incorrect password" }, { status: 401 });
  }

  const role = scope === "admin" ? "admin" : "hr";
  const campus = scope === "admin" ? "all" : scope;
  const res = NextResponse.json({ ok: true, role, campus });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
