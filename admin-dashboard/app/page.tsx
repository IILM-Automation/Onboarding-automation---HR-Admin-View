"use client";

import { useEffect, useState } from "react";
import { checkSession, type Role } from "@/lib/client";
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
import HRView from "@/components/HRView";
import { ToastProvider } from "@/components/Toast";

export default function Page() {
  // undefined = still checking, null = signed out, else the active role
  const [role, setRole] = useState<Role | null | undefined>(undefined);

  useEffect(() => {
    checkSession().then(setRole);
  }, []);

  if (role === undefined) {
    return (
      <div className="login">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <ToastProvider>
      {role === null ? (
        <Login onSuccess={setRole} />
      ) : role === "admin" ? (
        <Dashboard onLogout={() => setRole(null)} />
      ) : (
        <HRView onLogout={() => setRole(null)} />
      )}
    </ToastProvider>
  );
}
