/** Pure display helpers, safe for client + server. */
import type { AppListItem, Status } from "./types";

export function has(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

export function fullName(a: Partial<AppListItem>): string {
  const n = [a.salutation, a.first_name, a.middle_name, a.surname]
    .filter(has)
    .join(" ")
    .trim();
  return n || "(no name)";
}

export function statusVar(s?: Status | null): string {
  return `var(--st-${s || "submitted"})`;
}

export function fmtDate(iso?: string | null): string {
  if (!has(iso)) return "";
  const d = new Date(iso as string);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso?: string | null): string {
  if (!has(iso)) return "";
  const d = new Date(iso as string);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeDate(iso?: string | null): string {
  if (!has(iso)) return "";
  const d = new Date(iso as string);
  if (isNaN(d.getTime())) return String(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m > 1 ? "s" : ""} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diff / 86400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}
