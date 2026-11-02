"""Import historical recruitment records into bts_prior_candidates.

Reads a JSON array produced by the PDF/CSV extractor and upserts it. Safe to
re-run: the unique index on (lower(email), source) means a later pass over a
better export updates rows in place instead of duplicating them.

Usage:
    python import_prior_candidates.py <records.json> [--campus Delhi] [--dry-run]

Every record must already carry a VALID email; this script validates again and
refuses the whole batch if anything is malformed, rather than importing a
partly-bad set. A wrong address is worse than a missing one: it can never match
the real candidate while still looking like coverage.
"""
import argparse
import json
import os
import re
import sys

import psycopg2
import psycopg2.extras

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
except ImportError:
    pass

SANE_RE = re.compile(r"^[a-z0-9][a-z0-9._%+\-]{1,63}@[a-z0-9][a-z0-9.\-]{1,62}\.[a-z]{2,6}$")

UPSERT = """
INSERT INTO bts_prior_candidates
    (email, name, position_applied, contact, campus, interviewed_on,
     source, source_row, notes)
VALUES (%(email)s, %(name)s, %(position_applied)s, %(contact)s, %(campus)s,
        %(interviewed_on)s, %(source)s, %(source_row)s, %(notes)s)
ON CONFLICT (lower(email), source) DO UPDATE SET
    name             = COALESCE(EXCLUDED.name, bts_prior_candidates.name),
    position_applied = COALESCE(EXCLUDED.position_applied, bts_prior_candidates.position_applied),
    contact          = COALESCE(EXCLUDED.contact, bts_prior_candidates.contact),
    campus           = COALESCE(EXCLUDED.campus, bts_prior_candidates.campus),
    interviewed_on   = COALESCE(EXCLUDED.interviewed_on, bts_prior_candidates.interviewed_on),
    source_row       = COALESCE(EXCLUDED.source_row, bts_prior_candidates.source_row),
    notes            = COALESCE(EXCLUDED.notes, bts_prior_candidates.notes)
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("records", help="JSON array of records to import")
    ap.add_argument("--campus", default="Delhi", help="campus to attribute rows to")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.records, encoding="utf-8") as fh:
        rows = json.load(fh)

    bad = [r for r in rows if not SANE_RE.match((r.get("email") or "").lower())]
    if bad:
        print(f"REFUSING: {len(bad)} record(s) have a malformed email. Nothing imported.")
        for r in bad[:10]:
            print("   ", repr(r.get("email")))
        return 1

    for r in rows:
        r["email"] = r["email"].lower()
        r.setdefault("campus", None)
        r["campus"] = r.get("campus") or args.campus
        for k in ("name", "position_applied", "contact", "interviewed_on",
                  "source_row", "notes"):
            r.setdefault(k, None)

    print(f"{len(rows)} record(s) validated; campus = {args.campus}")
    if args.dry_run:
        print("dry run - nothing written")
        return 0

    conn = psycopg2.connect(os.environ["BTS_DB_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM bts_prior_candidates")
            before = cur.fetchone()[0]
            psycopg2.extras.execute_batch(cur, UPSERT, rows, page_size=100)
            cur.execute("SELECT COUNT(*) FROM bts_prior_candidates")
            after = cur.fetchone()[0]
        conn.commit()
        print(f"rows before={before}  after={after}  inserted={after - before}  "
              f"updated={len(rows) - (after - before)}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
