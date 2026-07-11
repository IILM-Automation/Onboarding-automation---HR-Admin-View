"use client";

import { useState } from "react";
import type { AppDetail, InterviewRound } from "@/lib/types";
import { fmtDateTime, has } from "@/lib/format";
import { updateSalary } from "@/lib/client";
import { useToast } from "../Toast";

/**
 * Interviewer Notes — supports multiple interview rounds that accumulate.
 * Each round (conducted possibly by different people) is saved and preserved
 * independently. Salary is a single per-candidate block below the rounds.
 */

const BLANK: InterviewRound = {
  interviewed_by: "",
  interviewed_on: "",
  interview_mode: "",
  employment_type: "",
  designation_offered: "",
  date_of_joining: "",
  notes: "",
};

function roundHasData(r: InterviewRound): boolean {
  return [
    r.interviewed_by, r.interviewed_on, r.interview_mode, r.employment_type,
    r.designation_offered, r.date_of_joining, r.notes,
  ].some((v) => has(v));
}

export default function NotesTab({
  app,
  onSaved,
}: {
  app: AppDetail;
  onSaved: (d: AppDetail) => void;
}) {
  const toast = useToast();

  const initial = (app.interview_rounds && app.interview_rounds.length
    ? app.interview_rounds
    : [{ ...BLANK, round: 1 }]
  ).map((r) => ({ ...BLANK, ...r, interviewed_on: (r.interviewed_on || "").slice(0, 10), date_of_joining: (r.date_of_joining || "").slice(0, 10) }));

  const [rounds, setRounds] = useState<InterviewRound[]>(initial);
  const [cur, setCur] = useState(app.current_salary || "");
  const [exp, setExp] = useState(app.expected_salary || "");
  const [snotes, setSnotes] = useState(app.salary_notes || "");
  const [savedAt, setSavedAt] = useState(app.salary_updated_at || "");
  const [saving, setSaving] = useState(false);

  function patch(i: number, key: keyof InterviewRound, value: string) {
    setRounds((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }
  function addRound() {
    setRounds((prev) => [...prev, { ...BLANK, round: prev.length + 1 }]);
  }
  function removeRound(i: number) {
    setRounds((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    // Keep only rounds with data; each such round needs interviewer + date.
    const filled = rounds.filter(roundHasData);
    for (const r of filled) {
      if (!has(r.interviewed_by) || !has(r.interviewed_on)) {
        toast("Each round needs “Interviewed by” and “Interviewed on”.", "error");
        return;
      }
    }
    const numbered = filled.map((r, i) => ({ ...r, round: i + 1 }));

    setSaving(true);
    const payload = {
      current_salary: cur.trim(),
      expected_salary: exp.trim(),
      ctc_offered: "",
      salary_notes: snotes.trim(),
      interview_rounds: numbered,
    };
    try {
      const res = await updateSalary(app.id, payload);
      const ts = res.salary_updated_at || savedAt;
      setSavedAt(ts);
      onSaved({ ...app, ...payload, salary_updated_at: ts });
      // reflect renumbering / dropped-empty rounds locally
      setRounds(numbered.length ? numbered : [{ ...BLANK, round: 1 }]);
      toast("Interviewer notes saved", "success");
    } catch (e) {
      toast((e as Error).message || "Failed to save notes", "error");
    } finally {
      setSaving(false);
    }
  }

  const Tick = ({
    options,
    value,
    onChange,
  }: {
    options: string[];
    value: string | undefined;
    onChange: (v: string) => void;
  }) => (
    <div className="tick-group">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`tick${value === o ? " on" : ""}`}
          onClick={() => onChange(value === o ? "" : o)}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* ---- Interview rounds ---- */}
      {rounds.map((r, i) => (
        <div className="section" key={i}>
          <div className="salary-card">
            <div className="round-head">
              <div className="section-title">Round {i + 1}</div>
              <button className="round-remove" onClick={() => removeRound(i)} title="Remove this round">
                ✕
              </button>
            </div>
            <div className="salary-grid">
              <div className="salary-field">
                <label>Interviewed by <span className="req">*</span></label>
                <input type="text" value={r.interviewed_by || ""} onChange={(e) => patch(i, "interviewed_by", e.target.value)} placeholder="Interviewer name" />
              </div>
              <div className="salary-field">
                <label>Interviewed on <span className="req">*</span></label>
                <input type="date" value={r.interviewed_on || ""} onChange={(e) => patch(i, "interviewed_on", e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Interview mode</label>
                <Tick options={["Physical", "Online"]} value={r.interview_mode} onChange={(v) => patch(i, "interview_mode", v)} />
              </div>
              <div className="salary-field">
                <label>Employment type</label>
                <Tick options={["Full Time", "Part Time"]} value={r.employment_type} onChange={(v) => patch(i, "employment_type", v)} />
              </div>
              <div className="salary-field">
                <label>Designation offered</label>
                <input type="text" value={r.designation_offered || ""} onChange={(e) => patch(i, "designation_offered", e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Date of joining</label>
                <input type="date" value={r.date_of_joining || ""} onChange={(e) => patch(i, "date_of_joining", e.target.value)} />
              </div>
              <div className="salary-field full">
                <label>Notes</label>
                <textarea rows={5} value={r.notes || ""} onChange={(e) => patch(i, "notes", e.target.value)} placeholder="Observations, assessment, recommendation…" />
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="section">
        <button className="btn-add-round" onClick={addRound}>+ Add interview round</button>
      </div>

      {/* ---- Salary portion ---- */}
      <div className="section">
        <div className="salary-card">
          <div className="section-title">Salary</div>
          <div className="salary-grid">
            <div className="salary-field">
              <label>Current CTC (₹)</label>
              <input type="text" value={cur} onChange={(e) => setCur(e.target.value)} />
            </div>
            <div className="salary-field">
              <label>Expected CTC (₹)</label>
              <input type="text" value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
            <div className="salary-field full">
              <label>Salary notes</label>
              <textarea rows={3} value={snotes} onChange={(e) => setSnotes(e.target.value)} />
            </div>
          </div>
          <div className="salary-foot">
            <button className="btn-accent" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Interviewer Notes"}
            </button>
            {has(savedAt) && <span className="saved-ts">Last saved {fmtDateTime(savedAt)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
