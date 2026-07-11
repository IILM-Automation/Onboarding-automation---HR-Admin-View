"use client";

import type { AppDetail } from "@/lib/types";
import { fmtDate, has } from "@/lib/format";
import { Cell, DataTable, KV } from "../ui";

export default function CareerTab({ app }: { app: AppDetail }) {
  const pi = app.prev_interview_details || {};
  const prevInterview = app.prev_interviewed_org
    ? `Yes${
        [pi.interviewer, pi.position, pi.location, pi.date].some(has)
          ? " — " +
            [pi.interviewer, pi.position, pi.location, has(pi.date) ? fmtDate(pi.date) : ""]
              .filter(has)
              .join(", ")
          : ""
      }`
    : "No";

  const ynDetail = (flag: boolean | undefined, details?: string | null) =>
    flag ? `Yes${has(details) ? ` — ${details}` : ""}` : "No";

  const relatives = (app.org_relatives || []).filter(
    (r) => has(r.name) || has(r.relationship) || has(r.position) || has(r.campus)
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">General Information</div>
        <div className="card-box">
          <div className="kv-grid">
            <KV label="Previously interviewed at org" value={prevInterview} full />
            <KV
              label="Part-time business"
              value={ynDetail(app.part_time_business, app.part_time_business_details)}
              full
            />
            <KV
              label="Court proceedings"
              value={ynDetail(app.court_proceedings, app.court_proceedings_details)}
              full
            />
            <KV label="Employer bond" value={ynDetail(app.employer_bond, app.employer_bond_details)} full />
            <KV label="Notice period" value={app.notice_period} />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Known Persons at Organization</div>
        <DataTable
          headers={["Name", "Relationship", "Position", "Campus"]}
          rows={relatives.map((r) => [
            <Cell key="1" value={r.name} />,
            <Cell key="2" value={r.relationship} />,
            <Cell key="3" value={r.position} />,
            <Cell key="4" value={r.campus} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Declaration</div>
        {app.declaration_agreed ? (
          <div className="decl-line">
            ✓ Declaration agreed
            {has(app.declaration_date) ? ` on ${fmtDate(app.declaration_date)}` : ""}
            {has(app.declaration_place) ? ` from ${app.declaration_place}` : ""}.
          </div>
        ) : (
          <div className="decl-line no">Declaration not agreed.</div>
        )}
      </div>
    </div>
  );
}
