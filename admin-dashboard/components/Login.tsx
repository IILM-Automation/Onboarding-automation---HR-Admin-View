"use client";

import { useState } from "react";
import { login, checkSession, type Session } from "@/lib/client";

type Scope = "admin" | "Delhi" | "Jaipur" | "Chandigarh";
type Step = "landing" | "choose" | "auth";

const CAMPUSES: { scope: Scope; name: string; sub: string; emoji: string }[] = [
  { scope: "Delhi", name: "Delhi", sub: "Campus login", emoji: "🏫" },
  { scope: "Jaipur", name: "Jaipur", sub: "Campus login", emoji: "🏫" },
  { scope: "Chandigarh", name: "Chandigarh", sub: "Campus login", emoji: "🏫" },
  { scope: "admin", name: "Super Admin", sub: "All campuses", emoji: "🛡️" },
];

export default function Login({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [step, setStep] = useState<Step>("landing");
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

  function pick(s: Scope) {
    setScope(s);
    setPw("");
    setErr("");
    setStep("auth");
  }

  const label = (s: Scope) => (s === "admin" ? "Super Admin" : `BTS ${s}`);

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

      <div className={`login-card wide${shake ? " shake" : ""}`}
        onAnimationEnd={(e) => { if (e.animationName === "shake") setShake(false); }}>

        {/* ─────────── STEP 1 — LANDING ─────────── */}
        {step === "landing" && (
          <div className="step step-landing" key="landing">
            <Logo />
            <div className="landing-quote">“In Pursuit of Excellence”</div>
            <h1 className="landing-title">Employment Application System</h1>
            <p className="landing-sub">
              Recruitment &amp; onboarding portal for Banyan Tree School campuses.
            </p>
            <button className="btn-primary btn-glow" onClick={() => setStep("choose")}>
              Enter Portal →
            </button>
          </div>
        )}

        {/* ─────────── STEP 2 — CAMPUS CARDS ─────────── */}
        {step === "choose" && (
          <div className="step step-choose" key="choose">
            <button className="ghost-back" onClick={() => setStep("landing")}>← Back</button>
            <div className="choose-head">
              <span className="choose-title">Select your access</span>
              <span className="choose-sub">Choose a campus, or Super Admin for all campuses</span>
            </div>
            <div className="campus-grid">
              {CAMPUSES.map((c) => (
                <button
                  key={c.scope}
                  className={`campus-card${c.scope === "admin" ? " admin" : ""}`}
                  onClick={() => pick(c.scope)}
                >
                  <span className="cc-emoji">{c.emoji}</span>
                  <span className="cc-name">{c.name}</span>
                  <span className="cc-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─────────── STEP 3 — PASSWORD ─────────── */}
        {step === "auth" && scope && (
          <div className="step step-auth" key="auth">
            <button className="ghost-back" onClick={() => { setStep("choose"); setErr(""); }}>← Back</button>
            <Logo />
            <div className="auth-scope">
              <span className="auth-scope-emoji">{scope === "admin" ? "🛡️" : "🏫"}</span>
              <span className="auth-scope-name">{label(scope)}</span>
            </div>
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

        <div className="login-foot">Authorised personnel only · © {new Date().getFullYear()} Banyan Tree School</div>
      </div>
    </div>
  );
}
