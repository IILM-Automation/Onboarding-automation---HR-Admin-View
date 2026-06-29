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
    id, email, position_applied_for, org, status,
    salutation, first_name, middle_name, surname,
    (photo_base64 IS NOT NULL AND photo_base64 <> '') AS has_photo,
    created_at
"""

# Allowed status values — mirror the schema CHECK constraint.
_STATUSES = {
    "submitted", "under_review", "interviewed",
    "rejected", "active_file", "appointed",
}


class StatusUpdate(BaseModel):
    status: str


class SalaryUpdate(BaseModel):
    current_salary: Optional[str] = None
    expected_salary: Optional[str] = None
    ctc_offered: Optional[str] = None
    salary_notes: Optional[str] = None


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
    x_api_key: Optional[str] = Header(None),
):
    """List applications for the dashboard left panel. Newest first."""
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
def get_application(app_id: int, x_api_key: Optional[str] = Header(None)):
    """Full detail for one application, including JSONB sections + photo."""
    require_api_key(x_api_key)

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM bts_applications WHERE id = %s", (app_id,))
            row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="application not found")
        return _serialize(row)
    finally:
        conn.close()


@app.patch("/applications/{app_id}/status")
def update_status(
    app_id: int,
    body: StatusUpdate,
    x_api_key: Optional[str] = Header(None),
):
    """Update an application's lifecycle status."""
    require_api_key(x_api_key)

    if body.status not in _STATUSES:
        raise HTTPException(status_code=400, detail="invalid status")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE bts_applications SET status = %s WHERE id = %s",
                (body.status, app_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="application not found")
            conn.commit()
        return {"success": True, "status": body.status}
    finally:
        conn.close()


@app.patch("/applications/{app_id}/salary")
def update_salary(
    app_id: int,
    body: SalaryUpdate,
    x_api_key: Optional[str] = Header(None),
):
    """Fill / update salary + CTC fields during the interview."""
    require_api_key(x_api_key)

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE bts_applications
                SET current_salary    = %s,
                    expected_salary   = %s,
                    ctc_offered       = %s,
                    salary_notes      = %s,
                    salary_updated_at = NOW()
                WHERE id = %s
                RETURNING salary_updated_at
                """,
                (
                    body.current_salary,
                    body.expected_salary,
                    body.ctc_offered,
                    body.salary_notes,
                    app_id,
                ),
            )
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
# PART 4: HR INVITE ENDPOINT (require X-API-Key)
# ============================================================

class InviteCreate(BaseModel):
    email: str
    position: Optional[str] = None


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
def create_invite(body: InviteCreate, x_api_key: Optional[str] = Header(None)):
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

    email = (body.email or "").strip().lower()
    position = (body.position or "").strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not N8N_INVITE_WEBHOOK_URL:
        raise HTTPException(
            status_code=500,
            detail="Invite workflow is not configured (set N8N_INVITE_WEBHOOK_URL).",
        )

    try:
        triggered = _fire_invite_webhook({"email": email, "org": "BTS", "position": position})
    except Exception as exc:  # noqa: BLE001 — surface a clean message to HR
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the invite workflow. {exc}",
        )

    if not triggered:
        raise HTTPException(status_code=502, detail="The invite workflow rejected the request.")

    return {"success": True, "email": email}
