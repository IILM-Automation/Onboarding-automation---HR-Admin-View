"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchApplications,
  fetchApplication,
  fetchNotes,
  saveNote,
  logout,
  type Session,
} from "@/lib/client";
import type { AppDetail, AppListItem, InterviewNote, Employment } from "@/lib/types";
import { fmtDate, fullName, has, relativeDate } from "@/lib/format";
import { useToast } from "./Toast";
import { Cell, DataTable, KV } from "./ui";

const NAME_KEY = "bts_interviewer_name";

const BLANK: InterviewNote = {
  interviewed_by: "",
  interviewed_on: "",
  interview_mode: "",
  employment_type: "",
  designation_offered: "",
  date_of_joining: "",
  notes: "",
  recommended_salary: "",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Standalone interview panel. Campus-scoped, salary-free.
 * Several panelists can use it at once — each saves their OWN note row.
 */
export default function InterviewerPanel({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
    if (saved) setName(saved);
  }, []);

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      try {
        setApps(await fetchApplications({ search: s }));
      } catch (e) {
        toast((e as Error).message || "Failed to load candidates", "error");
        setApps([]);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (name) load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  function onSearch(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v), 300);
  }

  function confirmName() {
    const v = nameDraft.trim();
    if (!v) return toast("Please enter your name.", "error");
    window.localStorage.setItem(NAME_KEY, v);
    setName(v);
  }

  async function doLogout() {
    await logout();
    onLogout();
  }

  /* ── Name gate ───────────────────────────────────────────── */
  if (!name) {
    return (
      <div className="login">
        <div className="aurora" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
        </div>
        <div className="login-card wide">
          <div className="step">
            <div className="auth-scope">
              <span className="auth-scope-emoji">🎤</span>
              <span className="auth-scope-name">Interview Panel · {session.campus}</span>
            </div>
            <p className="landing-sub">
              Your name is attached to the notes you record, so the HR team knows who assessed
              each candidate.
            </p>
            <input
              type="text"
              placeholder="Your full name"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmName()}
            />
            <button className="btn-primary btn-glow" onClick={confirmName}>
              Continue →
            </button>
            <div className="login-foot" style={{ marginTop: 16 }}>
              <button className="role-switch" onClick={doLogout}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Candidate detail + notes form ───────────────────────── */
  if (selected !== null) {
    return (
      <InterviewCandidate
        appId={selected}
        interviewer={name}
        onBack={() => setSelected(null)}
      />
    );
  }

  /* ── Candidate list ─────────────────────────────────────── */
  return (
    <div className="ip-shell">
      <header className="ip-topbar">
        <div className="ip-brand">
          <span className="ip-mark">🎤</span>
          <div>
            <div className="ip-title">Interview Panel</div>
            <div className="ip-sub">BTS {session.campus}</div>
          </div>
        </div>
        <div className="ip-who">
          <span className="ip-who-name">{name}</span>
          <button
            className="role-switch"
            onClick={() => { window.localStorage.removeItem(NAME_KEY); setName(null); }}
          >
            Change
          </button>
          <button className="role-switch" onClick={doLogout}>Sign out</button>
        </div>
      </header>

      <div className="ip-body">
        <div className="ip-head">
          <h2 className="ip-h2">Select a candidate to interview</h2>
          <input
            className="search-input"
            type="text"
            placeholder="Search name, email, position…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : apps.length === 0 ? (
          <div className="empty-state"><div>No candidates found</div></div>
        ) : (
          <div className="ip-grid">
            {apps.map((a) => (
              <button key={a.id} className="ip-card" onClick={() => setSelected(a.id)}>
                <span className="ip-card-name">{fullName(a)}</span>
                <span className="ip-card-pos">
                  {has(a.position_applied_for) ? a.position_applied_for : "—"}
                </span>
                <span className="ip-card-meta">
                  {has(a.campus) && <span className="campus-badge">{a.campus}</span>}
                  <span className="ip-card-date">{relativeDate(a.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   One candidate: salary-free details + this interviewer's note
   ============================================================ */
function InterviewCandidate({
  appId,
  interviewer,
  onBack,
}: {
  appId: number;
  interviewer: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [form, setForm] = useState<InterviewNote>({ ...BLANK, interviewed_by: interviewer, interviewed_on: todayISO() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchApplication(appId), fetchNotes(appId)])
      .then(([d, n]) => {
        if (cancelled) return;
        setApp(d);
        setNotes(n);
        const mine = n.find(
          (x) => (x.interviewed_by || "").trim().toLowerCase() === interviewer.trim().toLowerCase()
        );
        setForm(
          mine
            ? {
                ...BLANK,
                ...mine,
                interviewed_on: (mine.interviewed_on || "").slice(0, 10),
                date_of_joining: (mine.date_of_joining || "").slice(0, 10),
              }
            : { ...BLANK, interviewed_by: interviewer, interviewed_on: todayISO() }
        );
      })
      .catch((e) => !cancelled && toast((e as Error).message || "Failed to load candidate", "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [appId, interviewer, toast]);

  function patch(k: keyof InterviewNote, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    if (!(form.interviewed_on || "").trim()) return toast("Please set the interview date.", "error");
    setSaving(true);
    try {
      const res = await saveNote(appId, { ...form, interviewed_by: interviewer });
      setForm((p) => ({ ...p, id: res.id }));
      setNotes(await fetchNotes(appId));
      toast("Your interview notes were saved", "success");
    } catch (e) {
      toast((e as Error).message || "Failed to save notes", "error");
    } finally {
      setSaving(false);
    }
  }

  const Tick = ({ options, value, onChange }: { options: string[]; value?: string | null; onChange: (v: string) => void }) => (
    <div className="tick-group">
      {options.map((o) => (
        <button key={o} type="button" className={`tick${value === o ? " on" : ""}`} onClick={() => onChange(value === o ? "" : o)}>
          {o}
        </button>
      ))}
    </div>
  );

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!app) return <div className="empty-state">Could not load candidate.</div>;

  const emp: Record<string, Employment | undefined> = {};
  (app.employment || []).forEach((e) => { if (e.type) emp[e.type] = e; });
  const empSections: Array<[string, Employment | undefined]> = [
    ["Present Employment", emp.present],
    ["Previous Employment", emp.previous],
    ["Prior to Previous", emp.prior],
  ];
  const others = notes.filter(
    (n) => (n.interviewed_by || "").trim().toLowerCase() !== interviewer.trim().toLowerCase()
  );

  return (
    <div className="ip-shell">
      <header className="ip-topbar">
        <button className="role-switch" onClick={onBack}>← All candidates</button>
        <div className="ip-who"><span className="ip-who-name">{interviewer}</span></div>
      </header>

      <div className="ip-body">
        <div className="detail-header" style={{ marginBottom: 18 }}>
          <div className="dh-main">
            <div className="dh-name">{fullName(app)}</div>
            <div className="dh-sub">
              <span>{has(app.position_applied_for) ? app.position_applied_for : "—"}</span>
              {has(app.campus) && <span className="campus-badge">{app.campus}</span>}
            </div>
            <div className="dh-date">
              {has(app.email) ? app.email : "no email"}{has(app.mobile) ? ` · ${app.mobile}` : ""}
            </div>
          </div>
          {has(app.photo_base64) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dh-photo" src={app.photo_base64 as string} alt="candidate" />
          )}
        </div>

        {/* ── YOUR NOTES (first — it's why they're here) ── */}
        <div className="section">
          <div className="salary-card">
            <div className="section-title">Your interview notes</div>
            <p className="modal-sub">
              Saved against your name. Other panelists record their own notes separately.
            </p>
            <div className="salary-grid">
              <div className="salary-field">
                <label>Interviewed by</label>
                <input type="text" value={interviewer} readOnly className="locked-input" />
              </div>
              <div className="salary-field">
                <label>Interviewed on <span className="req">*</span></label>
                <input type="date" value={form.interviewed_on || ""} onChange={(e) => patch("interviewed_on", e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Interview mode</label>
                <Tick options={["Physical", "Online"]} value={form.interview_mode} onChange={(v) => patch("interview_mode", v)} />
              </div>
              <div className="salary-field">
                <label>Employment type</label>
                <Tick options={["Full Time", "Part Time"]} value={form.employment_type} onChange={(v) => patch("employment_type", v)} />
              </div>
              <div className="salary-field">
                <label>Designation discussed</label>
                <input type="text" value={form.designation_offered || ""} onChange={(e) => patch("designation_offered", e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Possible date of joining</label>
                <input type="date" value={form.date_of_joining || ""} onChange={(e) => patch("date_of_joining", e.target.value)} />
              </div>
              <div className="salary-field">
                <label>Salary discussed / recommended (₹)</label>
                <input
                  type="text"
                  value={form.recommended_salary || ""}
                  placeholder="e.g. 45000"
                  onChange={(e) => patch("recommended_salary", e.target.value)}
                />
              </div>
              <div className="salary-field full">
                <label>Your assessment</label>
                <textarea
                  rows={8}
                  value={form.notes || ""}
                  placeholder="Subject knowledge, communication, demo performance, recommendation…"
                  onChange={(e) => patch("notes", e.target.value)}
                />
              </div>
            </div>
            <div className="salary-foot">
              <button className="btn-accent" onClick={save} disabled={saving}>
                {saving ? "Saving…" : form.id ? "Update My Notes" : "Save My Notes"}
              </button>
              {form.id && <span className="saved-ts">Editing your saved note</span>}
            </div>
          </div>
        </div>

        {/* ── Other panelists (read-only) ── */}
        {others.length > 0 && (
          <div className="section">
            <div className="section-title">Other panelists&rsquo; assessments</div>
            {others.map((n) => (
              <div className="note-card" key={n.id}>
                <div className="note-head">
                  <span className="note-who">{n.interviewed_by}</span>
                  <span className="note-date">{fmtDate(n.interviewed_on) || "—"}</span>
                </div>
                {has(n.notes) && <div className="note-body">{n.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Candidate details (no salary anywhere) ── */}
        <div className="section">
          <div className="section-title">Personal</div>
          <div className="card-box">
            <div className="kv-grid">
              <KV label="Full Name" value={fullName(app)} />
              <KV label="Date of Birth" value={fmtDate(app.date_of_birth)} />
              <KV label="Age" value={app.age ?? ""} />
              <KV label="Sex" value={app.sex} />
              <KV label="Native City & State" value={app.native_city_state} />
              <KV label="Languages Known" value={app.languages_known} />
              <KV label="Notice Period" value={app.notice_period} />
              <KV label="Present Address" value={app.present_address} full />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Education</div>
          <DataTable
            headers={["Qualification", "Subjects", "Year", "Institution", "Division", "%/CGPA"]}
            rows={(app.education || []).map((r) => [
              <Cell key="1" value={r.exam} />, <Cell key="2" value={r.subjects} />,
              <Cell key="3" value={r.year_passing} />, <Cell key="4" value={r.institution} />,
              <Cell key="5" value={r.division} />, <Cell key="6" value={r.percentage} />,
            ])}
          />
        </div>

        <div className="section">
          <div className="section-title">Employment History</div>
          {empSections.some(([, e]) => e) ? (
            empSections.map(([label, e]) =>
              e ? (
                <div className="card-box" key={label} style={{ marginBottom: 12 }}>
                  <div className="kv-label" style={{ marginBottom: 8 }}>{label}</div>
                  <div className="kv-grid">
                    <KV label="Employer" value={e.employer_name} />
                    <KV label="Nature of Business" value={e.nature_business} />
                    <KV label="Period From" value={fmtDate(e.period_from)} />
                    <KV label="Period To" value={fmtDate(e.period_to)} />
                    <KV label="Duration" value={e.duration} />
                    <KV label="Location" value={e.job_location} />
                    <KV label="Starting Position" value={e.position_start} />
                    <KV label="Last / Current Position" value={e.position_last} />
                    <KV label="Supervisor" value={e.supervisor} />
                    <KV label="Reason for Leaving" value={e.reason_leaving} />
                    <KV label="Job Description" value={e.job_description} full />
                  </div>
                </div>
              ) : null
            )
          ) : (
            <div className="card-box"><div className="none-row">None provided</div></div>
          )}
        </div>

        <div className="section">
          <div className="section-title">Extra-Curricular / Sports</div>
          <DataTable
            headers={["Activity", "Institution", "Year", "Position", "Prizes"]}
            rows={(app.extracurricular || []).map((r) => [
              <Cell key="1" value={r.activity} />, <Cell key="2" value={r.institution} />,
              <Cell key="3" value={r.year} />, <Cell key="4" value={r.position} />,
              <Cell key="5" value={r.prizes} />,
            ])}
          />
        </div>
      </div>
    </div>
  );
}
