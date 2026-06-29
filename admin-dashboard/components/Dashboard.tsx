"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApplications, logout } from "@/lib/client";
import type { AppListItem, Status } from "@/lib/types";
import { useToast } from "./Toast";
import AppList from "./AppList";
import AppDetail from "./AppDetail";

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false); // mobile slide-in

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (s: string, st: string) => {
      setLoading(true);
      try {
        const data = await fetchApplications({ search: s, status: st });
        setApps(data);
      } catch (e) {
        toast((e as Error).message || "Failed to load applications", "error");
        setApps([]);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // initial load + reload when status changes
  useEffect(() => {
    load(search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // debounced search
  function onSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v, status), 300);
  }

  function selectApp(id: number) {
    setSelectedId(id);
    setShowDetail(true);
  }

  // keep the list card status in sync when changed from the detail panel
  function patchLocalStatus(id: number, newStatus: Status) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
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
        selectedId={selectedId}
        onSearch={onSearchChange}
        onStatus={setStatus}
        onSelect={selectApp}
        onLogout={doLogout}
      />
      <AppDetail
        id={selectedId}
        onBack={() => setShowDetail(false)}
        onStatusChange={patchLocalStatus}
      />
    </div>
  );
}
