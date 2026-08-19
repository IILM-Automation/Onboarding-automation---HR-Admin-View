"use client";

import { useState } from "react";
import { login, checkSession, type Session, type LoginMode } from "@/lib/client";

type Scope = "admin" | "Delhi" | "Jaipur" | "Chandigarh";
type Step = "landing" | "campus" | "door" | "auth";

const CAMPUSES: Scope[] = ["Delhi", "Jaipur", "Chandigarh"];

export default function Login({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [step, setStep] = useState<Step>("landing");
  const [scope, setScope] = useState<Scope | null>(null);
  const [mode, setMode] = useState<LoginMode>("dashboard");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoFail, setLogoFail] = useState(false);

  async function submit() {
    if (busy || !scope) return;
    setBusy(true);
    setErr("");
    const ok = await login(scope, pw, mode);
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

  /** Super Admin has no interview panel — go straight to the password. */
  function pickScope(s: Scope) {
    setScope(s);
    setPw("");
    setErr("");
    if (s === "admin") {
      setMode("dashboard");
      setStep("auth");
    } else {
      setStep("door");
    }
  }

  function pickDoor(m: LoginMode) {
    setMode(m);
    setPw("");
    setErr("");
    setStep("auth");
  }

  const scopeLabel = scope === "admin" ? "Super Admin" : `BTS ${scope}`;
  const doorLabel = mode === "interview" ? "Interview Panel" : "Candidate Dashboard";

  const Logo = () =>
    logoFail ? (
      <div className="bts-logo-fallback">
        <span className="blf-name">Banyan Tree School</span>
        <span className="blf-motto">In Pursuit of Excellence</span>
      </div>
    ) : (
      <div className="bts-logo-plate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bts-logo-img" src="/logos/bts.png" alt="Banyan Tree School" onError={() => setLogoFail(true)} />
      </div>
    );

  return (
    <div className="login">
      <div className="aurora" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <div
        className={`login-card wide${shake ? " shake" : ""}`}
        onAnimationEnd={(e) => { if (e.animationName === "shake") setShake(false); }}
      >
        {/* ─────────── LANDING ─────────── */}
        {step === "landing" && (
          <div className="step" key="landing">
            <Logo />
            <div className="landing-quote">“In Pursuit of Excellence”</div>
            <h1 className="landing-title">Employment Application System</h1>
            <p className="landing-sub">
              Recruitment &amp; onboarding portal for Banyan Tree School campuses.
            </p>
            <button className="btn-primary btn-glow" onClick={() => setStep("campus")}>
              Enter Portal →
            </button>
          </div>
        )}

        {/* ─────────── CAMPUS ─────────── */}
        {step === "campus" && (
          <div className="step" key="campus">
            <button className="ghost-back" onClick={() => setStep("landing")}>← Back</button>
            <div className="choose-head">
              <span className="choose-title">Select your campus</span>
              <span className="choose-sub">Choose a campus, or Super Admin for all campuses</span>
            </div>
            <div className="campus-grid">
              {CAMPUSES.map((c) => (
                <button key={c} className="campus-card" onClick={() => pickScope(c)}>
                  <span className="cc-emoji">🏫</span>
                  <span className="cc-name">{c}</span>
                  <span className="cc-sub">Banyan Tree School</span>
                </button>
              ))}
              <button className="campus-card admin" onClick={() => pickScope("admin")}>
                <span className="cc-emoji">🛡️</span>
                <span className="cc-name">Super Admin</span>
                <span className="cc-sub">All campuses</span>
              </button>
            </div>
          </div>
        )}

        {/* ─────────── DOOR: dashboard vs interview ─────────── */}
        {step === "door" && scope && (
          <div className="step" key="door">
            <button className="ghost-back" onClick={() => setStep("campus")}>← Back</button>
            <div className="choose-head">
              <span className="choose-title">BTS {scope}</span>
              <span className="choose-sub">What would you like to do?</span>
            </div>
            <div className="door-grid">
              <button className="campus-card door" onClick={() => pickDoor("dashboard")}>
                <span className="cc-emoji">📋</span>
                <span className="cc-name">Candidate Dashboard</span>
                <span className="cc-sub">Full records, compensation &amp; hiring status</span>
              </button>
              <button className="campus-card door interview" onClick={() => pickDoor("interview")}>
                <span className="cc-emoji">🎤</span>
                <span className="cc-name">Start an Interview</span>
                <span className="cc-sub">Panel view — record your interview notes</span>
              </button>
            </div>
          </div>
        )}

        {/* ─────────── PASSWORD ─────────── */}
        {step === "auth" && scope && (
          <div className="step" key="auth">
            <button
              className="ghost-back"
              onClick={() => { setStep(scope === "admin" ? "campus" : "door"); setErr(""); }}
            >
              ← Back
            </button>
            <Logo />
            <div className="auth-scope">
              <span className="auth-scope-emoji">
                {scope === "admin" ? "🛡️" : mode === "interview" ? "🎤" : "📋"}
              </span>
              <span className="auth-scope-name">{scopeLabel}</span>
            </div>
            {scope !== "admin" && <div className="auth-door">{doorLabel}</div>}
            <input
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              value={pw}
              autoFocus
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <button className="btn-primary btn-glow" onClick={submit} disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <div className="login-err">{err}</div>
          </div>
        )}

        <div className="login-foot">
          Authorised personnel only · © {new Date().getFullYear()} Banyan Tree School
        </div>
      </div>
    </div>
  );
}
