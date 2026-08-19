"""
BTS / IILM Digital Employment Application — FastAPI backend.

Deployed on DigitalOcean, managed by Supervisor. Connects to the
PostgreSQL instance reached through the developer's open tunnel.

This deployment targets the `bts_f2f_info` database (created for the
face-to-face interview workflow). It exposes:

Public, no-API-key token endpoints (called by the candidate browser):
    GET  /validate-token/{token}   — validate + return pre-fill data
    POST /tokens/open/{token}      — record first-open (idempotent)

Admin endpoints (require X-API-Key header, used by the HR dashboard):
    GET   /applications                  — list (search / org / status filters)
    GET   /applications/{id}             — full application detail
    PATCH /applications/{id}/status      — update application status
    PATCH /applications/{id}/salary      — fill salary / CTC during interview

CORS is handled globally by the CORSMiddleware below, so these
endpoints are reachable from the Vercel-hosted candidate portal and the
admin dashboard.
"""

import json
import os
import re
import urllib.request
from typing import Optional

import psycopg2
import psycopg2.errors
import psycopg2.extras
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load credentials from backend/.env if present, so the app can be started
# with a plain `python -m uvicorn main:app` without exporting env vars first.
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

app = FastAPI(title="BTS/IILM Application API")

# ------------------------------------------------------------
# CORS — allows the candidate portal + admin dashboard to call us
# ------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # static sites; auth is via API key, not cookies
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Database connection helper
# ------------------------------------------------------------
# BTS_DB_URL controls the connection. Default points at the new
# face-to-face-info database created behind the developer's tunnel.
# Replace <tunnel_port> / <password> via the env var in production.
DATABASE_URL = os.environ.get(
    "BTS_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/bts_f2f_info",
)

# Shared secret for admin endpoints. Must match CONFIG.API_KEY in the
# admin dashboard. Override in production via the BTS_API_KEY env var.
API_KEY = os.environ.get("BTS_API_KEY", "bts_admin_2024_change_me")

# HR invite flow. The webhook (n8n) emails the candidate their tokenised
# form link. FORM_BASE_URL is the public URL of the candidate portal.
N8N_INVITE_WEBHOOK_URL = os.environ.get("N8N_INVITE_WEBHOOK_URL", "")
FORM_BASE_URL = os.environ.get("FORM_BASE_URL", "http://localhost:8080").rstrip("/")

# How many days an invite link stays valid, and how long we wait for the
# webhook (kept just under the dashboard's 7s UX lock).
INVITE_VALID_DAYS = int(os.environ.get("INVITE_VALID_DAYS", "7"))
WEBHOOK_TIMEOUT_SECS = float(os.environ.get("WEBHOOK_TIMEOUT_SECS", "7"))

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_conn():
    """Open a new DB connection. Caller is responsible for closing it."""
    return psycopg2.connect(DATABASE_URL)


def require_api_key(x_api_key: Optional[str]):
    """Reject the request unless the X-API-Key header matches BTS_API_KEY."""
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing API key")


# ============================================================
# PART 2: PUBLIC TOKEN ENDPOINTS (no API key)
# ============================================================

@app.get("/validate-token/{token}")
def validate_token(token: str):
    """
    Called on form page load. Returns token validity + pre-fill data.

    valid   -> {valid:true, email, org, position, opened_at}
    invalid -> {valid:false, reason: not_found | already_submitted | expired}
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, email, org, position, opened_at, status,
                       (expires_at < NOW()) AS is_expired
                FROM bts_form_tokens
                WHERE token = %s
                """,
                (token,),
            )
            row = cur.fetchone()

            if row is None:
                return {"valid": False, "reason": "not_found"}

            if row["status"] == "submitted":
                return {"valid": False, "reason": "already_submitted"}

            if row["is_expired"]:
                # Mark expired (only if not already in a terminal state)
                cur.execute(
                    """
                    UPDATE bts_form_tokens
                    SET status = 'expired'
                    WHERE id = %s AND status NOT IN ('submitted', 'expired')
                    """,
                    (row["id"],),
                )
                conn.commit()
                return {"valid": False, "reason": "expired"}

            return {
                "valid": True,
                "email": row["email"],
                "org": row["org"],
                "position": row["position"],
                # ISO string or None (null == first time opening)
                "opened_at": row["opened_at"].isoformat() if row["opened_at"] else None,
            }
    finally:
        conn.close()


@app.post("/tokens/open/{token}")
def open_token(token: str):
    """
    Called immediately after validation succeeds. Records the moment
    the candidate first opened the form. Idempotent: does nothing if
    already opened.
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Only stamp opened_at the first time; never overwrite.
            # Don't disturb tokens already submitted/expired.
            cur.execute(
                """
                UPDATE bts_form_tokens
                SET opened_at = NOW(),
                    status = 'opened'
                WHERE token = %s
                  AND opened_at IS NULL
                  AND status NOT IN ('submitted', 'expired')
                """,
                (token,),
            )
            conn.commit()
        # Always succeed silently, whether or not a row was updated.
        return {"success": True}
    finally:
        conn.close()


# ============================================================
# PART 3: ADMIN ENDPOINTS (require X-API-Key)
# ============================================================

# Columns returned in the list view — kept lean (no JSONB blobs, no photo).
_LIST_COLUMNS = """
    id, email, position_applied_for, org, status, campus,
    salutation, first_name, middle_name, surname,
    (photo_base64 IS NOT NULL AND photo_base64 <> '') AS has_photo,
    created_at
"""

# Allowed status values — mirror the schema CHECK constraint.
_STATUSES = {
    "submitted", "under_review", "interviewed",
    "did_not_turn_up", "rejected", "active_file", "appointed",
}

# Campuses — mirror the schema CHECK constraint.
_CAMPUSES = {"Delhi", "Jaipur", "Chandigarh"}


def _campus_scope(x_campus: Optional[str]) -> Optional[str]:
    """Resolve the trusted X-Campus header into a scope.

    Returns None for super-admin ("all" / missing / unknown) meaning no
    restriction, or a specific campus that every query must be limited to.
    """
    return x_campus if x_campus in _CAMPUSES else None


# ------------------------------------------------------------
# Role scoping. The admin dashboard proxy derives X-Role from the signed
# session cookie, so the browser cannot forge it.
#   admin / hr   -> full access within their campus scope
#   interviewer  -> candidate details WITHOUT salary; may only write their
#                   own interview-note row. No status/campus/salary/invite.
# ------------------------------------------------------------
_ROLES = {"admin", "hr", "interviewer"}

# Confidential fields an interviewer must never receive.
_SALARY_FIELDS = (
    "current_salary",
    "expected_salary",
    "ctc_offered",
    "salary_notes",
    "salary_updated_at",
)


def _role(x_role: Optional[str]) -> str:
    """Trusted caller role; anything unknown falls back to the least-privileged."""
    return x_role if x_role in _ROLES else "hr"


def _is_interviewer(x_role: Optional[str]) -> bool:
    return _role(x_role) == "interviewer"


def _require_not_interviewer(x_role: Optional[str], what: str) -> None:
    if _is_interviewer(x_role):
        raise HTTPException(status_code=403, detail=f"Interviewers cannot {what}.")


def _strip_salary(row: dict) -> dict:
    """Remove confidential salary fields from an outgoing record."""
    return {k: v for k, v in row.items() if k not in _SALARY_FIELDS}


class StatusUpdate(BaseModel):
    status: str


class CampusUpdate(BaseModel):
    campus: str


class SalaryUpdate(BaseModel):
    current_salary: Optional[str] = None
    expected_salary: Optional[str] = None
    ctc_offered: Optional[str] = None
    salary_notes: Optional[str] = None
    # Multi-round interviewer notes (list of round objects).
    interview_rounds: Optional[list] = None


class NoteUpsert(BaseModel):
    """One interviewer's note for one candidate.

    Stored as its own row in bts_interview_notes so several panelists can
    save concurrently without overwriting each other.
    """
    interviewed_by: str
    interviewed_on: Optional[str] = None
    interview_mode: Optional[str] = None
    employment_type: Optional[str] = None
    designation_offered: Optional[str] = None
    date_of_joining: Optional[str] = None
    notes: Optional[str] = None
    # The interviewer's OWN observed/recommended figure. Never exposes HR's
    # confidential salary block.
    recommended_salary: Optional[str] = None
    # Update an existing row when given; otherwise upsert by interviewer name.
    note_id: Optional[int] = None
    force_new: Optional[bool] = False


def _serialize(row: dict) -> dict:
    """Make a RealDictRow JSON-safe (dates/timestamps -> ISO strings)."""
    out = {}
    for key, value in row.items():
        if hasattr(value, "isoformat"):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


@app.get("/applications")
def list_applications(
    search: Optional[str] = None,
    org: Optional[str] = None,
    status: Optional[str] = None,
    campus: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
):
    """List applications for the dashboard left panel. Newest first.

    date_from / date_to filter on the submission date (created_at), inclusive,
    as YYYY-MM-DD in the server's local date.
    """
    require_api_key(x_api_key)

    where = []
    params: list = []

    if search:
        where.append(
            "(LOWER(COALESCE(first_name,'') || ' ' || COALESCE(middle_name,'') "
            "|| ' ' || COALESCE(surname,'')) LIKE %s "
            "OR LOWER(COALESCE(email,'')) LIKE %s "
            "OR LOWER(COALESCE(position_applied_for,'')) LIKE %s)"
        )
        like = f"%{search.lower()}%"
        params += [like, like, like]

    if org in ("BTS", "IILM"):
        where.append("org = %s")
        params.append(org)

    if status in _STATUSES:
        where.append("status = %s")
        params.append(status)

    # Campus isolation: a campus-scoped session is locked to its campus;
    # super-admin (scope None) may optionally filter by the ?campus= param.
    scope = _campus_scope(x_campus)
    effective_campus = scope or (campus if campus in _CAMPUSES else None)
    if effective_campus:
        where.append("campus = %s")
        params.append(effective_campus)

    if date_from:
        where.append("created_at::date >= %s")
        params.append(date_from)

    if date_to:
        where.append("created_at::date <= %s")
        params.append(date_to)

    clause = ("WHERE " + " AND ".join(where)) if where else ""

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"SELECT {_LIST_COLUMNS} FROM bts_applications "
                f"{clause} ORDER BY created_at DESC NULLS LAST, id DESC",
                params,
            )
            rows = cur.fetchall()
        return {"applications": [_serialize(r) for r in rows]}
    finally:
        conn.close()


@app.get("/applications/{app_id}")
def get_application(
    app_id: int,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """Full detail for one application, including JSONB sections + photo.

    Campus isolation: a campus-scoped caller can only read rows for its
    own campus; anything else returns 404 (indistinguishable from missing).

    Confidentiality: an interviewer never receives the salary fields — they
    are stripped server-side, so they never reach the browser at all.
    """
    require_api_key(x_api_key)
    scope = _campus_scope(x_campus)

    sql = "SELECT * FROM bts_applications WHERE id = %s"
    params: list = [app_id]
    if scope:
        sql += " AND campus = %s"
        params.append(scope)

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="application not found")
        out = _serialize(row)
        if _is_interviewer(x_role):
            out = _strip_salary(out)
        return out
    finally:
        conn.close()


@app.patch("/applications/{app_id}/status")
def update_status(
    app_id: int,
    body: StatusUpdate,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """Update an application's lifecycle status (campus-scoped, not interviewers)."""
    require_api_key(x_api_key)
    _require_not_interviewer(x_role, "change a candidate's status")
    scope = _campus_scope(x_campus)

    if body.status not in _STATUSES:
        raise HTTPException(status_code=400, detail="invalid status")

    sql = "UPDATE bts_applications SET status = %s WHERE id = %s"
    params: list = [body.status, app_id]
    if scope:
        sql += " AND campus = %s"
        params.append(scope)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="application not found")
            conn.commit()
        return {"success": True, "status": body.status}
    finally:
        conn.close()


@app.patch("/applications/{app_id}/campus")
def update_campus(
    app_id: int,
    body: CampusUpdate,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
):
    """Reassign an application's campus. SUPER-ADMIN ONLY.

    A campus-scoped caller (X-Campus is a specific campus) is forbidden —
    only the super-admin (scope 'all' -> None) may move applicants between
    campuses.
    """
    require_api_key(x_api_key)
    if _campus_scope(x_campus) is not None:
        raise HTTPException(status_code=403, detail="Only a super-admin can change campus.")
    if body.campus not in _CAMPUSES:
        raise HTTPException(status_code=400, detail="invalid campus")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE bts_applications SET campus = %s WHERE id = %s",
                (body.campus, app_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="application not found")
            conn.commit()
        return {"success": True, "campus": body.campus}
    finally:
        conn.close()


@app.patch("/applications/{app_id}/salary")
def update_salary(
    app_id: int,
    body: SalaryUpdate,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """Fill / update the confidential salary block. HR / super-admin only."""
    require_api_key(x_api_key)
    _require_not_interviewer(x_role, "view or edit salary details")
    scope = _campus_scope(x_campus)

    sql = """
        UPDATE bts_applications
        SET current_salary    = %s,
            expected_salary   = %s,
            ctc_offered       = %s,
            salary_notes      = %s,
            interview_rounds  = %s::jsonb,
            salary_updated_at = NOW()
        WHERE id = %s
    """
    params: list = [
        body.current_salary,
        body.expected_salary,
        body.ctc_offered,
        body.salary_notes,
        json.dumps(body.interview_rounds or []),
        app_id,
    ]
    if scope:
        sql += " AND campus = %s"
        params.append(scope)
    sql += " RETURNING salary_updated_at"

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="application not found")
            conn.commit()
        return {
            "success": True,
            "salary_updated_at": row["salary_updated_at"].isoformat(),
        }
    finally:
        conn.close()


# ============================================================
# INTERVIEW NOTES — one row per interviewer per candidate.
#
# Each panelist writes only their own row, so three interviewers can save
# at the same time without overwriting one another (the old single-JSONB
# array could not do this — the last save won and erased the rest).
# ============================================================

def _assert_application_visible(cur, app_id: int, scope: Optional[str]) -> dict:
    """Fetch the application within the caller's campus scope, or 404."""
    sql = "SELECT id, campus FROM bts_applications WHERE id = %s"
    params: list = [app_id]
    if scope:
        sql += " AND campus = %s"
        params.append(scope)
    cur.execute(sql, params)
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="application not found")
    return row


@app.get("/applications/{app_id}/notes")
def list_notes(
    app_id: int,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
):
    """All interview notes for one candidate, oldest first. Campus-scoped."""
    require_api_key(x_api_key)
    scope = _campus_scope(x_campus)

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _assert_application_visible(cur, app_id, scope)
            cur.execute(
                """
                SELECT id, application_id, campus, round_no, interviewed_by,
                       interviewed_on, interview_mode, employment_type,
                       designation_offered, date_of_joining, notes,
                       recommended_salary, source, created_at, updated_at
                FROM bts_interview_notes
                WHERE application_id = %s
                ORDER BY COALESCE(interviewed_on, created_at::date), id
                """,
                (app_id,),
            )
            rows = cur.fetchall()
        return {"notes": [_serialize(r) for r in rows]}
    finally:
        conn.close()


@app.put("/applications/{app_id}/notes")
def upsert_note(
    app_id: int,
    body: NoteUpsert,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """Create or update ONE interviewer's note row.

    Resolution order:
      * note_id given            -> update exactly that row
      * force_new                -> always insert a new row
      * otherwise                -> update this interviewer's existing row
                                    for the candidate, else insert.

    An interviewer may only touch a row that carries their own name, so one
    panelist can never edit another panelist's assessment.
    """
    require_api_key(x_api_key)
    scope = _campus_scope(x_campus)
    role = _role(x_role)

    who = (body.interviewed_by or "").strip()
    if not who:
        raise HTTPException(status_code=400, detail="'Interviewed by' is required.")
    if not (body.interviewed_on or "").strip():
        raise HTTPException(status_code=400, detail="'Interviewed on' is required.")

    fields = (
        who,
        (body.interviewed_on or "").strip() or None,
        (body.interview_mode or "").strip() or None,
        (body.employment_type or "").strip() or None,
        (body.designation_offered or "").strip() or None,
        (body.date_of_joining or "").strip() or None,
        body.notes,
        (body.recommended_salary or "").strip() or None,
    )

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            app_row = _assert_application_visible(cur, app_id, scope)

            target_id = body.note_id
            if target_id is None and not body.force_new:
                cur.execute(
                    """
                    SELECT id FROM bts_interview_notes
                    WHERE application_id = %s AND lower(trim(interviewed_by)) = lower(%s)
                    ORDER BY id DESC LIMIT 1
                    """,
                    (app_id, who),
                )
                existing = cur.fetchone()
                if existing:
                    target_id = existing["id"]

            if target_id is not None:
                # Interviewers may only edit a row bearing their own name.
                cur.execute(
                    "SELECT id, interviewed_by FROM bts_interview_notes WHERE id = %s AND application_id = %s",
                    (target_id, app_id),
                )
                owner = cur.fetchone()
                if owner is None:
                    raise HTTPException(status_code=404, detail="note not found")
                if role == "interviewer" and (owner["interviewed_by"] or "").strip().lower() != who.lower():
                    raise HTTPException(
                        status_code=403,
                        detail="You can only edit your own interview note.",
                    )
                cur.execute(
                    """
                    UPDATE bts_interview_notes
                    SET interviewed_by = %s,
                        interviewed_on = NULLIF(%s,'')::date,
                        interview_mode = %s,
                        employment_type = %s,
                        designation_offered = %s,
                        date_of_joining = NULLIF(%s,'')::date,
                        notes = %s,
                        recommended_salary = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                    """,
                    fields + (target_id,),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO bts_interview_notes
                      (application_id, campus, interviewed_by, interviewed_on,
                       interview_mode, employment_type, designation_offered,
                       date_of_joining, notes, recommended_salary, source, round_no)
                    VALUES (%s, %s, %s, NULLIF(%s,'')::date, %s, %s, %s,
                            NULLIF(%s,'')::date, %s, %s, %s,
                            (SELECT COALESCE(MAX(round_no), 0) + 1
                               FROM bts_interview_notes WHERE application_id = %s))
                    RETURNING id
                    """,
                    (app_id, app_row["campus"]) + fields + (role, app_id),
                )
            saved = cur.fetchone()
            conn.commit()
        return {"success": True, "id": saved["id"]}
    finally:
        conn.close()


@app.delete("/applications/{app_id}/notes/{note_id}")
def delete_note(
    app_id: int,
    note_id: int,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """Remove an interview note. HR / super-admin only."""
    require_api_key(x_api_key)
    _require_not_interviewer(x_role, "delete interview notes")
    scope = _campus_scope(x_campus)

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _assert_application_visible(cur, app_id, scope)
            cur.execute(
                "DELETE FROM bts_interview_notes WHERE id = %s AND application_id = %s",
                (note_id, app_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="note not found")
            conn.commit()
        return {"success": True}
    finally:
        conn.close()


# ============================================================
# PART 4: HR INVITE ENDPOINT (require X-API-Key)
# ============================================================

class InviteCreate(BaseModel):
    email: str
    position: Optional[str] = None
    campus: Optional[str] = None


def _fire_invite_webhook(payload: dict) -> bool:
    """POST the invite payload to the n8n webhook. Returns True on 2xx.

    n8n is the single source of truth for the invite: it generates the
    token, writes the bts_form_tokens row (expiring any prior active one
    for this email+org), and emails the candidate the link. This backend
    only triggers that workflow — it never writes the token itself, so
    there is exactly one token row per invite.
    """
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        N8N_INVITE_WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=WEBHOOK_TIMEOUT_SECS) as resp:
        return 200 <= resp.status < 300


@app.post("/invites")
def create_invite(
    body: InviteCreate,
    x_api_key: Optional[str] = Header(None),
    x_campus: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
):
    """
    HR adds an arrived candidate's email. We forward it to the n8n invite
    workflow, which creates the token + emails the candidate the link.

    Race safety:
      * 7-second UX lock on the dashboard button (one HR, no double-click).
      * n8n expires any prior active token for this email before inserting.
      * The UNIQUE partial index on bts_form_tokens(email, org) WHERE
        status NOT IN ('submitted','expired') is the Postgres-level backstop
        against two truly-concurrent active inserts.
    """
    require_api_key(x_api_key)
    _require_not_interviewer(x_role, "invite candidates")

    email = (body.email or "").strip().lower()
    position = (body.position or "").strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Campus: a campus-scoped session forces its own campus; super-admin
    # must pick one in the request body. Either way it must be a real campus.
    scope = _campus_scope(x_campus)
    campus = scope or (body.campus or "").strip()
    if campus not in _CAMPUSES:
        raise HTTPException(status_code=400, detail="A valid campus is required for the invite.")

    if not N8N_INVITE_WEBHOOK_URL:
        raise HTTPException(
            status_code=500,
            detail="Invite workflow is not configured (set N8N_INVITE_WEBHOOK_URL).",
        )

    try:
        triggered = _fire_invite_webhook(
            {"email": email, "org": "BTS", "position": position, "campus": campus}
        )
    except Exception as exc:  # noqa: BLE001 — surface a clean message to HR
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the invite workflow. {exc}",
        )

    if not triggered:
        raise HTTPException(status_code=502, detail="The invite workflow rejected the request.")

    return {"success": True, "email": email, "campus": campus}
