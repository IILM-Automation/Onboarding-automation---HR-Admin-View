"use client";

import { useCallback, useState } from "react";
import type { AppDetail, InterviewNote } from "@/lib/types";
import { fmtDate, fmtDateTime, has } from "@/lib/format";
import { updateSalary, fetchNotes, saveNote, deleteNote } from "@/lib/client";
import { useToast } from "../Toast";

/**
 * HR view of interviewer notes.
 *
 * Notes are now READ-ONLY here — each panelist records their own note in the
 * standalone Interview Panel, so nobody can overwrite anyone else's words.
 * HR keeps two powers: the confidential salary block, and adding a note on
 * behalf of someone who could not use the panel.
 */
export default function NotesTab({
  app,
  notes,
  notesLoading,
  onSaved,
  onNotesChange,
}: {
  app: AppDetail;
  /** Fetched once by AppDetail and shared with the PDF views. */
  notes: InterviewNote[];
  notesLoading?: boolean;
  onSaved: (d: AppDetail) => void;
  /** Pushes a refreshed list back up so the PDFs stay in sync. */
  onNotesChange?: (n: InterviewNote[]) => void;
}) {
  const toast = useToast();

  const [busyNotes, setBusyNotes] = useState(false);
  const [adding, setAdding] = useState(false);
  const loadingNotes = notesLoading || busyNotes;

  // Confidential salary block (HR / super-admin only).
  const [cur, setCur] = useState(app.current_salary || "");
  const [exp, setExp] = useState(app.expected_salary || "");
  const [snotes, setSnotes] = useState(app.salary_notes || "");
  const [savedAt, setSavedAt] = useState(app.salary_updated_at || "");
  const [saving, setSaving] = useState(false);

  /** Re-fetch after an add/delete and push the result up to the parent. */
  const reload = useCallback(async () => {
    setBusyNotes(true);
    try {
      onNotesChange?.(await fetchNotes(app.id));
    } catch (e) {
      toast((e as Error).message || "Failed to reload interview notes", "error");
    } finally {
      setBusyNotes(false);
    }
    // onNotesChange is a stable setter from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id, toast]);

  async function saveSalary() {
    setSaving(true);
    const payload = {
      current_salary: cur.trim(),
      expected_salary: exp.trim(),
      ctc_offered: "",
      salary_notes: snotes.trim(),
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

  async function removeNote(id?: number) {
    if (!id) return;
    try {
      await deleteNote(app.id, id);
      toast("Note removed", "success");
      reload();
    } catch (e) {
      toast((e as Error).message || "Failed to remove note", "error");
    }
  }

  return (
    <div>
      {/* ─── Interview notes — read-only, one card per panelist ─── */}
      <div className="section">
        <div className="notes-head">
          <div className="section-title">Interview Notes</div>
          <span className="notes-count">
            {notes.length} {notes.length === 1 ? "assessment" : "assessments"}
          </span>
        </div>
        <p className="modal-sub" style={{ marginTop: 0 }}>
          Recorded by panelists in the Interview Panel. Read-only here so no one&rsquo;s
          assessment can be altered.
        </p>

        {loadingNotes ? (
          <div className="card-box"><div className="none-row">Loading…</div></div>
        ) : notes.length === 0 ? (
          <div className="card-box"><div className="none-row">No interview notes recorded yet.</div></div>
        ) : (
          notes.map((n) => (
            <div className="note-card" key={n.id}>
              <div className="note-head">
                <span className="note-who">
                  {has(n.interviewed_by) ? n.interviewed_by : "Unnamed interviewer"}
                  {n.round_no ? <span className="note-round">Round {n.round_no}</span> : null}
                </span>
                <span className="note-actions">
                  <span className="note-date">{fmtDate(n.interviewed_on) || "—"}</span>
                  <button className="note-del" title="Remove this note" onClick={() => removeNote(n.id)}>✕</button>
                </span>
              </div>
              <div className="note-meta">
                {has(n.interview_mode) && <span className="note-chip">{n.interview_mode}</span>}
                {has(n.employment_type) && <span className="note-chip">{n.employment_type}</span>}
                {has(n.designation_offered) && <span className="note-chip">{n.designation_offered}</span>}
                {has(n.date_of_joining) && <span className="note-chip">Joining {fmtDate(n.date_of_joining)}</span>}
                {has(n.recommended_salary) && <span className="note-chip money">₹{n.recommended_salary} discussed</span>}
              </div>
              {has(n.notes) && <div className="note-body">{n.notes}</div>}
            </div>
          ))
        )}

        {adding ? (
          <AddNoteForm
            appId={app.id}
            onCancel={() => setAdding(false)}
            onSaved={() => { setAdding(false); reload(); }}
          />
        ) : (
          <button className="btn-add-round" onClick={() => setAdding(true)}>
            + Add a note on behalf of an interviewer
          </button>
        )}
      </div>

      {/* ─── Confidential salary block (HR only) ─── */}
      <div className="section">
        <div className="salary-card">
          <div className="section-title">Compensation — Confidential</div>
          <p className="modal-sub" style={{ marginTop: 0 }}>
            Never shown to interviewers.
          </p>
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
            <button className="btn-accent" onClick={saveSalary} disabled={saving}>
              {saving ? "Saving…" : "Save Compensation"}
            </button>
            {has(savedAt) && <span className="saved-ts">Last saved {fmtDateTime(savedAt)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HR adding a note on someone's behalf ── */
function AddNoteForm({
  appId,
  onCancel,
  onSaved,
}: {
  appId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [who, setWho] = useState("");
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState("");
  const [desig, setDesig] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!who.trim()) return toast("Interviewer name is required.", "error");
    if (!when) return toast("Interview date is required.", "error");
    setBusy(true);
    try {
      await saveNote(appId, {
        interviewed_by: who.trim(),
        interviewed_on: when,
        interview_mode: mode,
        designation_offered: desig.trim(),
        notes: text.trim(),
        force_new: true,
      });
      toast("Note added", "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message || "Failed to add note", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="salary-card" style={{ marginTop: 12 }}>
      <div className="section-title">Add note on behalf</div>
      <div className="salary-grid">
        <div className="salary-field">
          <label>Interviewer name <span className="req">*</span></label>
          <input type="text" value={who} autoFocus onChange={(e) => setWho(e.target.value)} />
        </div>
        <div className="salary-field">
          <label>Interviewed on <span className="req">*</span></label>
          <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="salary-field">
          <label>Interview mode</label>
          <div className="tick-group">
            {["Physical", "Online"].map((o) => (
              <button key={o} type="button" className={`tick${mode === o ? " on" : ""}`} onClick={() => setMode(mode === o ? "" : o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="salary-field">
          <label>Designation discussed</label>
          <input type="text" value={desig} onChange={(e) => setDesig(e.target.value)} />
        </div>
        <div className="salary-field full">
          <label>Assessment</label>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn-accent" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Add Note"}
        </button>
      </div>
    </div>
  );
}
