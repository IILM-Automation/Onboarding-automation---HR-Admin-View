"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApplications, logout, sendInvite, type Session } from "@/lib/client";
import type { AppListItem, Status } from "@/lib/types";
import { useToast } from "./Toast";
import AppList from "./AppList";
import AppDetail from "./AppDetail";

const CAMPUSES = ["Delhi", "Jaipur", "Chandigarh"];

export default function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const toast = useToast();
  const isAdmin = session.role === "admin";

  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [campus, setCampus] = useState("all"); // super-admin campus filter only
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false); // mobile slide-in
  const [inviteOpen, setInviteOpen] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (s: string, st: string, cmp: string, df: string, dt: string) => {
      setLoading(true);
      try {
        // Campus users are scoped server-side; only super-admin sends a campus filter.
        const data = await fetchApplications({
          search: s,
          status: st,
          campus: isAdmin ? cmp : undefined,
          dateFrom: df,
          dateTo: dt,
        });
        setApps(data);
      } catch (e) {
        toast((e as Error).message || "Failed to load applications", "error");
        setApps([]);
      } finally {
        setLoading(false);
      }
    },
    [toast, isAdmin]
  );

  useEffect(() => {
    load(search, status, campus, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, campus, dateFrom, dateTo]);

  function onSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v, status, campus, dateFrom, dateTo), 300);
  }

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  function selectApp(id: number) {
    setSelectedId(id);
    setShowDetail(true);
  }

  function patchLocalStatus(id: number, newStatus: Status) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
  }

  async function doLogout() {
    await logout();
    onLogout();
  }

  return (
    <div className={`shell${showDetail ? " show-detail" : ""}`}>
      <AppList
        apps={apps}
        loading={loading}
        search={search}
        status={status}
        campus={campus}
        isAdmin={isAdmin}
        sessionCampus={session.campus}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedId={selectedId}
        onSearch={onSearchChange}
        onStatus={setStatus}
        onCampus={setCampus}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        onClearDates={clearDates}
        onSelect={selectApp}
        onInvite={() => setInviteOpen(true)}
        onLogout={doLogout}
      />
      <AppDetail id={selectedId} onBack={() => setShowDetail(false)} onStatusChange={patchLocalStatus} />

      {inviteOpen && (
        <InviteModal
          isAdmin={isAdmin}
          sessionCampus={session.campus}
          onClose={() => setInviteOpen(false)}
          onSent={() => load(search, status, campus, dateFrom, dateTo)}
        />
      )}
    </div>
  );
}

function InviteModal({
  isAdmin,
  sessionCampus,
  onClose,
  onSent,
}: {
  isAdmin: boolean;
  sessionCampus: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [campus, setCampus] = useState(isAdmin ? "" : sessionCampus);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!email.trim()) return toast("Please enter a candidate email.", "error");
    if (isAdmin && !campus) return toast("Please choose a campus for this invite.", "error");
    setBusy(true);
    try {
      const res = await sendInvite(email.trim(), isAdmin ? campus : undefined);
      toast(`Invite sent to ${res.email} (${res.campus || sessionCampus})`, "success");
      setEmail("");
      onSent();
      onClose();
    } catch (e) {
      toast((e as Error).message || "Failed to create invite", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Invite a candidate</div>
        <p className="modal-sub">
          {isAdmin ? "Choose the campus this candidate is applying to." : `Campus: ${sessionCampus}`}
        </p>
        <div className="salary-field" style={{ marginBottom: 12 }}>
          <label>Candidate email</label>
          <input
            type="email"
            value={email}
            autoFocus
            placeholder="candidate@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {isAdmin && (
          <div className="salary-field" style={{ marginBottom: 12 }}>
            <label>Campus</label>
            <select value={campus} onChange={(e) => setCampus(e.target.value)}>
              <option value="">Select campus…</option>
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="modal-foot">
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-accent" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
