"use client";

import { useEffect, useState } from "react";
import { checkSession, type Session } from "@/lib/client";
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
import InterviewerPanel from "@/components/InterviewerPanel";
import { ToastProvider } from "@/components/Toast";

export default function Page() {
  // undefined = still checking, null = signed out, else the active session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    checkSession().then(setSession);
  }, []);

  if (session === undefined) {
    return (
      <div className="login">
        <div className="spinner" />
      </div>
    );
  }

  // Under the BTS Console (basePath set) sign-out returns to the console hub;
  // standalone it behaves exactly as before (show this app's own login).
  const onLogout = () =>
    process.env.NEXT_PUBLIC_BASE_PATH ? (window.location.href = "/hub") : setSession(null);

  return (
    <ToastProvider>
      {session === null ? (
        <Login onSuccess={setSession} />
      ) : session.role === "interviewer" ? (
        <InterviewerPanel session={session} onLogout={onLogout} />
      ) : (
        <Dashboard session={session} onLogout={onLogout} />
      )}
    </ToastProvider>
  );
}
