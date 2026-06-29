"use client";

import { has } from "@/lib/format";

/** Label / value pair used throughout the detail view. */
export function KV({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  const filled = typeof value === "string" || typeof value === "number" ? has(value) : !!value;
  return (
    <div className={`kv${full ? " full" : ""}`}>
      <div className="kv-label">{label}</div>
      <div className={`kv-val${filled ? "" : " muted"}`}>{filled ? value : "—"}</div>
    </div>
  );
}

/** A single cell value with a muted dash fallback. */
export function Cell({ value }: { value?: string | number | null }) {
  return has(value) ? <>{value}</> : <span className="dash">—</span>;
}

interface TableProps {
  headers: string[];
  rows: Array<React.ReactNode[]>;
  emptyLabel?: string;
}

/** Read-only data table with a "None provided" empty state. */
export function DataTable({ headers, rows, emptyLabel = "None provided" }: TableProps) {
  if (!rows.length) {
    return (
      <div className="card-box">
        <div className="none-row">{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div className="card-box" style={{ padding: 0, overflowX: "auto" }}>
      <table className="data">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
