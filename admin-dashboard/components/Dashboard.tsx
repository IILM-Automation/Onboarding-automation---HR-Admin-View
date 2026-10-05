"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DuplicateInviteError,
  fetchApplications,
  logout,
  precheckInvite,
  sendInvite,
  type DuplicateCheck,
  type Session,
} from "@/lib/client";
import type { AppListItem, Status } from "@/lib/types";
import { useToast } from "./Toast";
import AppList from "./AppList";
import AppDetail from "./AppDetail";
import DuplicateHistory, { DuplicateClear } from "./DuplicateHistory";

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

  function patchLocalCampus(id: number, newCampus: string) {
    setApps((prev) =>
      // If a specific campus filter is active and the row no longer matches, drop it from view.
      prev
        .map((a) => (a.id === id ? { ...a, campus: newCampus } : a))
        .filter((a) => campus === "all" || a.campus === campus)
    );
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
      <AppDetail
        id={selectedId}
        isAdmin={isAdmin}
        onBack={() => setShowDetail(false)}
        onStatusChange={patchLocalStatus}
        onCampusChange={patchLocalCampus}
      />

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

  // The history lookup gates the send. "idle" = not yet checked for the
  // address currently in the box, so Send stays locked; any other state
  // means HR has seen the answer and may proceed.
  const [state, setState] = useState<"idle" | "checking" | "clear" | "found">("idle");
  const [check, setCheck] = useState<DuplicateCheck | null>(null);
  // Which address the current result belongs to, so editing the email
  // re-locks the button instead of showing a stale verdict.
  const checkedFor = useRef("");

  async function runCheck() {
    const value = email.trim();
    if (!value) {
      setState("idle");
      setCheck(null);
      return;
    }
    if (state === "checking") return;
    setState("checking");
    const result = await precheckInvite(value);
    checkedFor.current = value;
    setCheck(result.duplicate ? result : null);
    setState(result.duplicate ? "found" : "clear");
  }

  const checked = state === "clear" || state === "found";

  async function submit() {
    if (busy) return;
    if (!email.trim()) return toast("Please enter a candidate email.", "error");
    if (isAdmin && !campus) return toast("Please choose a campus for this invite.", "error");
    if (!checked) return runCheck(); // never send un-checked
    setBusy(true);
    try {
      // HR has seen the history inline, so the acknowledgement is implicit.
      // The backend's 409 remains as a backstop for anything that slips past.
      const res = await sendInvite(email.trim(), isAdmin ? campus : undefined, {
        duplicateAck: state === "found",
      });
      toast(`Invite sent to ${res.email} (${res.campus || sessionCampus})`, "success");
      setEmail("");
      setCheck(null);
      setState("idle");
      onSent();
      onClose();
    } catch (e) {
      // Backstop: the address changed between the check and the send, or the
      // precheck failed open. Show the history rather than a bare error.
      if (e instanceof DuplicateInviteError) {
        setCheck(e.check);
        setState("found");
        checkedFor.current = email.trim();
        toast("This candidate has applied before — review below.", "error");
        return;
      }
      toast((e as Error).message || "Failed to create invite", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card invite-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Invite a candidate</div>
        <p className="modal-sub">
          {isAdmin ? "Choose the campus this candidate is applying to." : `Campus: ${sessionCampus}`}
        </p>
        <div className="salary-field" style={{ marginBottom: 12 }}>
          <label>Candidate email</label>
          <div className="invite-emailrow">
            <input
              type="email"
              value={email}
              autoFocus
              placeholder="candidate@example.com"
              onChange={(e) => {
                const next = e.target.value;
                setEmail(next);
                // Re-lock as soon as the address differs from what we checked.
                if (next.trim() !== checkedFor.current) {
                  setState("idle");
                  setCheck(null);
                }
              }}
              onBlur={runCheck}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              className="btn-outline invite-check"
              onClick={runCheck}
              disabled={state === "checking" || !email.trim() || busy}
            >
              {state === "checking" ? "Checking…" : "Check"}
            </button>
          </div>
          {state === "clear" && <DuplicateClear />}
          {state === "found" && check && <DuplicateHistory check={check} />}
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
          {!checked && (
            <span className="invite-gate-note">Check the candidate first</span>
          )}
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={`btn-accent${state === "found" ? " btn-danger" : ""}`}
            onClick={() => submit()}
            disabled={busy || !checked}
            title={checked ? undefined : "Run the duplicate check before sending"}
          >
            {busy ? "Sending…" : state === "found" ? "Send anyway" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
