"use client";

import { useEffect, useRef, useState } from "react";
import {
  DuplicateInviteError,
  logout,
  precheckInvite,
  sendInvite,
  type DuplicateCheck,
  type InviteResult,
} from "@/lib/client";
import DuplicateHistory, { DuplicateClear } from "./DuplicateHistory";
import { useToast } from "./Toast";

// Must comfortably cover the backend webhook window so a second invite
// can't race the first. Matches WEBHOOK_TIMEOUT_SECS on the backend.
const LOCK_SECONDS = 7;

interface SentItem {
  email: string;
  at: string;
}

export default function HRView({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sent, setSent] = useState<SentItem[]>([]);
  // The history lookup gates the send; "idle" means the address in the box
  // has not been checked yet, so Send stays locked.
  const [state, setState] = useState<"idle" | "checking" | "clear" | "found">("idle");
  const [check, setCheck] = useState<DuplicateCheck | null>(null);
  const checkedFor = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startLock() {
    setCountdown(LOCK_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setBusy(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function releaseLock() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(0);
    setBusy(false);
  }

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
    const value = email.trim();
    if (!value) {
      toast("Please enter a candidate email address.", "error");
      return;
    }
    if (!checked) return runCheck(); // never send un-checked
    // Lock immediately — guards against double-clicks racing the request.
    setBusy(true);
    startLock();
    try {
      // HR has seen the history inline, so the acknowledgement is implicit.
      const res: InviteResult = await sendInvite(value, undefined, {
        duplicateAck: state === "found",
      });
      const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setSent((prev) => [{ email: res.email, at }, ...prev]);
      setEmail("");
      setCheck(null);
      setState("idle");
      toast(`Invite sent to ${res.email}`, "success");
    } catch (e) {
      // Release the lock first: whether HR is fixing a typo or reviewing a
      // repeat candidate, they need the button back immediately.
      releaseLock();
      if (e instanceof DuplicateInviteError) {
        setCheck(e.check);
        setState("found");
        checkedFor.current = value;
        toast("This candidate has applied before — review below.", "error");
        return;
      }
      toast((e as Error).message || "Failed to create invite", "error");
    }
  }

  async function doLogout() {
    await logout();
    onLogout();
  }

  return (
    <div className="hr-shell">
      <header className="hr-topbar">
        <div className="hr-brand">
          <span className="wm-mark hr-mark">BTS</span>
          <div>
            <div className="hr-brand-title">HR Portal</div>
            <div className="hr-brand-sub">Candidate Invitations</div>
          </div>
        </div>
        <button className="logout-btn" onClick={doLogout}>
          Sign out
        </button>
      </header>

      <main className="hr-main">
        <section className="hr-card">
          <h1 className="hr-h1">Add an arrived candidate</h1>
          <p className="hr-lead">
            Enter the candidate&apos;s email. We&apos;ll create a secure form link and email it to
            them automatically.
          </p>

          <label className="hr-label" htmlFor="hr-email">
            Candidate email
          </label>
          <div className="hr-inputrow">
            <input
              id="hr-email"
              type="email"
              className="hr-input"
              placeholder="candidate@example.com"
              value={email}
              autoFocus
              disabled={busy}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button
              type="button"
              className="btn-outline invite-check"
              onClick={runCheck}
              disabled={state === "checking" || !email.trim() || busy}
            >
              {state === "checking" ? "Checking…" : "Check"}
            </button>
            <button
              className="hr-submit"
              onClick={() => submit()}
              disabled={busy || !checked}
              title={checked ? undefined : "Run the duplicate check before sending"}
            >
              {busy
                ? countdown > 0
                  ? `Please wait ${countdown}s`
                  : "Sending…"
                : state === "found"
                  ? "Send anyway"
                  : "Send Invite"}
            </button>
          </div>
          {state === "clear" && <DuplicateClear />}
          {state === "found" && check && <DuplicateHistory check={check} />}
          <p className="hr-hint">
            The button stays locked for {LOCK_SECONDS}s after each send so invites can&apos;t collide.
          </p>
        </section>

        {sent.length > 0 && (
          <section className="hr-card">
            <div className="hr-sub-title">Invited this session</div>
            <ul className="hr-sent">
              {sent.map((s, i) => (
                <li className="hr-sent-row" key={i}>
                  <div className="hr-sent-main">
                    <span className="hr-sent-email">{s.email}</span>
                    <span className="hr-sent-tag">Sent {s.at}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

    </div>
  );
}
