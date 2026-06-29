"use client";

import { useEffect, useState } from "react";
import { fetchApplication, updateStatus } from "@/lib/client";
import type { AppDetail as Detail, Status } from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { fmtDate, fullName, has, statusVar } from "@/lib/format";
import { useToast } from "./Toast";
import OverviewTab from "./tabs/OverviewTab";
import WorkTab from "./tabs/WorkTab";
import CareerTab from "./tabs/CareerTab";

type TabKey = "overview" | "work" | "career";

interface Props {
  id: number | null;
  onBack: () => void;
  onStatusChange: (id: number, status: Status) => void;
}

export default function AppDetail({ id, onBack, onStatusChange }: Props) {
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    if (id === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setTab("overview");
    setDetail(null);
    fetchApplication(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message || "Failed to load application");
          toast((e as Error).message || "Failed to load application", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  async function onStatusSelect(status: Status) {
    if (!detail) return;
    try {
      await updateStatus(detail.id, status);
      setDetail({ ...detail, status });
      onStatusChange(detail.id, status);
      toast(`Status updated to ${STATUS_LABELS[status]}`, "success");
    } catch (e) {
      toast((e as Error).message || "Failed to update status", "error");
    }
  }

  return (
    <main className="detail-panel">
      {id === null ? (
        <div className="placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <div>Select an application to view details</div>
        </div>
      ) : loading ? (
        <div className="spinner-wrap">
          <div className="spinner" />
        </div>
      ) : error || !detail ? (
        <div className="placeholder">{error || "Failed to load application"}</div>
      ) : (
        <div className="detail-inner">
          <button className="mobile-back" onClick={onBack}>
            ← Back to list
          </button>

          <div className="detail-header">
            <div className="dh-main">
              <div className="dh-name">{fullName(detail)}</div>
              <div className="dh-sub">
                <span>{has(detail.position_applied_for) ? detail.position_applied_for : "—"}</span>
                {detail.org && <span className={`org-badge ${detail.org}`}>{detail.org}</span>}
              </div>
              <div className="dh-statusrow">
                <span className="status-badge" style={{ background: statusVar(detail.status) }}>
                  {detail.status ? STATUS_LABELS[detail.status] : "—"}
                </span>
                <select
                  value={detail.status || "submitted"}
                  onChange={(e) => onStatusSelect(e.target.value as Status)}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dh-date">
                Submitted {fmtDate(detail.created_at) || "—"} · {has(detail.email) ? detail.email : "no email"}
              </div>
            </div>
            {has(detail.photo_base64) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dh-photo" src={detail.photo_base64 as string} alt="candidate photo" />
            )}
          </div>

          <div className="tabs">
            <button className={`tab${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>
              Overview
            </button>
            <button className={`tab${tab === "work" ? " active" : ""}`} onClick={() => setTab("work")}>
              Work History
            </button>
            <button className={`tab${tab === "career" ? " active" : ""}`} onClick={() => setTab("career")}>
              Career &amp; References
            </button>
          </div>

          {tab === "overview" && <OverviewTab app={detail} onSaved={(d) => setDetail(d)} />}
          {tab === "work" && <WorkTab app={detail} />}
          {tab === "career" && <CareerTab app={detail} />}
        </div>
      )}
    </main>
  );
}
