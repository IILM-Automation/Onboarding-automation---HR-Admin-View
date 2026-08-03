"use client";

import { useEffect, useState } from "react";
import { checkSession, type Session } from "@/lib/client";
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
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

  return (
    <ToastProvider>
      {session === null ? (
        <Login onSuccess={setSession} />
      ) : (
        <Dashboard session={session} onLogout={() => setSession(null)} />
      )}
    </ToastProvider>
  );
}
