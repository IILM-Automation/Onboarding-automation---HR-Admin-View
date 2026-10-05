# n8n change for the repeat-candidate audit trail

**Status: OPTIONAL follow-up.** The repeat-candidate warning is fully working
without this. This change only persists *who overrode a warning*, so the
override can be audited later.

## What the backend now sends

`POST /invites` already forwarded `{email, org, position, campus}` to the
`HR-Candidate Invite` webhook. It now sends two extra fields:

```json
{
  "email": "candidate@example.com",
  "org": "BTS",
  "position": "",
  "campus": "Delhi",
  "duplicate_ack": true,
  "duplicate_of": 26
}
```

* `duplicate_ack` — `true` only when HR was shown the repeat-candidate warning
  and chose **Send anyway**. `false` for a normal first-time invite.
* `duplicate_of` — id of the candidate's most recent prior application, or
  `null` when the only prior records were invites that were never completed.

`duplicate_of` is resolved **by the backend**, never taken from the browser:
the prior application may have been redacted from that HR user because it
belongs to another campus, and an audit value the caller can set is not an
audit trail.

Both fields are ignored until the workflow is updated — the columns simply
stay at their defaults (`FALSE` / `NULL`). Nothing breaks in the meantime.

## The change

The columns already exist (schema PART 7):

```sql
ALTER TABLE bts_form_tokens
    ADD COLUMN IF NOT EXISTS duplicate_ack BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS duplicate_of  INTEGER REFERENCES bts_applications(id);
```

In the **Insert Token** node of `HR-Candidate Invite`, add the two columns to
the INSERT's column list and append two values to `queryReplacement`, keeping
the existing order exactly:

```sql
INSERT INTO bts_form_tokens
    (token, email, org, position, campus, expires_at, status,
     duplicate_ack, duplicate_of)
VALUES
    (gen_random_uuid(), $1, $2, $3, $4, NOW() + INTERVAL '24 hours', 'sent',
     $5, $6)
RETURNING token;
```

`queryReplacement` gains `$5` and `$6`:

```
{{ $json.duplicate_ack }}, {{ $json.duplicate_of }}
```

### Watch for the two traps this workflow has hit before

1. **The leading `=` marker.** n8n stores an expression field with a leading
   `=` that it hides in the editor. Pasting a value that already starts with
   `=` produces `==...`, which fails at runtime with a confusing error. Type
   into the field; do not paste a leading `=`.
2. **No `=` inside the SQL.** Write `$5`, not `duplicate_ack = $5`, in the
   VALUES list — a stray `=` is parsed as a comparison and Postgres rejects
   it with *"column is of type boolean but expression is of type ..."*.

## Verifying

After publishing the workflow, override one warning, then:

```sql
SELECT email, campus, duplicate_ack, duplicate_of, created_at
FROM bts_form_tokens
WHERE duplicate_ack
ORDER BY created_at DESC
LIMIT 5;
```
