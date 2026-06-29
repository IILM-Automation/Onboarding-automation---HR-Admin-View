/**
 * Central configuration. Everything is read from the environment so
 * nothing about the deployment is baked into the bundle — except the
 * admin password, which has a hardcoded fallback so the app still boots
 * with no env file during local development.
 *
 * These values are used ONLY in server-side code (route handlers).
 * BTS_API_KEY is never exposed to the browser.
 */

// ↓↓↓ The only hardcoded values (overridable via env vars).
const DEFAULT_ADMIN_PASSWORD = "bts_admin_2024";
const DEFAULT_HR_PASSWORD = "bts_hr_2024";

export const config = {
  /** FastAPI backend base URL, e.g. https://apps.iilm.edu/bts-api */
  apiBase: (process.env.BTS_API_BASE || "").replace(/\/$/, ""),

  /** Shared secret forwarded to the backend as X-API-Key. */
  apiKey: process.env.BTS_API_KEY || "",

  /** Admin division password (hardcoded fallback for local dev). */
  adminPassword: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,

  /** HR division password (hardcoded fallback for local dev). */
  hrPassword: process.env.HR_PASSWORD || DEFAULT_HR_PASSWORD,

  /** Secret used to sign the session cookie. */
  sessionSecret:
    process.env.SESSION_SECRET ||
    `bts-session::${process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD}`,
};

export type Role = "admin" | "hr";

export function passwordForRole(role: Role): string {
  return role === "hr" ? config.hrPassword : config.adminPassword;
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
