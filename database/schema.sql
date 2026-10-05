-- ============================================================
-- BTS / IILM Digital Employment Application — PostgreSQL schema
-- Runs inside the n8n-postgres-1 Docker container.
--
-- NOTE: The base `bts_applications` table below is the existing
-- applications table. The token table and the ALTER additions at
-- the bottom (Part 1) are the only schema additions for this task.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ------------------------------------------------------------
-- Base applications table (existing)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bts_applications (
    id                   SERIAL PRIMARY KEY,
    email                TEXT,
    position_applied_for TEXT,

    -- Personal
    salutation           TEXT,
    first_name           TEXT,
    middle_name          TEXT,
    surname              TEXT,
    date_of_birth        DATE,
    age                  INTEGER,
    native_city_state    TEXT,
    sex                  TEXT,
    religion             TEXT,
    languages_known      TEXT,
    present_address      TEXT,
    tel_res              TEXT,
    tel_off              TEXT,
    mobile               TEXT,
    permanent_address    TEXT,
    perm_tel_res         TEXT,

    -- Repeating / structured sections stored as JSONB
    family_members       JSONB DEFAULT '[]'::jsonb,
    education            JSONB DEFAULT '[]'::jsonb,
    memberships          JSONB DEFAULT '[]'::jsonb,
    trainings            JSONB DEFAULT '[]'::jsonb,
    employment           JSONB DEFAULT '[]'::jsonb,
    extracurricular      JSONB DEFAULT '[]'::jsonb,

    -- Physical / health
    height               TEXT,
    weight               TEXT,
    power_of_glasses     TEXT,
    physical_disability  TEXT,
    illness_from         DATE,
    illness_to           DATE,
    illness_days         TEXT,
    illness_nature       TEXT,
    chronic_diabetes     BOOLEAN DEFAULT FALSE,
    chronic_high_bp      BOOLEAN DEFAULT FALSE,
    chronic_heart_disease BOOLEAN DEFAULT FALSE,
    chronic_asthma       BOOLEAN DEFAULT FALSE,
    chronic_other        TEXT,

    -- Social
    linkedin_profile     TEXT,
    linkedin_updated     DATE,
    twitter_profile      TEXT,
    twitter_updated      DATE,
    facebook_profile     TEXT,
    facebook_updated     DATE,

    -- Career
    noteworthy_contributions  TEXT,
    career_plan_5yr           TEXT,
    important_personal_dev    TEXT,
    important_professional_dev TEXT,
    role_model                TEXT,

    -- General / references
    prev_interviewed_org      BOOLEAN DEFAULT FALSE,
    prev_interview_details    JSONB DEFAULT '{}'::jsonb,
    org_relatives             JSONB DEFAULT '[]'::jsonb,
    part_time_business        BOOLEAN DEFAULT FALSE,
    part_time_business_details TEXT,
    court_proceedings         BOOLEAN DEFAULT FALSE,
    court_proceedings_details TEXT,
    employer_bond             BOOLEAN DEFAULT FALSE,
    employer_bond_details     TEXT,
    notice_period             TEXT,
    earliest_joining          DATE,
    functional_pref           JSONB DEFAULT '[]'::jsonb,
    locational_pref           JSONB DEFAULT '[]'::jsonb,
    references_list           JSONB DEFAULT '[]'::jsonb,
    declaration_agreed        BOOLEAN DEFAULT FALSE,
    declaration_place         TEXT,
    declaration_date          DATE,

    created_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PART 1: SCHEMA ADDITIONS (append-only)
-- ============================================================

-- Token table for magic link auth
CREATE TABLE IF NOT EXISTS bts_form_tokens (
    id           SERIAL PRIMARY KEY,
    token        UUID DEFAULT gen_random_uuid() NOT NULL,
    email        TEXT NOT NULL,
    org          TEXT NOT NULL CHECK (org IN ('BTS', 'IILM')),
    position     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    opened_at    TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    application_id INTEGER REFERENCES bts_applications(id),
    status       TEXT DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'opened', 'submitted', 'expired'))
);

-- Guarantee one active token per email+org at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_active_email_org
    ON bts_form_tokens (email, org)
    WHERE status NOT IN ('submitted', 'expired');

CREATE INDEX IF NOT EXISTS idx_tokens_token ON bts_form_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON bts_form_tokens(status);

-- Add photo column to applications table
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS photo_base64 TEXT,
    ADD COLUMN IF NOT EXISTS org TEXT CHECK (org IN ('BTS', 'IILM'));


-- ============================================================
-- PART 3: ADMIN DASHBOARD ADDITIONS (bts_f2f_info database)
-- ============================================================

-- Application lifecycle status, updated by HR from the admin dashboard.
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'under_review', 'interviewed',
                          'did_not_turn_up', 'rejected', 'active_file', 'appointed'));

-- Migration for existing DBs: widen the status CHECK to allow 'did_not_turn_up'.
-- (ADD COLUMN IF NOT EXISTS above is a no-op once the column exists, so the
-- constraint must be replaced explicitly.)
ALTER TABLE bts_applications DROP CONSTRAINT IF EXISTS bts_applications_status_check;
ALTER TABLE bts_applications
    ADD CONSTRAINT bts_applications_status_check
    CHECK (status IN ('submitted', 'under_review', 'interviewed',
                      'did_not_turn_up', 'rejected', 'active_file', 'appointed'));

CREATE INDEX IF NOT EXISTS idx_applications_status  ON bts_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_org     ON bts_applications(org);
CREATE INDEX IF NOT EXISTS idx_applications_created ON bts_applications(created_at);

-- Salary / CTC fields. Intentionally removed from the candidate form;
-- filled by the HR interviewer during the face-to-face interview.
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS current_salary    TEXT,
    ADD COLUMN IF NOT EXISTS expected_salary   TEXT,
    ADD COLUMN IF NOT EXISTS ctc_offered       TEXT,
    ADD COLUMN IF NOT EXISTS salary_notes      TEXT,
    ADD COLUMN IF NOT EXISTS salary_updated_at TIMESTAMPTZ;

-- Interview / appointment fields (office use). Set by HR in the admin panel;
-- these surface on the dedicated "Interviewer Notes" page and printout.
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS date_of_interview   DATE,
    ADD COLUMN IF NOT EXISTS date_of_joining     DATE,
    ADD COLUMN IF NOT EXISTS designation_offered TEXT,
    ADD COLUMN IF NOT EXISTS employment_type     TEXT,
    ADD COLUMN IF NOT EXISTS interviewed_by      TEXT,
    ADD COLUMN IF NOT EXISTS interview_mode      TEXT,
    ADD COLUMN IF NOT EXISTS interviewer_notes   TEXT,
    -- Multi-round interviewer notes. Each element:
    -- { round, interviewed_by, interviewed_on, interview_mode, employment_type,
    --   designation_offered, date_of_joining, notes }
    ADD COLUMN IF NOT EXISTS interview_rounds    JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- PART 5: CAMPUS ISOLATION (BTS branches)
-- Each candidate + token is tagged with a campus; the admin backend
-- filters every query by the logged-in user's campus (super-admin = all).
-- ============================================================
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS campus TEXT CHECK (campus IN ('Delhi', 'Jaipur', 'Chandigarh'));
ALTER TABLE bts_form_tokens
    ADD COLUMN IF NOT EXISTS campus TEXT CHECK (campus IN ('Delhi', 'Jaipur', 'Chandigarh'));

CREATE INDEX IF NOT EXISTS idx_applications_campus ON bts_applications(campus);
CREATE INDEX IF NOT EXISTS idx_tokens_campus       ON bts_form_tokens(campus);

-- The "one active invite per person" guard must be campus-aware, so the same
-- email can hold active invites at different campuses without colliding.
DROP INDEX IF EXISTS idx_tokens_active_email_org;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_active_email_org_campus
    ON bts_form_tokens (email, org, campus)
    WHERE status NOT IN ('submitted', 'expired');

-- ============================================================
-- PART 6: INTERVIEW NOTES — one row per interviewer per candidate
--
-- Replaces the single bts_applications.interview_rounds JSONB array, which
-- could not support a panel: the whole array was rewritten on every save, so
-- three interviewers saving at once meant the last write erased the others.
-- Each panelist now owns their own row.
--
-- The legacy interview_rounds column is intentionally LEFT IN PLACE as a
-- read-only backup of the pre-migration data.
-- ============================================================
CREATE TABLE IF NOT EXISTS bts_interview_notes (
    id                  SERIAL PRIMARY KEY,
    application_id      INTEGER NOT NULL REFERENCES bts_applications(id) ON DELETE CASCADE,
    campus              TEXT,
    round_no            INTEGER,
    interviewed_by      TEXT NOT NULL,
    interviewed_on      DATE,
    interview_mode      TEXT,           -- Physical | Online
    employment_type     TEXT,           -- Full Time | Part Time
    designation_offered TEXT,
    date_of_joining     DATE,
    notes               TEXT,
    -- The interviewer's OWN observed/recommended figure. HR's confidential
    -- salary block (bts_applications.current_salary etc.) is never shown to
    -- interviewers — the backend strips it based on the X-Role header.
    recommended_salary  TEXT,
    source              TEXT DEFAULT 'interviewer',   -- migrated | interviewer | hr | admin
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_application ON bts_interview_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_notes_campus      ON bts_interview_notes(campus);
CREATE INDEX IF NOT EXISTS idx_notes_by          ON bts_interview_notes(application_id, lower(interviewed_by));

-- One-time migration of the legacy JSONB rounds into the new table.
-- Safe to re-run: it only fires when the table is still empty.
INSERT INTO bts_interview_notes
  (application_id, campus, round_no, interviewed_by, interviewed_on, interview_mode,
   employment_type, designation_offered, date_of_joining, notes, source, created_at)
SELECT a.id, a.campus,
       NULLIF(e->>'round','')::int,
       trim(e->>'interviewed_by'),
       NULLIF(e->>'interviewed_on','')::date,
       NULLIF(e->>'interview_mode',''),
       NULLIF(e->>'employment_type',''),
       NULLIF(e->>'designation_offered',''),
       NULLIF(e->>'date_of_joining','')::date,
       e->>'notes',
       'migrated',
       COALESCE(a.created_at, NOW())
FROM bts_applications a,
     jsonb_array_elements(COALESCE(a.interview_rounds,'[]'::jsonb)) e
WHERE COALESCE(trim(e->>'interviewed_by'),'') <> ''
  AND NOT EXISTS (SELECT 1 FROM bts_interview_notes);

-- ============================================================
-- PART 7: REPEAT-CANDIDATE DETECTION
--
-- When HR invites a candidate we look up the email against every prior
-- invite and application. Deliberately NO lookup/cache table: that would
-- be a second copy of data we already hold and would drift the first time
-- a row changed outside the invite path. Two functional indexes give the
-- same speed with no sync risk.
--
-- Email is already normalised to lower-case at the API boundary
-- (backend/main.py), so lower() here matches what is actually stored.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_applications_email_lower ON bts_applications (lower(email));
CREATE INDEX IF NOT EXISTS idx_tokens_email_lower       ON bts_form_tokens  (lower(email));

-- Audit trail for the override. When HR is warned that a candidate has
-- applied before and chooses "Send anyway", the resulting token records
-- that the warning was shown and acknowledged, and which prior
-- application triggered it. NULL duplicate_of = no prior application row
-- (the match was against an earlier invite that was never completed).
ALTER TABLE bts_form_tokens
    ADD COLUMN IF NOT EXISTS duplicate_ack BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS duplicate_of  INTEGER REFERENCES bts_applications(id);
