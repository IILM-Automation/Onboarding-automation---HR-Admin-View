"use client";

import type { AppListItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { fmtDate, fullName, relativeDate, statusVar, has } from "@/lib/format";

/**
 * How confident are we that this candidate is a repeat?
 *   confirmed — same email, or a match in the imported recruitment records.
 *   possible  — only the mobile number matches. Strong, but a household can
 *               share a number, so it is never asserted as the same person.
 *   null      — no signal.
 */
function repeatFlag(a: AppListItem): { level: "confirmed" | "possible"; title: string } | null {
  const earlier = a.prior_count ?? 0;
  const external = a.prior_external ?? 0;
  const byMobile = a.mobile_match_count ?? 0;
  const parts: string[] = [];

  if (earlier > 0) {
    parts.push(
      `applied before${a.prior_on ? ` on ${fmtDate(a.prior_on)}` : ""}` +
        (earlier > 1 ? ` (${earlier} earlier applications)` : "")
    );
  }
  if (external > 0) {
    parts.push(
      `interviewed before${a.prior_external_on ? ` on ${fmtDate(a.prior_external_on)}` : ""}` +
        " (recruitment records)"
    );
  }
  const confirmed = parts.length > 0;

  if (byMobile > 0) {
    parts.push(
      `same contact number as an earlier application${
        a.mobile_match_on ? ` from ${fmtDate(a.mobile_match_on)}` : ""
      }`
    );
  }
  if (!parts.length) return null;

  const now = a.created_at ? `; this application ${fmtDate(a.created_at)}` : "";
  return {
    level: confirmed ? "confirmed" : "possible",
    title: `${confirmed ? "Repeat candidate" : "Possible repeat"} — ${parts.join("; ")}${now}`,
  };
}

const CAMPUSES = ["Delhi", "Jaipur", "Chandigarh"];

interface Props {
  apps: AppListItem[];
  loading: boolean;
  search: string;
  status: string;
  campus: string;
  isAdmin: boolean;
  sessionCampus: string;
  dateFrom: string;
  dateTo: string;
  selectedId: number | null;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onCampus: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onClearDates: () => void;
  onSelect: (id: number) => void;
  onInvite: () => void;
  onLogout: () => void;
}

export default function AppList(p: Props) {
  return (
    <aside className="list-panel">
      <div className="list-head">
        <div className="list-title-row">
          <span className="list-title">Applications</span>
          <span className="count-badge">{p.apps.length}</span>
          <span className="scope-chip">{p.isAdmin ? "All campuses" : p.sessionCampus}</span>
          <button className="logout-btn" onClick={p.onLogout}>
            Sign out
          </button>
        </div>
        <button className="invite-btn" onClick={p.onInvite}>
          ＋ Invite candidate
        </button>
        <input
          className="search-input"
          type="text"
          placeholder="Search name, email, position…"
          value={p.search}
          onChange={(e) => p.onSearch(e.target.value)}
        />
        <div className="filter-row">
          <select
            className="status-select"
            value={p.status}
            onChange={(e) => p.onStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="interviewed">Interviewed</option>
            <option value="did_not_turn_up">Did Not Turn Up</option>
            <option value="rejected">Rejected</option>
            <option value="active_file">Active File</option>
            <option value="appointed">Appointed</option>
          </select>
          {p.isAdmin && (
            <select className="status-select" value={p.campus} onChange={(e) => p.onCampus(e.target.value)}>
              <option value="all">All Campuses</option>
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        <div className="filter-row date-filter">
          <label className="date-field">
            <span>From</span>
            <input type="date" value={p.dateFrom} max={p.dateTo || undefined} onChange={(e) => p.onDateFrom(e.target.value)} />
          </label>
          <label className="date-field">
            <span>To</span>
            <input type="date" value={p.dateTo} min={p.dateFrom || undefined} onChange={(e) => p.onDateTo(e.target.value)} />
          </label>
          {(p.dateFrom || p.dateTo) && (
            <button className="date-clear" onClick={p.onClearDates} title="Clear date filter">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="cards">
        {p.loading ? (
          <Skeletons />
        ) : p.apps.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <div>No applications found</div>
          </div>
        ) : (
          p.apps.map((a) => (
            <button
              key={a.id}
              className={`card${a.id === p.selectedId ? ` active org-${a.org}` : ""}`}
              onClick={() => p.onSelect(a.id)}
            >
              <span className="card-main">
                <span className="card-name">
                  {(() => {
                    const flag = repeatFlag(a);
                    return flag ? (
                      <span
                        className={`repeat-dot repeat-dot-${flag.level}`}
                        title={flag.title}
                        aria-label={flag.title}
                      />
                    ) : null;
                  })()}
                  {fullName(a)}
                </span>
                <span className="card-pos">{has(a.position_applied_for) ? a.position_applied_for : "—"}</span>
                <span className="card-badges">
                  {a.org && <span className={`org-badge ${a.org}`}>{a.org}</span>}
                  {has(a.campus) && <span className="campus-badge">{a.campus}</span>}
                  <span className="status-badge" style={{ background: statusVar(a.status) }}>
                    {a.status ? STATUS_LABELS[a.status] : "—"}
                  </span>
                </span>
                <span className="card-date">{relativeDate(a.created_at)}</span>
              </span>
              {a.has_photo && (
                <span className="card-avatar">{(a.first_name || "?")[0] || "?"}</span>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="skel" key={i}>
          <div className="skel-line" style={{ width: "70%" }} />
          <div className="skel-line" style={{ width: "50%" }} />
          <div className="skel-line" style={{ width: "40%" }} />
        </div>
      ))}
    </>
  );
}
