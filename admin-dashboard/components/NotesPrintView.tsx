import type { AppDetail } from "@/lib/types";
import { fmtDate, fmtDateTime, fullName, has } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/types";

/**
 * Print-optimised "Interview Notes" sheet — all rounds + salary for one
 * candidate. Hidden on screen; shown only under @media print when the
 * download is triggered with data-print="notes". Reuses the .pv-* classes.
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

export default function NotesPrintView({ app }: { app: AppDetail }) {
  // Rounds, with a fallback to the legacy single-round columns.
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

  const hasSalary = has(app.current_salary) || has(app.expected_salary) || has(app.salary_notes);

  return (
    <div className="notes-print-root" aria-hidden="true">
      <header className="pv-header">
        <div>
          <div className="pv-org">
            {app.org || "—"}{has(app.campus) ? ` · ${app.campus}` : ""} · Interview Notes
          </div>
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
          <div className="pv-meta">Application #{app.id}</div>
        </div>
        {has(app.photo_base64) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pv-photo" src={app.photo_base64 as string} alt="candidate" />
        )}
      </header>

      <section className="pv-section">
        <h2 className="pv-h2">Interview Rounds</h2>
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
          <div className="pv-none">No interview rounds recorded.</div>
        )}
      </section>

      <section className="pv-section">
        <h2 className="pv-h2">Salary</h2>
        <div className="pv-grid">
          <Row label="Current CTC (₹)" value={app.current_salary} />
          <Row label="Expected CTC (₹)" value={app.expected_salary} />
          <Row label="Salary notes" value={app.salary_notes} full />
          {has(app.salary_updated_at) && <Row label="Last updated" value={fmtDateTime(app.salary_updated_at)} full />}
        </div>
        {!hasSalary && <div className="pv-none">No salary details recorded.</div>}
      </section>

      <footer className="pv-footer">Interview Notes · Generated from BTS/IILM HR Admin</footer>
    </div>
  );
}
