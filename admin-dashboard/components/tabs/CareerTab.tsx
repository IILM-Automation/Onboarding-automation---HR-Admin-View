"use client";

import type { AppDetail } from "@/lib/types";
import { fmtDate, has } from "@/lib/format";
import { KV } from "../ui";

export default function CareerTab({ app }: { app: AppDetail }) {
  const questions: Array<[string, string | null | undefined]> = [
    ["Noteworthy Contributions", app.noteworthy_contributions],
    ["5-Year Career Plan", app.career_plan_5yr],
    ["Important Personal Development", app.important_personal_dev],
    ["Important Professional Development", app.important_professional_dev],
    ["Role Model", app.role_model],
  ];

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

  const fp = app.functional_pref || [];
  const lp = app.locational_pref || [];

  const refs = (app.references_list || []).filter(
    (r) => has(r.name) || has(r.designation_org) || has(r.address_contact)
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">Career Questions</div>
        {questions.map(([q, ans]) => (
          <div className="qa-card" key={q}>
            <div className="qa-q">{q}</div>
            <div className={`qa-a${has(ans) ? "" : " muted"}`}>{has(ans) ? ans : "Not provided"}</div>
          </div>
        ))}
      </div>

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
            <KV label="Earliest joining" value={fmtDate(app.earliest_joining)} />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Preferences</div>
        <div className="two-col">
          <PrefBox title="Functional Preferences" list={fp} />
          <PrefBox title="Location Preferences" list={lp} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">References</div>
        {refs.length ? (
          refs.map((r, i) => (
            <div className="ref-card" key={i}>
              <div className="kv-grid">
                <KV label="Name" value={r.name} />
                <KV label="Designation & Organisation" value={r.designation_org} />
                <KV label="Address & Contact" value={r.address_contact} full />
                <KV label="When to refer" value={r.when_refer} />
              </div>
            </div>
          ))
        ) : (
          <div className="card-box">
            <div className="none-row">None provided</div>
          </div>
        )}
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

function PrefBox({ title, list }: { title: string; list: string[] }) {
  return (
    <div>
      <div className="kv-label" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div className="card-box">
        <div className="kv-grid" style={{ gridTemplateColumns: "1fr" }}>
          {[1, 2, 3].map((n) => (
            <KV key={n} label={`Preference ${n}`} value={list[n - 1]} />
          ))}
        </div>
      </div>
    </div>
  );
}
