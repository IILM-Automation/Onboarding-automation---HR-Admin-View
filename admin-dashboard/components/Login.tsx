"use client";

import { useState } from "react";
import { login, type Role } from "@/lib/client";

export default function Login({ onSuccess }: { onSuccess: (role: Role) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoFail, setLogoFail] = useState(false);

  async function submit() {
    if (busy || !role) return;
    setBusy(true);
    setErr("");
    const ok = await login(role, pw);
    setBusy(false);
    if (ok) {
      onSuccess(role);
    } else {
      setErr("Incorrect password");
      setPw("");
      setShake(false);
      requestAnimationFrame(() => setShake(true));
    }
  }

  function pickRole(r: Role | null) {
    setRole(r);
    setPw("");
    setErr("");
  }

  return (
    <div className="login">
      <div
        className={`login-card${shake ? " shake" : ""}`}
        onAnimationEnd={(e) => {
          if (e.animationName === "shake") setShake(false);
        }}
      >
        {logoFail ? (
          <>
            <div className="wordmark">
              <span className="wm-mark">F2F</span>
            </div>
            <div className="login-title">BTS &middot; IILM</div>
          </>
        ) : (
          <div className="brand-plate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-logo"
              src="/logos/iilm.png"
              alt="IILM"
              onError={() => setLogoFail(true)}
            />
            <span className="brand-div" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-logo"
              src="/logos/bts.png"
              alt="Banyan Tree School"
              onError={() => setLogoFail(true)}
            />
          </div>
        )}
        <div className="login-sub">HR &amp; Admin Portal</div>

        {role === null ? (
          <>
            <div className="role-prompt">Choose your division</div>
            <div className="role-grid">
              <button className="role-card" onClick={() => pickRole("hr")}>
                <span className="role-emoji">📨</span>
                <span className="role-name">HR</span>
                <span className="role-desc">Invite arrived candidates</span>
              </button>
              <button className="role-card" onClick={() => pickRole("admin")}>
                <span className="role-emoji">📋</span>
                <span className="role-name">Admin</span>
                <span className="role-desc">Review applications</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="role-chip">
              <span>{role === "hr" ? "📨 HR" : "📋 Admin"}</span>
              <button className="role-switch" onClick={() => pickRole(null)}>
                Change
              </button>
            </div>
            <input
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              value={pw}
              autoFocus
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <div className="login-err">{err}</div>
          </>
        )}

        <div className="login-foot">Authorised personnel only</div>
      </div>
    </div>
  );
}
