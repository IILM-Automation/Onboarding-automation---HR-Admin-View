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
                          'rejected', 'active_file', 'appointed'));

CREATE INDEX IF NOT EXISTS idx_applications_status ON bts_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_org    ON bts_applications(org);

-- Salary / CTC fields. Intentionally removed from the candidate form;
-- filled by the HR interviewer during the face-to-face interview.
ALTER TABLE bts_applications
    ADD COLUMN IF NOT EXISTS current_salary    TEXT,
    ADD COLUMN IF NOT EXISTS expected_salary   TEXT,
    ADD COLUMN IF NOT EXISTS ctc_offered       TEXT,
    ADD COLUMN IF NOT EXISTS salary_notes      TEXT,
    ADD COLUMN IF NOT EXISTS salary_updated_at TIMESTAMPTZ;
