"use client";

import { useState } from "react";
import type { AppDetail, Employment } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Cell, DataTable, KV } from "../ui";

const SECTIONS: Array<{ key: Employment["type"]; label: string }> = [
  { key: "present", label: "Present Employment" },
  { key: "previous", label: "Previous Employment" },
  { key: "prior", label: "Prior to Previous" },
];

export default function WorkTab({ app }: { app: AppDetail }) {
  const emp = app.employment || [];
  const byType: Record<string, Employment | undefined> = {};
  emp.forEach((e) => {
    if (e.type) byType[e.type] = e;
  });

  const [open, setOpen] = useState<string>("present");
  const xc = app.extracurricular || [];

  return (
    <div>
      <div className="section">
        <div className="section-title">Employment</div>
        {SECTIONS.map(({ key, label }) => {
          const e = byType[key as string];
          const isOpen = open === key;
          return (
            <div className={`accordion${isOpen ? " open" : ""}`} key={key}>
              <button className="acc-head" onClick={() => setOpen(isOpen ? "" : (key as string))}>
                {label}
                <span className="chev">▶</span>
              </button>
              {isOpen && (
                <div className="acc-body">
                  {e ? <EmpGrid e={e} showReason={key !== "present"} /> : <div className="acc-empty">Not provided</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section">
        <div className="section-title">Extra Curricular Activities</div>
        <DataTable
          headers={["Activity", "Institution", "Year", "Position", "Prizes"]}
          rows={xc.map((r) => [
            <Cell key="1" value={r.activity} />,
            <Cell key="2" value={r.institution} />,
            <Cell key="3" value={r.year} />,
            <Cell key="4" value={r.position} />,
            <Cell key="5" value={r.prizes} />,
          ])}
        />
      </div>
    </div>
  );
}

function EmpGrid({ e, showReason }: { e: Employment; showReason: boolean }) {
  return (
    <div className="kv-grid">
      <KV label="Employer Name" value={e.employer_name} />
      <KV label="Nature of Business / Turnover" value={e.nature_business} />
      <KV label="Employer Address" value={e.employer_address} full />
      <KV label="Period From" value={fmtDate(e.period_from)} />
      <KV label="Period To" value={fmtDate(e.period_to)} />
      <KV label="Duration" value={e.duration} />
      <KV label="Starting Position" value={e.position_start} />
      <KV label="Last / Current Position" value={e.position_last} />
      <KV label="Location" value={e.job_location} />
      <KV label="Supervisor" value={e.supervisor} />
      <KV label="Basic (₹/PM)" value={e.salary_basic} />
      <KV label="Allowances (₹/PM)" value={e.salary_allowances} />
      <KV label="Total (₹/PM)" value={e.salary_total} />
      {showReason && <KV label="Reason for Leaving" value={e.reason_leaving} />}
      <KV label="Job Description" value={e.job_description} full />
    </div>
  );
}
