"use client";

import type { RelatedApplication, Status } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { fmtDate } from "@/lib/format";

/**
 * "This looks like the same person" banner on the candidate detail.
 *
 * Email and mobile matches are reported separately because they carry very
 * different confidence. An email match is effectively certain. A mobile-only
 * match is a strong hint that a household could explain, so it is worded as a
 * possibility and never asserts the records are the same person.
 *
 * Cross-campus records arrive already stripped of campus, name, outcome and
 * id, so this component cannot disclose them even by accident.
 */

function describe(r: RelatedApplication): string {
  const when = r.applied_on ? fmtDate(r.applied_on) : "an earlier date";
  const who = r.redacted ? "another BTS campus" : r.campus ? `${r.campus} campus` : "this campus";
  const bits = [`Applied at ${who} on ${when}`];
  if (r.name) bits.push(r.name);
  if (r.status) bits.push(STATUS_LABELS[r.status as Status] ?? r.status);
  return bits.join(" · ");
}

export default function RelatedBanner({
  related,
  onOpen,
}: {
  related: RelatedApplication[];
  onOpen: (id: number) => void;
}) {
  if (!related?.length) return null;

  const confirmed = related.filter((r) => r.by_email);
  const possible = related.filter((r) => !r.by_email && r.by_mobile);
  const level = confirmed.length ? "confirmed" : "possible";

  return (
    <div className={`related-banner related-${level}`} role="status">
      <div className="related-head">
        <span className="related-icon" aria-hidden="true">
          {confirmed.length ? "!" : "?"}
        </span>
        <span className="related-title">
          {confirmed.length
            ? "This candidate has other applications on file"
            : "Possible duplicate — same contact number"}
        </span>
      </div>

      <ul className="related-list">
        {confirmed.map((r, i) => (
          <li key={`c${i}`} className={r.redacted ? "related-redacted" : ""}>
            <span className="related-tag related-tag-email">same email</span>
            <span>{describe(r)}</span>
            {r.id != null && (
              <button className="related-open" onClick={() => onOpen(r.id as number)}>
                Open
              </button>
            )}
          </li>
        ))}
        {possible.map((r, i) => (
          <li key={`p${i}`} className={r.redacted ? "related-redacted" : ""}>
            <span className="related-tag related-tag-mobile">same number</span>
            <span>{describe(r)}</span>
            {r.id != null && (
              <button className="related-open" onClick={() => onOpen(r.id as number)}>
                Open
              </button>
            )}
          </li>
        ))}
      </ul>

      {possible.length > 0 && (
        <p className="related-note">
          A shared contact number is a strong hint, not proof — family members sometimes share one.
          Check the details before treating these as the same person.
        </p>
      )}
    </div>
  );
}
