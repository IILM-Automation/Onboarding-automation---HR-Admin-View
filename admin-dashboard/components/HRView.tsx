"use client";

import { useEffect, useRef, useState } from "react";
import { logout, sendInvite, type InviteResult } from "@/lib/client";
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

  async function submit() {
    if (busy) return;
    const value = email.trim();
    if (!value) {
      toast("Please enter a candidate email address.", "error");
      return;
    }
    // Lock immediately — guards against double-clicks racing the request.
    setBusy(true);
    startLock();
    try {
      const res: InviteResult = await sendInvite(value);
      const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setSent((prev) => [{ email: res.email, at }, ...prev]);
      setEmail("");
      toast(`Invite sent to ${res.email}`, "success");
    } catch (e) {
      // On failure, release the lock right away so HR can retry/fix.
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(0);
      setBusy(false);
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
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button className="hr-submit" onClick={submit} disabled={busy}>
              {busy ? (countdown > 0 ? `Please wait ${countdown}s` : "Sending…") : "Send Invite"}
            </button>
          </div>
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
