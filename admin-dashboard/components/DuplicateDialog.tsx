"use client";

import type { DuplicateCheck, PriorApplication, PriorInvites } from "@/lib/client";
import { STATUS_LABELS } from "@/lib/types";
import type { Status } from "@/lib/types";
import { fmtDate } from "@/lib/format";

/**
 * Repeat-candidate warning. Shown when HR invites someone the system has
 * seen before, with the two choices agreed with HR: send anyway, or go back.
 *
 * It never blocks — "Send anyway" always works. Its job is to make sure the
 * decision is made knowingly rather than by accident.
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
  if (a.rounds > 0) {
    parts.push(`${a.rounds} interview round${a.rounds === 1 ? "" : "s"} recorded`);
  } else {
    parts.push("no interview recorded");
  }
  if (a.status) parts.push(STATUS_LABELS[a.status as Status] ?? a.status);
  return parts.join(" · ");
}

function describeInvites(i: PriorInvites): string {
  const when = i.last_on ? fmtDate(i.last_on) : "an earlier date";
  const many = i.count > 1;
  const lead = many
    ? `Invited ${i.count} times at ${where(i)}, most recently ${when}`
    : `Invited at ${where(i)} on ${when}`;
  // A live link means HR is simply re-sending it — much milder than a
  // candidate who was invited and never came back.
  return `${lead} · ${i.has_pending ? "a link is still active" : "never completed the form"}`;
}

export default function DuplicateDialog({
  check,
  email,
  busy,
  onSendAnyway,
  onGoBack,
}: {
  check: DuplicateCheck;
  email: string;
  busy?: boolean;
  onSendAnyway: () => void;
  onGoBack: () => void;
}) {
  const high = check.severity === "high";

  return (
    <div className="modal-overlay dup-overlay" onClick={onGoBack}>
      <div
        className="modal-card dup-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`dup-banner ${high ? "dup-high" : "dup-low"}`}>
          <span className="dup-icon" aria-hidden="true">
            {high ? "!" : "i"}
          </span>
          <div>
            <div className="section-title" id="dup-title" style={{ margin: 0 }}>
              {high ? "This candidate has applied before" : "This candidate has been invited before"}
            </div>
            <div className="dup-email">{email}</div>
          </div>
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

        {check.applications.some((a) => a.redacted) || check.invites.some((v) => v.redacted) ? (
          <p className="dup-note">
            Records from other campuses are shown without campus or outcome details.
          </p>
        ) : null}

        <div className="modal-foot">
          <button className="btn-outline" onClick={onGoBack} disabled={busy}>
            Go back
          </button>
          <button className="btn-accent dup-send" onClick={onSendAnyway} disabled={busy}>
            {busy ? "Sending…" : "Send anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact inline version for the early (on-blur) warning. */
export function DuplicateHint({ check }: { check: DuplicateCheck }) {
  if (!check.duplicate) return null;
  const apps = check.applications.length;
  const invites = check.invites.reduce((n, v) => n + v.count, 0);
  const bits: string[] = [];
  if (apps) bits.push(`${apps} previous application${apps === 1 ? "" : "s"}`);
  if (invites) bits.push(`${invites} previous invite${invites === 1 ? "" : "s"}`);
  return (
    <p className={`dup-hint ${check.severity === "high" ? "dup-high" : "dup-low"}`}>
      Seen before — {bits.join(" and ")}. You&apos;ll be asked to confirm.
    </p>
  );
}
