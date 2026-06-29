/**
 * Server-side proxy to the FastAPI backend. Attaches the X-API-Key
 * header from server env so the secret never reaches the browser.
 */
import { NextResponse } from "next/server";
import { config, assertBackendConfigured, type Role } from "./config";
import { getSessionRole } from "./auth";

type ProxyOpts = {
  method?: string;
  body?: unknown;
  /** Roles allowed to call this endpoint. Defaults to admin-only. */
  roles?: Role[];
};

/**
 * Forward a request to the backend after verifying the caller's session
 * role. Returns a NextResponse mirroring the upstream status + JSON body.
 */
export async function proxy(path: string, opts: ProxyOpts = {}): Promise<NextResponse> {
  const allowed = opts.roles ?? ["admin"];
  const role = await getSessionRole();
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  try {
    assertBackendConfigured();
  } catch (e) {
    return NextResponse.json({ detail: (e as Error).message }, { status: 500 });
  }

  try {
    const res = await fetch(config.apiBase + path, {
      method: opts.method || "GET",
      headers: {
        "X-API-Key": config.apiKey,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text || "upstream returned non-JSON response" };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { detail: `backend unreachable: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
