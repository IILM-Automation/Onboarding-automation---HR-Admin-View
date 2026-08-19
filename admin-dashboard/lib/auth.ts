/**
 * Cookie-based, campus-aware session for the admin dashboard.
 *
 * The login route verifies the scope password server-side and sets an
 * httpOnly cookie of the form `<role>:<campus>:<hmac>`, where the HMAC is
 * keyed by SESSION_SECRET and bound to both role and campus. The proxy
 * routes recompute that HMAC to authorize each request and derive the
 * campus scope. Passwords never reach the browser.
 *
 *   super-admin  -> role=admin, campus="all"  (sees every campus)
 *   campus login -> role=hr,    campus=<City> (locked to that campus)
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  config,
  passwordForLogin,
  isCampus,
  type Role,
  type Scope,
  type LoginMode,
} from "./config";

export const SESSION_COOKIE = "bts_admin_session";

/** "all" for super-admin, else a campus name. */
export type CampusScope = "all" | string;
export interface Session {
  role: Role;
  campus: CampusScope;
}

function roleCampusForLogin(scope: Scope, mode: LoginMode): Session {
  if (scope === "admin") return { role: "admin", campus: "all" };
  return { role: mode === "interview" ? "interviewer" : "hr", campus: scope };
}

function expectedToken(role: Role, campus: CampusScope): string {
  return createHmac("sha256", config.sessionSecret)
    .update(`bts-${role}-${campus}-v1`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Validate a scope+mode password and return the cookie value to store, or null. */
export function issueSession(scope: Scope, mode: LoginMode, password: string): string | null {
  if (!password || !safeEqual(password, passwordForLogin(scope, mode))) return null;
  const { role, campus } = roleCampusForLogin(scope, mode);
  return `${role}:${campus}:${expectedToken(role, campus)}`;
}

/** Return the authenticated session from the request cookie, or null. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length !== 3) return null;
  const [role, campus, token] = parts;
  if (role !== "admin" && role !== "hr" && role !== "interviewer") return null;
  if (campus !== "all" && !isCampus(campus)) return null;
  // admin must be "all"; hr/interviewer must be a real campus — bind them together.
  if (role === "admin" && campus !== "all") return null;
  if (role !== "admin" && campus === "all") return null;
  return safeEqual(token, expectedToken(role as Role, campus)) ? { role: role as Role, campus } : null;
}
