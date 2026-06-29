"use client";

import type { AppListItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { fullName, relativeDate, statusVar, has } from "@/lib/format";

interface Props {
  apps: AppListItem[];
  loading: boolean;
  search: string;
  status: string;
  selectedId: number | null;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onSelect: (id: number) => void;
  onLogout: () => void;
}

export default function AppList(p: Props) {
  return (
    <aside className="list-panel">
      <div className="list-head">
        <div className="list-title-row">
          <span className="list-title">Applications</span>
          <span className="count-badge">{p.apps.length}</span>
          <button className="logout-btn" onClick={p.onLogout}>
            Sign out
          </button>
        </div>
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
            <option value="rejected">Rejected</option>
            <option value="active_file">Active File</option>
            <option value="appointed">Appointed</option>
          </select>
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
                <span className="card-name">{fullName(a)}</span>
                <span className="card-pos">{has(a.position_applied_for) ? a.position_applied_for : "—"}</span>
                <span className="card-badges">
                  {a.org && <span className={`org-badge ${a.org}`}>{a.org}</span>}
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
