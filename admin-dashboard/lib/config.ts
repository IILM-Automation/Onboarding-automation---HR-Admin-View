/**
 * Central configuration. Everything is read from the environment so
 * nothing about the deployment is baked into the bundle — except the
 * passwords, which have hardcoded fallbacks so the app still boots with
 * no env file during local development.
 *
 * These values are used ONLY in server-side code (route handlers).
 * BTS_API_KEY is never exposed to the browser.
 */

// ↓↓↓ The only hardcoded values (overridable via env vars).
const DEFAULT_ADMIN_PASSWORD = "bts_admin_2024";

/** BTS campuses. Extend this list (+ CHECK constraint + env password) to add one. */
export const CAMPUSES = ["Delhi", "Jaipur", "Chandigarh"] as const;
export type Campus = (typeof CAMPUSES)[number];

/** A login scope: the super-admin, or one campus. */
export type Scope = "admin" | Campus;

export const config = {
  /** FastAPI backend base URL, e.g. https://apps.iilm.edu/bts-api */
  apiBase: (process.env.BTS_API_BASE || "").replace(/\/$/, ""),

  /** Shared secret forwarded to the backend as X-API-Key. */
  apiKey: process.env.BTS_API_KEY || "",

  /** Super-admin password (hardcoded fallback for local dev). */
  adminPassword: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,

  /** Secret used to sign the session cookie. */
  sessionSecret:
    process.env.SESSION_SECRET ||
    `bts-session::${process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD}`,
};

export type Role = "admin" | "hr";

export function isCampus(v: unknown): v is Campus {
  return typeof v === "string" && (CAMPUSES as readonly string[]).includes(v);
}

/** Password for a campus login — env `BTS_<CAMPUS>_PASSWORD`, dev fallback `bts_<campus>_2024`. */
export function campusPassword(campus: Campus): string {
  return (
    process.env[`BTS_${campus.toUpperCase()}_PASSWORD`] ||
    `bts_${campus.toLowerCase()}_2024`
  );
}

/** Password for any login scope. */
export function passwordForScope(scope: Scope): string {
  return scope === "admin" ? config.adminPassword : campusPassword(scope);
}

/** Throws a descriptive error if the backend env vars are missing. */
export function assertBackendConfigured() {
  const missing: string[] = [];
  if (!config.apiBase) missing.push("BTS_API_BASE");
  if (!config.apiKey) missing.push("BTS_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill them in.`
    );
  }
}
