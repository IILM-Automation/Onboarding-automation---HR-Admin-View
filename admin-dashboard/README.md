# BTS / IILM — HR Admin Dashboard (Next.js)

A read + light-edit admin interface the HR interviewer uses during and
after face-to-face interviews to browse applications, view full detail,
fill in salary / CTC, and update application status.

Built with **Next.js (App Router) + TypeScript**.

## Architecture

The browser never sees the backend URL or API key. All calls go to this
app's own `/api/*` route handlers (same-origin, cookie-authenticated),
which proxy to the FastAPI backend and attach `X-API-Key` server-side.

```
Browser ──fetch──▶ /api/applications        (Next.js route handler)
                       │  verifies session cookie
                       │  adds X-API-Key from env
                       ▼
                   FastAPI backend  (BTS_API_BASE)
```

- **Login** verifies the password server-side and sets an httpOnly,
  HMAC-signed session cookie. The password is never exposed to the client.
- **Proxy routes** (`/api/applications`, `/api/applications/[id]`,
  `…/status`, `…/salary`) require the session cookie and forward to the
  backend.

## Configuration

Everything is environment-driven (nothing hardcoded except the admin
password fallback). Copy `.env.example` to `.env.local`:

| Variable        | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `BTS_API_BASE`  | FastAPI backend base URL (e.g. `https://apps.iilm.edu/bts-api`) |
| `BTS_API_KEY`   | Shared secret → backend `X-API-Key` (server-side only)   |
| `ADMIN_PASSWORD`| Admin login password (falls back to `bts_admin_2024`)    |
| `SESSION_SECRET`| Secret used to sign the session cookie                   |

## Develop / run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

Deploys to Vercel as-is (Node.js runtime route handlers).
