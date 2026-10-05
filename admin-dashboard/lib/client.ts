/**
 * Browser-side API client. Talks to this app's own /api/* route
 * handlers (same-origin, cookie-authenticated). The backend URL and
 * API key live only on the server — never here.
 */
import type { AppDetail, AppListItem, InterviewNote, InterviewRound, Status } from "./types";

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

export type Role = "admin" | "hr" | "interviewer";
/** "all" for super-admin, else a campus name (Delhi/Jaipur/Chandigarh). */
export type CampusScope = string;
export type Scope = "admin" | string;

export interface Session {
  role: Role;
  campus: CampusScope;
}

export async function checkSession(): Promise<Session | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    const data = await res.json();
    return data.authed ? { role: data.role as Role, campus: data.campus as string } : null;
  } catch {
    return null;
  }
}

export type LoginMode = "dashboard" | "interview";

export async function login(
  scope: Scope,
  password: string,
  mode: LoginMode = "dashboard"
): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, password, mode }),
  });
  return res.ok;
}

/** All panelists' notes for a candidate. */
export async function fetchNotes(appId: number): Promise<InterviewNote[]> {
  const res = await fetch(`/api/applications/${appId}/notes`, { cache: "no-store" });
  const data = await jsonOrThrow(res);
  return data.notes || [];
}

/** Create / update one interviewer's note row. */
export async function saveNote(
  appId: number,
  note: InterviewNote & { force_new?: boolean }
): Promise<{ id: number }> {
  const res = await fetch(`/api/applications/${appId}/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  return jsonOrThrow(res);
}

/** Delete one note (HR / super-admin only). */
export async function deleteNote(appId: number, noteId: number): Promise<void> {
  const res = await fetch(`/api/applications/${appId}/notes/${noteId}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

export interface InviteResult {
  success: boolean;
  email: string;
  campus?: string;
}

/* ---------------- Repeat-candidate detection ---------------- */

/** A prior application. Fields are null when the record belongs to another
 *  campus — the backend strips them before sending, so "redacted" here is a
 *  statement of fact, not a rendering hint. */
export interface PriorApplication {
  redacted: boolean;
  campus: string | null;
  applied_on: string | null;
  status: string | null;
  rounds: number;
  application_id: number | null;
}

/** Prior invites that never became an application, collapsed per campus.
 *  HR re-sends links routinely, so these arrive as a count, not a list. */
export interface PriorInvites {
  redacted: boolean;
  campus: string | null;
  count: number;
  last_on: string | null;
  /** A link is still live — this is a resend, not a lapsed invite. */
  has_pending: boolean;
}

export interface DuplicateCheck {
  duplicate: boolean;
  email?: string;
  /** high = a real prior application, low = invites only, none = new. */
  severity: "high" | "low" | "none";
  applications: PriorApplication[];
  invites: PriorInvites[];
}

const NO_DUPLICATE: DuplicateCheck = {
  duplicate: false,
  severity: "none",
  applications: [],
  invites: [],
};

/** Thrown when the backend refuses an un-acknowledged duplicate (HTTP 409). */
export class DuplicateInviteError extends Error {
  check: DuplicateCheck;
  constructor(check: DuplicateCheck) {
    super("This candidate has been invited or has applied before.");
    this.name = "DuplicateInviteError";
    this.check = check;
  }
}

/**
 * Early warning as HR leaves the email field. Deliberately fails OPEN: a
 * precheck that errors must never stop HR inviting someone, because the
 * authoritative duplicate gate lives in POST /invites and will still fire.
 */
export async function precheckInvite(email: string): Promise<DuplicateCheck> {
  try {
    const res = await fetch(`/api/invite/precheck?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    });
    if (!res.ok) return NO_DUPLICATE;
    return (await res.json()) as DuplicateCheck;
  } catch {
    return NO_DUPLICATE;
  }
}

/** campus is required only for super-admin; campus users are scoped server-side.
 *  Throws DuplicateInviteError when the candidate has been seen before and
 *  duplicateAck has not been given. */
export async function sendInvite(
  email: string,
  campus?: string,
  opts: { duplicateAck?: boolean } = {}
): Promise<InviteResult> {
  const res = await fetch("/api/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      ...(campus ? { campus } : {}),
      ...(opts.duplicateAck ? { duplicate_ack: true } : {}),
    }),
  });

  if (res.status === 409) {
    const data = await res.json().catch(() => null);
    if (data?.duplicate) throw new DuplicateInviteError(data as DuplicateCheck);
  }
  return jsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function fetchApplications(params: {
  search?: string;
  org?: string;
  status?: string;
  campus?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AppListItem[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.org && params.org !== "all") qs.set("org", params.org);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.campus && params.campus !== "all") qs.set("campus", params.campus);
  if (params.dateFrom) qs.set("date_from", params.dateFrom);
  if (params.dateTo) qs.set("date_to", params.dateTo);
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

/** Super-admin only: reassign an application's campus. */
export async function updateCampus(id: number, campus: string): Promise<void> {
  const res = await fetch(`/api/applications/${id}/campus`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campus }),
  });
  await jsonOrThrow(res);
}

/**
 * Confidential salary block only. Interview notes are saved separately via
 * saveNote() so panelists can never overwrite each other.
 */
export interface SalaryPayload {
  current_salary: string;
  expected_salary: string;
  ctc_offered: string;
  salary_notes: string;
  /** Legacy JSONB rounds — no longer written by the UI. */
  interview_rounds?: InterviewRound[];
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
