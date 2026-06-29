"use client";

import { useState } from "react";
import type { AppDetail } from "@/lib/types";
import { fmtDate, fmtDateTime, fullName, has } from "@/lib/format";
import { updateSalary } from "@/lib/client";
import { useToast } from "../Toast";
import { Cell, DataTable, KV } from "../ui";

export default function OverviewTab({
  app,
  onSaved,
}: {
  app: AppDetail;
  onSaved: (d: AppDetail) => void;
}) {
  const toast = useToast();
  const family = app.family_members || [];
  const education = app.education || [];
  const memberships = app.memberships || [];
  const trainings = app.trainings || [];

  const chronic: string[] = [];
  if (app.chronic_diabetes) chronic.push("Diabetes");
  if (app.chronic_high_bp) chronic.push("High Blood Pressure");
  if (app.chronic_heart_disease) chronic.push("Heart Disease");
  if (app.chronic_asthma) chronic.push("Asthma");
  if (has(app.chronic_other)) chronic.push(app.chronic_other as string);

  const illness =
    has(app.illness_from) || has(app.illness_to) || has(app.illness_nature)
      ? `${fmtDate(app.illness_from) || "—"} → ${fmtDate(app.illness_to) || "—"}${
          has(app.illness_days) ? ` (${app.illness_days} days)` : ""
        }${has(app.illness_nature) ? ` · ${app.illness_nature}` : ""}`
      : "";

  const social: Array<[string, string | null | undefined]> = [
    ["LinkedIn", app.linkedin_profile],
    ["Twitter", app.twitter_profile],
    ["Facebook", app.facebook_profile],
  ];

  // salary form
  const [cur, setCur] = useState(app.current_salary || "");
  const [exp, setExp] = useState(app.expected_salary || "");
  const [ctc, setCtc] = useState(app.ctc_offered || "");
  const [notes, setNotes] = useState(app.salary_notes || "");
  const [savedAt, setSavedAt] = useState(app.salary_updated_at || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      current_salary: cur.trim(),
      expected_salary: exp.trim(),
      ctc_offered: ctc.trim(),
      salary_notes: notes.trim(),
    };
    try {
      const res = await updateSalary(app.id, payload);
      const ts = res.salary_updated_at || savedAt;
      setSavedAt(ts);
      onSaved({ ...app, ...payload, salary_updated_at: ts });
      toast("Compensation saved", "success");
    } catch (e) {
      toast((e as Error).message || "Failed to save compensation", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Personal</div>
        <div className="card-box">
          <div className="kv-grid">
            <KV label="Full Name" value={fullName(app)} />
            <KV label="Date of Birth" value={fmtDate(app.date_of_birth)} />
            <KV label="Age" value={app.age ?? ""} />
            <KV label="Sex" value={app.sex} />
            <KV label="Religion" value={app.religion} />
            <KV label="Native City & State" value={app.native_city_state} />
            <KV label="Languages Known" value={app.languages_known} />
            <KV label="Mobile" value={app.mobile} />
            <KV label="Email" value={app.email} />
            <KV label="Present Address" value={app.present_address} full />
            <div className="kv full">
              <div className="kv-label">Permanent Address</div>
              <div className={`kv-val${has(app.permanent_address) ? "" : " muted"}`}>
                {has(app.permanent_address) ? app.permanent_address : "Same as present address"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Family Members</div>
        <DataTable
          headers={["Name", "Age", "Relationship", "Occupation & Place of Work"]}
          rows={family.map((r) => [
            <Cell key="n" value={r.name} />,
            <Cell key="a" value={r.age} />,
            <Cell key="r" value={r.relationship} />,
            <Cell key="o" value={r.occupation_place} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Education</div>
        <DataTable
          headers={["Qualification", "Subjects", "Year", "Institution", "Division", "%/CGPA"]}
          rows={education.map((r) => [
            <Cell key="1" value={r.exam} />,
            <Cell key="2" value={r.subjects} />,
            <Cell key="3" value={r.year_passing} />,
            <Cell key="4" value={r.institution} />,
            <Cell key="5" value={r.division} />,
            <Cell key="6" value={r.percentage} />,
          ])}
        />
      </div>

      <div className="section">
        <div className="section-title">Professional</div>
        <div className="two-col">
          <div>
            <div className="kv-label" style={{ marginBottom: 8 }}>
              Memberships
            </div>
            <DataTable
              headers={["Institution", "Type", "From", "To"]}
              rows={memberships.map((r) => [
                <Cell key="1" value={r.name} />,
                <Cell key="2" value={r.type} />,
                <Cell key="3" value={r.from_year} />,
                <Cell key="4" value={r.to_year} />,
              ])}
            />
          </div>
          <div>
            <div className="kv-label" style={{ marginBottom: 8 }}>
              Training
            </div>
            <DataTable
              headers={["Course", "Institution", "From", "To"]}
              rows={trainings.map((r) => [
                <Cell key="1" value={r.name} />,
                <Cell key="2" value={r.institution} />,
                <Cell key="3" value={r.from_year} />,
                <Cell key="4" value={r.to_year} />,
              ])}
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Physical &amp; Health</div>
        <div className="card-box">
          <div className="kv-grid">
            <KV label="Height" value={app.height} />
            <KV label="Weight" value={app.weight} />
            <KV label="Power of Glasses" value={app.power_of_glasses} />
            <KV label="Physical Disability" value={app.physical_disability} />
            <KV label="Recent Illness" value={illness} full />
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="kv-label" style={{ marginBottom: 8 }}>
              Chronic Conditions
            </div>
            {chronic.length ? (
              <div className="pills">
                {chronic.map((c, i) => (
                  <span className="pill" key={i}>
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <div className="kv-val muted">None reported</div>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Social Media</div>
        <div className="card-box">
          <div className="kv-grid">
            {social.map(([label, url]) => (
              <div className="kv" key={label}>
                <div className="kv-label">{label}</div>
                <div className={`kv-val${has(url) ? "" : " muted"}`}>
                  {has(url) ? (
                    <a href={url as string} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="salary-card">
          <div className="section-title">Compensation — Filled During Interview</div>
          <div className="salary-grid">
            <div className="salary-field">
              <label>Current Salary (₹)</label>
              <input type="text" value={cur} onChange={(e) => setCur(e.target.value)} />
            </div>
            <div className="salary-field">
              <label>Expected Salary (₹)</label>
              <input type="text" value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
            <div className="salary-field">
              <label>CTC Offered (₹)</label>
              <input type="text" value={ctc} onChange={(e) => setCtc(e.target.value)} />
            </div>
            <div className="salary-field full">
              <label>Notes</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="salary-foot">
            <button className="btn-accent" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Compensation"}
            </button>
            {has(savedAt) && <span className="saved-ts">Last saved {fmtDateTime(savedAt)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
