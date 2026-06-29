/**
 * Browser-side API client. Talks to this app's own /api/* route
 * handlers (same-origin, cookie-authenticated). The backend URL and
 * API key live only on the server — never here.
 */
import type { AppDetail, AppListItem, Status } from "./types";

async function jsonOrThrow(res: Response) {
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* tolerate empty body */
  }
  if (!res.ok) {
    throw new Error(data?.detail || `Request failed (${res.status})`);
  }
  return data;
}

export type Role = "admin" | "hr";

export async function checkSession(): Promise<Role | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    const data = await res.json();
    return data.authed ? (data.role as Role) : null;
  } catch {
    return null;
  }
}

export async function login(role: Role, password: string): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, password }),
  });
  return res.ok;
}

export interface InviteResult {
  success: boolean;
  email: string;
}

export async function sendInvite(email: string): Promise<InviteResult> {
  const res = await fetch("/api/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return jsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function fetchApplications(params: {
  search?: string;
  org?: string;
  status?: string;
}): Promise<AppListItem[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.org && params.org !== "all") qs.set("org", params.org);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  const res = await fetch("/api/applications" + (qs.toString() ? `?${qs}` : ""), {
    cache: "no-store",
  });
  const data = await jsonOrThrow(res);
  return data.applications || [];
}

export async function fetchApplication(id: number): Promise<AppDetail> {
  const res = await fetch(`/api/applications/${id}`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function updateStatus(id: number, status: Status): Promise<void> {
  const res = await fetch(`/api/applications/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await jsonOrThrow(res);
}

export interface SalaryPayload {
  current_salary: string;
  expected_salary: string;
  ctc_offered: string;
  salary_notes: string;
}

export async function updateSalary(
  id: number,
  payload: SalaryPayload
): Promise<{ salary_updated_at?: string }> {
  const res = await fetch(`/api/applications/${id}/salary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}
