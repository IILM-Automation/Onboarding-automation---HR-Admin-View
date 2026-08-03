"use client";

import { useState } from "react";
import { login, checkSession, type Session } from "@/lib/client";

type Scope = "admin" | "Delhi" | "Jaipur" | "Chandigarh";

const CAMPUS_SCOPES: Scope[] = ["Delhi", "Jaipur", "Chandigarh"];

export default function Login({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoFail, setLogoFail] = useState(false);

  async function submit() {
    if (busy || !scope) return;
    setBusy(true);
    setErr("");
    const ok = await login(scope, pw);
    if (ok) {
      const s = await checkSession();
      setBusy(false);
      if (s) return onSuccess(s);
    }
    setBusy(false);
    setErr("Incorrect password");
    setPw("");
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }

  function pickScope(s: Scope | null) {
    setScope(s);
    setPw("");
    setErr("");
  }

  const label = (s: Scope) => (s === "admin" ? "Super Admin" : `BTS ${s}`);

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
            <img className="brand-logo" src="/logos/iilm.png" alt="IILM" onError={() => setLogoFail(true)} />
            <span className="brand-div" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logos/bts.png" alt="Banyan Tree School" onError={() => setLogoFail(true)} />
          </div>
        )}
        <div className="login-sub">HR &amp; Admin Portal</div>

        {scope === null ? (
          <>
            <div className="role-prompt">Choose your campus</div>
            <div className="role-grid">
              {CAMPUS_SCOPES.map((s) => (
                <button className="role-card" key={s} onClick={() => pickScope(s)}>
                  <span className="role-emoji">🏫</span>
                  <span className="role-name">{s}</span>
                  <span className="role-desc">Banyan Tree School</span>
                </button>
              ))}
              <button className="role-card" onClick={() => pickScope("admin")}>
                <span className="role-emoji">🛡️</span>
                <span className="role-name">Super Admin</span>
                <span className="role-desc">All campuses</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="role-chip">
              <span>{scope === "admin" ? "🛡️ " : "🏫 "}{label(scope)}</span>
              <button className="role-switch" onClick={() => pickScope(null)}>
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
