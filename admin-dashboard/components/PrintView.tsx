import type { AppDetail, Employment } from "@/lib/types";
import { fmtDate, fmtDateTime, fullName, has } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/types";

/**
 * Full, print-optimised rendering of a candidate application.
 * Renders EVERY section linearly (no tabs) so a printout / PDF misses nothing.
 * Hidden on screen; shown only in @media print (see globals.css .print-root).
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
  const memberships = (app.memberships || []).filter((r) => has(r.name) || has(r.type));
  const trainings = (app.trainings || []).filter((r) => has(r.name) || has(r.institution));
  const xc = (app.extracurricular || []).filter((r) => has(r.activity) || has(r.institution));
  const relatives = (app.org_relatives || []).filter((r) => has(r.name) || has(r.relationship) || has(r.position) || has(r.campus));
  const refs = (app.references_list || []).filter((r) => has(r.name) || has(r.designation_org) || has(r.address_contact));

  const emp: Record<string, Employment | undefined> = {};
  (app.employment || []).forEach((e) => { if (e.type) emp[e.type] = e; });
  const anyEmp = EMP_SECTIONS.some(({ key }) => emp[key as string]);

  const chronic: string[] = [];
  if (app.chronic_diabetes) chronic.push("Diabetes");
  if (app.chronic_high_bp) chronic.push("High Blood Pressure");
  if (app.chronic_heart_disease) chronic.push("Heart Disease");
  if (app.chronic_asthma) chronic.push("Asthma");
  if (has(app.chronic_other)) chronic.push(app.chronic_other as string);

  const hasHealth =
    has(app.height) || has(app.weight) || has(app.power_of_glasses) || has(app.physical_disability) ||
    has(app.illness_from) || has(app.illness_to) || has(app.illness_nature) || chronic.length > 0;

  const social: Array<[string, string | null | undefined]> = [
    ["LinkedIn", app.linkedin_profile],
    ["Twitter / X", app.twitter_profile],
    ["Facebook", app.facebook_profile],
  ];
  const hasSocial = social.some(([, u]) => has(u));

  const careerQs: Array<[string, string | null | undefined]> = [
    ["Noteworthy Contributions", app.noteworthy_contributions],
    ["5-Year Career Plan", app.career_plan_5yr],
    ["Important People — Personal Development", app.important_personal_dev],
    ["Important People — Professional Development", app.important_professional_dev],
    ["Role Model", app.role_model],
  ];
  const hasCareer = careerQs.some(([, a]) => has(a));

  const fp = (app.functional_pref || []).filter(has);
  const lp = (app.locational_pref || []).filter(has);
  const hasPrefs = fp.length > 0 || lp.length > 0;

  const pi = app.prev_interview_details || {};
  const prevInterview = app.prev_interviewed_org
    ? `Yes${[pi.interviewer, pi.position, pi.location, has(pi.date) ? fmtDate(pi.date) : ""].filter(has).length
        ? " — " + [pi.interviewer, pi.position, pi.location, has(pi.date) ? fmtDate(pi.date) : ""].filter(has).join(", ")
        : ""}`
    : "No";
  const yn = (flag: boolean | undefined, d?: string | null) => (flag ? `Yes${has(d) ? ` — ${d}` : ""}` : "No");

  const hasSalary = has(app.current_salary) || has(app.expected_salary) || has(app.ctc_offered) || has(app.salary_notes);

  return (
    <div className="print-root" aria-hidden="true">
      {/* ---- Header ---- */}
      <header className="pv-header">
        <div>
          <div className="pv-org">{app.org || "—"} · Employment Application</div>
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
          <Row label="Religion" value={app.religion} />
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

      {/* ---- Memberships / Training (only if present) ---- */}
      {memberships.length > 0 && (
        <Section title="Professional Memberships">
          <Table
            headers={["Institution", "Type", "From", "To"]}
            rows={memberships.map((r) => [r.name, r.type, r.from_year, r.to_year])}
          />
        </Section>
      )}
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

      {/* ---- Physical & Health (only if present) ---- */}
      {hasHealth && (
        <Section title="Physical & Health">
          <div className="pv-grid">
            <Row label="Height" value={app.height} />
            <Row label="Weight" value={app.weight} />
            <Row label="Power of Glasses" value={app.power_of_glasses} />
            <Row label="Physical Disability" value={app.physical_disability} />
            <Row
              label="Recent Illness"
              value={
                has(app.illness_from) || has(app.illness_to) || has(app.illness_nature)
                  ? `${fmtDate(app.illness_from) || "—"} → ${fmtDate(app.illness_to) || "—"}${
                      has(app.illness_days) ? ` (${app.illness_days} days)` : ""
                    }${has(app.illness_nature) ? ` · ${app.illness_nature}` : ""}`
                  : ""
              }
              full
            />
            <Row label="Chronic Conditions" value={chronic.length ? chronic.join(", ") : ""} full />
          </div>
        </Section>
      )}

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

      {/* ---- Career (only if present) ---- */}
      {hasCareer && (
        <Section title="Career Questions">
          {careerQs.map(([q, a]) =>
            has(a) ? (
              <div className="pv-qa" key={q}>
                <div className="pv-q">{q}</div>
                <div className="pv-a">{a}</div>
              </div>
            ) : null
          )}
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
          <Row label="Earliest Joining" value={fmtDate(app.earliest_joining)} />
        </div>
      </Section>

      {/* ---- Known Persons (org_relatives) — the previously-missing section ---- */}
      <Section title="Known Persons at Organization">
        <Table
          headers={["Name", "Relationship", "Position", "Campus"]}
          rows={relatives.map((r) => [r.name, r.relationship, r.position, r.campus])}
        />
      </Section>

      {/* ---- Preferences (only if present) ---- */}
      {hasPrefs && (
        <Section title="Preferences">
          <div className="pv-grid">
            <Row label="Functional Preferences" value={fp.length ? fp.join(", ") : ""} full />
            <Row label="Location Preferences" value={lp.length ? lp.join(", ") : ""} full />
          </div>
        </Section>
      )}

      {/* ---- References ---- */}
      <Section title="References">
        {refs.length ? (
          refs.map((r, i) => (
            <div className="pv-grid pv-ref" key={i}>
              <Row label="Name" value={r.name} />
              <Row label="Designation & Organisation" value={r.designation_org} />
              <Row label="Address & Contact" value={r.address_contact} full />
              <Row label="When to refer" value={r.when_refer} />
            </div>
          ))
        ) : (
          <div className="pv-none">None provided</div>
        )}
      </Section>

      {/* ---- Compensation (admin, filled during interview) ---- */}
      <Section title="Compensation (Office Use — Filled During Interview)">
        <div className="pv-grid">
          <Row label="Current Salary (₹)" value={app.current_salary} />
          <Row label="Expected Salary (₹)" value={app.expected_salary} />
          <Row label="CTC Offered (₹)" value={app.ctc_offered} />
          <Row label="Notes" value={app.salary_notes} full />
          {has(app.salary_updated_at) && <Row label="Last Updated" value={fmtDateTime(app.salary_updated_at)} full />}
        </div>
        {!hasSalary && <div className="pv-none">To be filled during interview.</div>}
      </Section>

      {/* ---- Declaration ---- */}
      <Section title="Declaration">
        <div className="pv-decl">
          {app.declaration_agreed ? "✓ Declaration agreed" : "Declaration not agreed"}
          {has(app.declaration_date) ? ` on ${fmtDate(app.declaration_date)}` : ""}
          {has(app.declaration_place) ? ` from ${app.declaration_place}` : ""}.
        </div>
      </Section>

      <footer className="pv-footer">
        Generated from BTS/IILM HR Admin · {fmtDateTime(new Date().toISOString())}
      </footer>
    </div>
  );
}
