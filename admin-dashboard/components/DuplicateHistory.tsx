"use client";

import type { DuplicateCheck, PriorApplication, PriorInvites } from "@/lib/client";
import { STATUS_LABELS } from "@/lib/types";
import type { Status } from "@/lib/types";
import { fmtDate } from "@/lib/format";

/**
 * Repeat-candidate history, rendered INLINE inside the invite modal.
 *
 * Deliberately not a second modal stacked on the first: one surface, one
 * place to look, and Send Invite stays reachable the whole time. HR sees
 * the history and still decides.
 *
 * Anything marked `redacted` belongs to another campus. The backend has
 * already stripped the campus name, the outcome and the record id, so this
 * component CANNOT reveal them even by mistake — it only has the date.
 */

function where(r: { redacted: boolean; campus: string | null }): string {
  if (r.redacted) return "another BTS campus";
  return r.campus ? `${r.campus} campus` : "an unassigned campus";
}

function describeApplication(a: PriorApplication): string {
  const when = a.applied_on ? fmtDate(a.applied_on) : "an earlier date";
  const parts = [`Applied at ${where(a)} on ${when}`];
  parts.push(
    a.rounds > 0
      ? `${a.rounds} interview round${a.rounds === 1 ? "" : "s"}`
      : "no interview recorded"
  );
  if (a.status) parts.push(STATUS_LABELS[a.status as Status] ?? a.status);
  return parts.join(" · ");
}

function describeInvites(i: PriorInvites): string {
  const when = i.last_on ? fmtDate(i.last_on) : "an earlier date";
  const lead =
    i.count > 1
      ? `Invited ${i.count} times at ${where(i)}, most recently ${when}`
      : `Invited at ${where(i)} on ${when}`;
  // A live link means HR is simply re-sending it — much milder than a
  // candidate who was invited and never came back.
  return `${lead} · ${i.has_pending ? "a link is still active" : "never completed the form"}`;
}

/** Green all-clear line shown once a new candidate has been checked. */
export function DuplicateClear() {
  return (
    <div className="dup-panel dup-clear">
      <span className="dup-icon dup-icon-ok" aria-hidden="true">
        ✓
      </span>
      <span>No prior record — this candidate is new.</span>
    </div>
  );
}

export default function DuplicateHistory({ check }: { check: DuplicateCheck }) {
  const high = check.severity === "high";
  const anyRedacted =
    check.applications.some((a) => a.redacted) || check.invites.some((v) => v.redacted);

  return (
    <div className={`dup-panel ${high ? "dup-high" : "dup-low"}`} role="status">
      <div className="dup-head">
        <span className="dup-icon" aria-hidden="true">
          {high ? "!" : "i"}
        </span>
        <span className="dup-title">
          {high ? "This candidate has applied before" : "This candidate has been invited before"}
        </span>
      </div>

      <ul className="dup-list">
        {check.applications.map((a, i) => (
          <li key={`a${i}`} className={`dup-row${a.redacted ? " dup-redacted" : ""}`}>
            <span className="dup-dot" aria-hidden="true" />
            <span>{describeApplication(a)}</span>
          </li>
        ))}
        {check.invites.map((v, i) => (
          <li key={`i${i}`} className={`dup-row dup-row-soft${v.redacted ? " dup-redacted" : ""}`}>
            <span className="dup-dot" aria-hidden="true" />
            <span>{describeInvites(v)}</span>
          </li>
        ))}
      </ul>

      {anyRedacted && (
        <p className="dup-note">
          Records from other campuses are shown without campus or outcome details.
        </p>
      )}
    </div>
  );
}
