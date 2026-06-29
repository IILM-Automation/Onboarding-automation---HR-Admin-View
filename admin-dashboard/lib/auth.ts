/**
 * Cookie-based, role-aware session for the admin dashboard.
 *
 * The login route verifies the division password server-side and sets an
 * httpOnly cookie of the form `<role>:<hmac>`, where the HMAC is keyed by
 * SESSION_SECRET and bound to the role. The proxy routes recompute that
 * HMAC to authorize each request. Passwords never reach the browser.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { config, passwordForRole, type Role } from "./config";

export const SESSION_COOKIE = "bts_admin_session";

function expectedToken(role: Role): string {
  return createHmac("sha256", config.sessionSecret)
    .update(`bts-${role}-v1`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Validate a division password and return the cookie value to store. */
export function issueSession(role: Role, password: string): string | null {
  if (!password || !safeEqual(password, passwordForRole(role))) return null;
  return `${role}:${expectedToken(role)}`;
}

/** Return the authenticated role from the request cookie, or null. */
export async function getSessionRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  const role = raw.slice(0, idx) as Role;
  const token = raw.slice(idx + 1);
  if (role !== "admin" && role !== "hr") return null;
  return safeEqual(token, expectedToken(role)) ? role : null;
}
