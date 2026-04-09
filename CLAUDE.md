# Trail des Mouflons d'Or 2026 — Project Context

## Overview
Registration platform for a trail running event in Algeria. Single backend API + single frontend app with public registration flow and admin dashboard.

## Tech Stack
- **Backend:** Fastify (Node.js) on port **8820**
- **Frontend:** React + Vite + Tailwind CSS v4 on port **3820**
- **Database:** PostgreSQL on port **8833** (Docker)
- **Cache:** Redis on port **8823** (Docker)
- **ORM:** Prisma 5
- **Payment:** SATIM (CIB / Edahabia) — integration scaffolded, not connected to real SATIM yet
- **Email:** SendGrid
- **Captcha:** reCAPTCHA v2
- **PDF:** PDFKit
- **QR Code:** qrcode (backend) + qrcode.react (frontend)
- **Icons:** Lucide React (no emojis)
- **Dropdowns:** react-select (no native `<select>`)
- **Flags:** flagcdn.com images (no emoji flags)
- **Language:** French only (entire app)

## Ports
| Service | Port |
|---------|------|
| Frontend (Vite) | 3820 |
| Backend (Fastify) | 8820 |
| PostgreSQL | 8833 |
| Redis | 8823 |
| Reserved (unused) | 8865, 3821 |

## Project Structure
```
YOU_APP/
├── docker-compose.yml              # PostgreSQL + Redis
├── nginx/nginx.conf                # Reverse proxy (production)
├── scripts/
│   ├── backup.sh                   # pg_dump daily backup
│   └── restore.sh                  # Database restore
├── logo/                           # SVG assets (copied to frontend/public/)
│
├── backend/
│   ├── .env                        # All secrets
│   ├── prisma/
│   │   ├── schema.prisma           # 7 models
│   │   ├── seed.js                 # Idempotent seed
│   │   └── migrations/
│   └── src/
│       ├── server.js               # Entry point + health check + route registration
│       ├── config/
│       │   ├── env.js              # Environment variables
│       │   ├── database.js         # Prisma client
│       │   └── redis.js            # ioredis client
│       ├── routes/
│       │   ├── registration.js     # POST /api/register, GET /api/check-email, GET /api/registration/:id, GET /api/registration/:id/pdf, GET /api/settings/public
│       │   ├── payment.js          # POST /api/payment/initiate, GET /api/payment/callback + cleanup job
│       │   ├── auth.js             # POST /api/admin/login, /refresh, /logout, /logout-all, user CRUD (invite, set-password, reinvite)
│       │   ├── admin.js            # GET/POST/PUT /api/admin/runners, GET /api/admin/runners/export/csv, GET /api/admin/stats
│       │   ├── settings.js         # GET/PUT /api/admin/settings, GET /api/admin/settings/bib-stats
│       │   ├── scanner.js          # GET /api/scan/:qrToken, POST /api/scan/:qrToken/distribute, GET /api/scan/manual/:bibNumber, GET /api/scan/session/history
│       │   ├── activity.js         # GET /api/admin/activity
│       │   └── emails.js           # POST /api/registration/:id/send-pdf
│       ├── services/
│       │   ├── satim.js            # SATIM registerPayment + getOrderStatus
│       │   ├── sendgrid.js         # sendConfirmationEmail + sendInvitationEmail
│       │   ├── bib.js              # getNextBib (Redis INCR) + validateManualBib
│       │   ├── pdf.js              # generateTicketPDF
│       │   ├── qrcode.js           # generateQRDataURL + generateQRBuffer
│       │   ├── csv.js              # generateCSV
│       │   └── monitoring.js       # Payment failure rate + infra checks
│       ├── middleware/
│       │   ├── auth.js             # authenticate + authorize(roles)
│       │   ├── registrationGuard.js # Check open + capacity + bib stock
│       │   └── activityLogger.js   # logActivity helper
│       ├── schemas/
│       │   └── registration.js     # validateRegistration + buildE164
│       └── utils/
│           ├── jwt.js              # signAccessToken + signRefreshToken + verifyToken
│           └── errors.js           # AppError + errorHandler
│
└── frontend/
    ├── .env                        # VITE_RECAPTCHA_SITE_KEY
    ├── index.html
    ├── vite.config.js              # Proxy /api → localhost:8820
    ├── public/                     # Logo SVGs, flag icons
    └── src/
        ├── main.jsx
        ├── App.jsx                 # Router + code splitting + AdminRoute guard
        ├── index.css               # Tailwind import
        ├── lib/
        │   ├── api.js              # Fetch wrapper with auto-refresh on 401
        │   └── auth.js             # Token management (localStorage key: "access_token")
        ├── hooks/
        │   ├── useAuth.jsx         # AuthProvider + useAuth context
        │   └── useRegistration.jsx # Form state management
        ├── components/
        │   └── ui/
        │       ├── Header.jsx      # Logo + nav + red banner with title + yellow shapes
        │       ├── Footer.jsx      # Red footer with white logo + social icons + legal links
        │       ├── PublicLayout.jsx # Header + children + Footer wrapper
        │       └── Sidebar.jsx     # Admin sidebar with Lucide icons + active route detection
        └── pages/
            ├── public/
            │   ├── Register.jsx    # Full registration form (react-select, flag images, validations)
            │   ├── Recap.jsx       # Summary + payment + reCAPTCHA v2
            │   ├── Processing.jsx  # Payment waiting screen
            │   ├── Success.jsx     # Bib number + QR + PDF download
            │   ├── Failed.jsx      # Retry payment
            │   └── SetPassword.jsx # Admin invitation accept
            └── admin/
                ├── Login.jsx       # Admin/scanner login
                ├── Dashboard.jsx   # Stats + runner table + detail panel
                ├── ScannerView.jsx # Manual bib lookup + distribute
                ├── Settings.jsx    # 3 tabs (General, Dossards, Sécurité)
                ├── Activity.jsx    # Activity log
                └── UserManagement.jsx # Invite/manage admin users
```

## Database Models (Prisma)
1. **Registration** — Runner registration (personal info, phone E.164, bib, QR token, payment, status)
2. **AdminUser** — Admin/scanner users (JWT auth, invite flow with token + expiry)
3. **ScannerSession** — Bib distribution log per operator
4. **Settings** — Singleton (id="default"), UPSERT pattern, bibRangeLocked after first payment
5. **EmailLog** — Sent email tracking
6. **EmailTemplate** — 2 templates: "confirmation" + "invitation"
7. **ActivityLog** — Admin action audit trail (details field is `Json` / JSONB)

## Auth System
- JWT access token (15 min) + refresh token (7 days)
- Refresh tokens stored in Redis whitelist (`refresh:{userId}:{tokenId}`)
- Rotation on refresh (old token deleted, new one issued)
- On user deactivation: all tokens revoked
- 3 roles: `super_admin`, `admin`, `scanner`
- Frontend stores tokens in localStorage under keys `access_token` and `refresh_token`
- AdminRoute in App.jsx checks `localStorage.getItem('access_token')`

## Bib Attribution
- Sequential via Redis `INCR bib:next` (atomic, no race condition)
- Auto range: configurable bibStart→bibEnd (default 101→1500)
- Manual (admin): must be OUTSIDE auto range
- Bib range locks (`bibRangeLocked=true`) after first successful payment
- NO DECR on payment failure — gaps are accepted
- Bib assigned during payment flow (not at registration time)

## Payment Flow
1. POST /api/register → creates registration (no bib yet, paymentStatus="pending")
2. POST /api/payment/initiate → INCR bib, reserve in Redis (15min TTL), call SATIM, return redirect URL
3. GET /api/payment/callback → verify with SATIM server-to-server (never trust query params), assign bib + QR token, send confirmation email
4. Cleanup job: marks stale "processing" as "failed" after 30 min
5. Retry: same registrationId, new bib number (old one = gap)
6. Idempotency: Redis SETNX with 24h TTL on orderId

## API Response Conventions
- All responses use **camelCase** field names
- List endpoints return `{ data: [...], total, page, pages }`
- Detail endpoints return `{ data: {...} }`
- Settings: `{ data: {...} }`
- Users list: `{ data: [...] }`
- Scanner history: `{ data: [...] }`
- Stats: flat object `{ totalInscrits, totalEnAttente, ... }`

## Frontend Conventions
- **Brand color:** `#C42826` (primary), `#a82220` (hover), `#F2B800` (yellow shapes)
- **No indigo** — all buttons, focus rings, checkboxes use `#C42826`
- **No emojis** — use Lucide React icons everywhere
- **No native `<select>`** — use react-select with custom styles
- **Flags** — use `https://flagcdn.com/w40/{code}.png` images
- **Admin sidebar** — shared `Sidebar.jsx` component (not duplicated per page)
- **Public pages** — wrapped in `PublicLayout` (Header + Footer)
- **Admin pages** — dark theme (slate-950), emerald-400/600 accents
- **Phone selectors** — light gray background (`#f9fafb`), show flag + code only (no country name), searchable by country name

## Credentials & Keys
- **Default admin:** `superadmin` / `admin123`
- **SendGrid:** API key in backend .env, from: `noreply@lassm.dz`, name: `LASSM`
- **reCAPTCHA v2:**
  - Site key (frontend): `6LfGf38sAAAAABuBfyIXAxvsoNjVzU8EOmRfQ4rw`
  - Secret key (backend): `6LfGf38sAAAAAE5ycYDfd3eb0hNOHH9umxdAN2aQ`

## How to Run
```bash
# Start DB + Redis
docker compose up -d

# Backend
cd backend
npm run db:seed    # idempotent
npm run dev        # http://localhost:8820

# Frontend
cd frontend
npm run dev        # http://localhost:3820
```

## Implementation Status
All 11 phases complete:
1. Foundation Backend (Fastify, Prisma, Redis, Settings seed)
2. Auth + User Management (JWT, refresh rotation, invite, set-password)
3. Registration + Bib Attribution (validation, email check, guard)
4. Admin Backend (CRUD runners, manual creation, CSV, settings, activity log)
5. QR + PDF + Scanner (QR gen, PDF ticket, scan/distribute, session history)
6. Email (SendGrid confirmation + invitation, send-pdf)
7. Payment Integration (SATIM initiate/callback, idempotency, cleanup job)
8. Frontend (React single app, public + admin, code splitting)
9. Infrastructure (Docker Compose, Nginx, idempotent seed)
10. Backup & Recovery (pg_dump scripts, Redis AOF+RDB)
11. Monitoring & Alerting (Pino logging, health check, payment failure rate)

## Known Issues / TODOs
- SATIM not connected to real API yet (returns 502, needs real merchant credentials)
- reCAPTCHA server-side verification not yet enforced (TODO comment in payment route)
- Rate limiting middleware exists but not wired to routes yet
- Some admin pages may have additional response shape mismatches (frontend expects different keys than backend returns) — fix as discovered
- Email templates use basic HTML — may need design improvement
- Commune list is partial (only major wilayas have communes listed)

## Key Decisions & Patterns
- **No DECR on payment failure** — race condition risk, gaps are cosmetically harmless
- **SATIM callback params are informational only** — always verify server-to-server
- **Idempotency TTL = 24h** (not 5 min) to handle late SATIM retries
- **Single React app** with code splitting (not 2 separate apps)
- **QR token = crypto.randomUUID()** stored in DB (not JWT — simpler, DB lookup anyway)
- **Settings singleton** via UPSERT pattern, bib range immutable after first payment
- **Seed is idempotent** — safe to run multiple times (upsert + SET NX)

## Implementation Plan
Full plan document: `/Users/intelifoxdz/YOU_APP/IMPLEMENTATION_PLAN v3.md`
