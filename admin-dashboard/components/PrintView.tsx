import type { AppDetail, Employment } from "@/lib/types";
import { fmtDate, fmtDateTime, fullName, has } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/types";

/**
 * Full, print-optimised rendering of a candidate application.
 * Renders EVERY current section linearly (no tabs) so a printout / PDF
 * misses nothing. Hidden on screen; shown only in @media print.
 */

function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  const filled = typeof value === "string" || typeof value === "number" ? has(value) : !!value;
  return (
    <div className={`pv-row${full ? " full" : ""}`}>
      <span className="pv-label">{label}</span>
      <span className="pv-value">{filled ? value : "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pv-section">
      <h2 className="pv-h2">{title}</h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  if (!rows.length) return <div className="pv-none">None provided</div>;
  return (
    <table className="pv-table">
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
              <td key={j}>{has(c) ? c : "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const EMP_SECTIONS: Array<{ key: Employment["type"]; label: string }> = [
  { key: "present", label: "Present Employment" },
  { key: "previous", label: "Previous Employment" },
  { key: "prior", label: "Prior to Previous Employment" },
];

export default function PrintView({ app }: { app: AppDetail }) {
  const family = (app.family_members || []).filter((r) => has(r.name) || has(r.relationship) || has(r.occupation_place) || has(r.age));
  const education = (app.education || []).filter((r) => has(r.exam) || has(r.institution) || has(r.subjects));
  const trainings = (app.trainings || []).filter((r) => has(r.name) || has(r.institution));
  const xc = (app.extracurricular || []).filter((r) => has(r.activity) || has(r.institution));
  const relatives = (app.org_relatives || []).filter((r) => has(r.name) || has(r.relationship) || has(r.position) || has(r.campus));

  const emp: Record<string, Employment | undefined> = {};
  (app.employment || []).forEach((e) => { if (e.type) emp[e.type] = e; });
  const anyEmp = EMP_SECTIONS.some(({ key }) => emp[key as string]);

  // Interview rounds (fall back to a synthesized single round for legacy records).
  let rounds = app.interview_rounds || [];
  if (!rounds.length && (has(app.interviewed_by) || has(app.date_of_interview) || has(app.interviewer_notes))) {
    rounds = [{
      round: 1,
      interviewed_by: app.interviewed_by || "",
      interviewed_on: app.date_of_interview || "",
      interview_mode: app.interview_mode || "",
      employment_type: app.employment_type || "",
      designation_offered: app.designation_offered || "",
      date_of_joining: app.date_of_joining || "",
      notes: app.interviewer_notes || "",
    }];
  }
  const lastInterviewDate = rounds.length ? rounds[rounds.length - 1].interviewed_on : app.date_of_interview;

  const social: Array<[string, string | null | undefined]> = [
    ["LinkedIn", app.linkedin_profile],
    ["Twitter / X", app.twitter_profile],
    ["Facebook", app.facebook_profile],
  ];
  const hasSocial = social.some(([, u]) => has(u));

  const pi = app.prev_interview_details || {};
  const prevInterview = app.prev_interviewed_org
    ? `Yes${[pi.interviewer, pi.position, pi.location, has(pi.date) ? fmtDate(pi.date) : ""].filter(has).length
        ? " — " + [pi.interviewer, pi.position, pi.location, has(pi.date) ? fmtDate(pi.date) : ""].filter(has).join(", ")
        : ""}`
    : "No";
  const yn = (flag: boolean | undefined, d?: string | null) => (flag ? `Yes${has(d) ? ` — ${d}` : ""}` : "No");

  return (
    <div className="print-root" aria-hidden="true">
      {/* ---- Header ---- */}
      <header className="pv-header">
        <div>
          <div className="pv-org">{app.org || "—"}{has(app.campus) ? ` · ${app.campus}` : ""} · Employment Application</div>
          <div className="pv-name">{fullName(app)}</div>
          <div className="pv-meta">
            {has(app.position_applied_for) ? app.position_applied_for : "Position not specified"}
            {" · "}
            {app.status ? STATUS_LABELS[app.status] : "—"}
          </div>
          <div className="pv-meta">
            {has(app.email) ? app.email : "no email"}
            {has(app.mobile) ? ` · ${app.mobile}` : ""}
          </div>
          <div className="pv-meta">Submitted {fmtDate(app.created_at) || "—"} · Application #{app.id}</div>
          {has(lastInterviewDate) && (
            <div className="pv-meta pv-interview">
              Interviewed on: <strong>{fmtDate(lastInterviewDate)}</strong>
              {rounds.length > 1 ? ` (${rounds.length} rounds)` : ""}
            </div>
          )}
        </div>
        {has(app.photo_base64) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pv-photo" src={app.photo_base64 as string} alt="candidate" />
        )}
      </header>

      {/* ---- Personal ---- */}
      <Section title="Personal Information">
        <div className="pv-grid">
          <Row label="Full Name" value={fullName(app)} />
          <Row label="Date of Birth" value={fmtDate(app.date_of_birth)} />
          <Row label="Age" value={app.age ?? ""} />
          <Row label="Sex" value={app.sex} />
          <Row label="Native City & State" value={app.native_city_state} />
          <Row label="Languages Known" value={app.languages_known} />
          <Row label="Mobile" value={app.mobile} />
          <Row label="Email" value={app.email} />
          <Row label="Present Address" value={app.present_address} full />
          <Row
            label="Permanent Address"
            value={has(app.permanent_address) ? app.permanent_address : "Same as present address"}
            full
          />
        </div>
      </Section>

      {/* ---- Family ---- */}
      <Section title="Family Members">
        <Table
          headers={["Name", "Age", "Relationship", "Occupation & Place of Work"]}
          rows={family.map((r) => [r.name, r.age, r.relationship, r.occupation_place])}
        />
      </Section>

      {/* ---- Education ---- */}
      <Section title="Educational Qualifications">
        <Table
          headers={["Qualification", "Subjects", "Year", "Institution", "Division", "%/CGPA"]}
          rows={education.map((r) => [r.exam, r.subjects, r.year_passing, r.institution, r.division, r.percentage])}
        />
      </Section>

      {/* ---- Training (only if present) ---- */}
      {trainings.length > 0 && (
        <Section title="Training Courses">
          <Table
            headers={["Course", "Institution", "From", "To"]}
            rows={trainings.map((r) => [r.name, r.institution, r.from_year, r.to_year])}
          />
        </Section>
      )}

      {/* ---- Employment ---- */}
      {anyEmp && (
        <Section title="Employment History">
          {EMP_SECTIONS.map(({ key, label }) => {
            const e = emp[key as string];
            if (!e) return null;
            return (
              <div className="pv-emp" key={key as string}>
                <h3 className="pv-h3">{label}</h3>
                <div className="pv-grid">
                  <Row label="Employer Name" value={e.employer_name} />
                  <Row label="Nature of Business / Turnover" value={e.nature_business} />
                  <Row label="Employer Address" value={e.employer_address} full />
                  <Row label="Period From" value={fmtDate(e.period_from)} />
                  <Row label="Period To" value={fmtDate(e.period_to)} />
                  <Row label="Duration" value={e.duration} />
                  <Row label="Starting Position" value={e.position_start} />
                  <Row label="Last / Current Position" value={e.position_last} />
                  <Row label="Location" value={e.job_location} />
                  <Row label="Supervisor" value={e.supervisor} />
                  <Row
                    label={key === "present" ? "Current CTC (₹/PM)" : "Previous CTC (₹/PM)"}
                    value={e.ctc ?? e.salary_total ?? e.salary_basic}
                  />
                  {key !== "present" && <Row label="Reason for Leaving" value={e.reason_leaving} />}
                  <Row label="Job Description" value={e.job_description} full />
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* ---- Extracurricular ---- */}
      <Section title="Extra-Curricular Activities / Sports">
        <Table
          headers={["Activity", "Institution", "Year", "Position", "Prizes"]}
          rows={xc.map((r) => [r.activity, r.institution, r.year, r.position, r.prizes])}
        />
      </Section>

      {/* ---- Social (only if present) ---- */}
      {hasSocial && (
        <Section title="Social Media Presence">
          <div className="pv-grid">
            {social.map(([label, url]) => (
              <Row key={label} label={label} value={url} />
            ))}
          </div>
        </Section>
      )}

      {/* ---- General ---- */}
      <Section title="General Information">
        <div className="pv-grid">
          <Row label="Previously interviewed at organization" value={prevInterview} full />
          <Row label="Part-time business / consultancy" value={yn(app.part_time_business, app.part_time_business_details)} full />
          <Row label="Court proceedings" value={yn(app.court_proceedings, app.court_proceedings_details)} full />
          <Row label="Bond with present employer" value={yn(app.employer_bond, app.employer_bond_details)} full />
          <Row label="Notice Period" value={app.notice_period} />
        </div>
      </Section>

      {/* ---- Known Persons ---- */}
      <Section title="Known Persons at Organization">
        <Table
          headers={["Name", "Relationship", "Position", "Campus"]}
          rows={relatives.map((r) => [r.name, r.relationship, r.position, r.campus])}
        />
      </Section>

      {/* ---- Declaration ---- */}
      <Section title="Declaration">
        <div className="pv-decl">
          {app.declaration_agreed ? "✓ Declaration agreed" : "Declaration not agreed"}
          {has(app.declaration_date) ? ` on ${fmtDate(app.declaration_date)}` : ""}
          {has(app.declaration_place) ? ` from ${app.declaration_place}` : ""}.
        </div>
      </Section>

      {/* ---- Interviewer Notes (office use, last page) ---- */}
      <Section title="Interviewer Notes (Office Use)">
        {rounds.length ? (
          rounds.map((r, i) => (
            <div className="pv-emp" key={i}>
              <h3 className="pv-h3">Round {r.round ?? i + 1}</h3>
              <div className="pv-grid">
                <Row label="Interviewed by" value={r.interviewed_by} />
                <Row label="Interviewed on" value={fmtDate(r.interviewed_on)} />
                <Row label="Interview mode" value={r.interview_mode} />
                <Row label="Employment type" value={r.employment_type} />
                <Row label="Designation offered" value={r.designation_offered} />
                <Row label="Date of joining" value={fmtDate(r.date_of_joining)} />
                <Row label="Notes" value={r.notes} full />
              </div>
            </div>
          ))
        ) : (
          <div className="pv-none">No interview recorded yet.</div>
        )}
        <h3 className="pv-h3">Salary</h3>
        <div className="pv-grid">
          <Row label="Current CTC (₹)" value={app.current_salary} />
          <Row label="Expected CTC (₹)" value={app.expected_salary} />
          <Row label="Salary notes" value={app.salary_notes} full />
          {has(app.salary_updated_at) && <Row label="Last updated" value={fmtDateTime(app.salary_updated_at)} full />}
        </div>
      </Section>

      <footer className="pv-footer">
        Generated from BTS/IILM HR Admin
      </footer>
    </div>
  );
}
