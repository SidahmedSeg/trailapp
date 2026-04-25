# Trail des Mouflons d'Or 2026 — Project Context

## Overview
Registration platform for a trail running event in Algeria. Single backend API + single frontend app with public registration flow and admin dashboard. **App is LIVE in production** at https://tmo.lassm.dz

## Tech Stack
- **Backend:** Fastify (Node.js) on port **8820**
- **Frontend:** React + Vite + Tailwind CSS v4 on port **3820**
- **Database:** PostgreSQL on port **8833** (Docker), connection pool: 100
- **Cache:** Redis on port **8823** (Docker)
- **ORM:** Prisma 5
- **Payment:** SATIM (CIB / Edahabia) — **LIVE** on epg.satim.dz
- **Email:** SendGrid (from: noreply@lassm.dz, name: LASSM)
- **Captcha:** reCAPTCHA v2
- **PDF:** PDFKit (modern ticket design)
- **QR Code:** qrcode (backend) + qrcode.react (frontend) + html5-qrcode (camera scanner)
- **Charts:** Recharts (8 dashboard charts)
- **Icons:** Lucide React (no emojis)
- **Dropdowns:** react-select (no native `<select>`)
- **Flags:** flagcdn.com images (no emoji flags)
- **Language:** French (default), English, Arabic (RTL) — react-i18next
- **Auth:** JWT + Email OTP (2-factor for admin login)

## Production
- **URL:** https://tmo.lassm.dz
- **Server:** 129.45.84.205 (16 cores, 32GB RAM)
- **SSL:** Let's Encrypt (auto-renews)
- **CI/CD:** GitHub Actions → HTTP webhook (no SSH needed)
- **Process Manager:** PM2 (trail-api + deploy-webhook)
- **Reverse Proxy:** Nginx
- **Repo:** https://github.com/SidahmedSeg/trailapp

## Ports
| Service | Port |
|---------|------|
| Frontend (Vite) | 3820 |
| Backend (Fastify) | 8820 |
| PostgreSQL | 8833 |
| Redis | 8823 |

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
│   ├── .env                        # All secrets (gitignored)
│   ├── prisma/
│   │   ├── schema.prisma           # 7 models
│   │   ├── seed.js                 # Idempotent seed
│   │   └── migrations/
│   └── src/
│       ├── server.js               # Entry point + health check + route registration
│       ├── config/                 # env.js, database.js, redis.js
│       ├── routes/
│       │   ├── registration.js     # POST /api/register, GET /api/check-email, GET /api/registration/:id, GET /api/registration/:id/pdf, GET /api/settings/public
│       │   ├── payment.js          # POST /api/payment/initiate, GET /api/payment/callback + cleanup job
│       │   ├── auth.js             # POST /api/admin/login (OTP), /verify-otp, /refresh, /logout, user CRUD, PUT /settings/security
│       │   ├── admin.js            # GET/POST/PUT /api/admin/runners, export/csv, stats, stats/charts
│       │   ├── settings.js         # GET/PUT /api/admin/settings, GET /api/admin/settings/bib-stats
│       │   ├── scanner.js          # GET /api/scan/:qrToken, POST distribute, GET manual/:bibNumber, GET session/history
│       │   ├── activity.js         # GET /api/admin/activity
│       │   └── emails.js           # POST /api/registration/:id/send-pdf
│       ├── services/
│       │   ├── satim.js            # SATIM registerPayment + confirmOrder + getOrderStatus + refundPayment
│       │   ├── sendgrid.js         # sendConfirmationEmail + sendInvitationEmail + sendOtpEmail
│       │   ├── bib.js              # getNextBib (Redis INCR) + validateManualBib
│       │   ├── pdf.js              # generateTicketPDF (modern design)
│       │   ├── qrcode.js           # generateQRDataURL + generateQRBuffer
│       │   ├── csv.js              # generateCSV
│       │   └── monitoring.js       # Payment failure rate + infra checks
│       ├── middleware/
│       │   ├── auth.js             # authenticate + authorize(roles)
│       │   ├── registrationGuard.js # Check open + capacity + bib stock
│       │   └── activityLogger.js   # logActivity helper
│       ├── schemas/
│       │   └── registration.js     # validateRegistration + buildE164 (levels: Débutant, Confirmé, Elite)
│       └── utils/
│           ├── jwt.js              # signAccessToken + signRefreshToken + verifyToken
│           └── errors.js           # AppError + errorHandler
│
└── frontend/
    ├── .env                        # VITE_RECAPTCHA_SITE_KEY
    ├── index.html                  # Favicon
    ├── vite.config.js              # Proxy /api → localhost:8820
    ├── public/                     # Logo SVGs, favicon, CIB logo, social icons
    └── src/
        ├── main.jsx
        ├── App.jsx                 # Router + code splitting + AdminRoute guard + ScrollToTop
        ├── index.css               # Tailwind import
        ├── i18n/                   # i18next config + FR/EN/AR translations
        ├── data/
        │   └── formData.js         # Countries (185), phone codes, wilayas (58), communes (1598), select styles
        ├── lib/
        │   ├── api.js              # Fetch wrapper with auto-refresh on 401 (skips auth endpoints)
        │   └── auth.js             # Token management (localStorage key: "access_token")
        ├── hooks/
        │   ├── useAuth.jsx         # AuthProvider + loginRequest + verifyOtp + logout
        │   └── useRegistration.jsx # Form state management
        ├── components/
        │   └── ui/
        │       ├── Header.jsx      # Logo + nav + red banner + LanguageSwitcher
        │       ├── Footer.jsx      # Red footer + social links (FB, Insta, web)
        │       ├── PublicLayout.jsx # Header + children + Footer
        │       ├── Sidebar.jsx     # Responsive sidebar (hamburger on mobile) + event switcher
        │       └── LanguageSwitcher.jsx # FR/EN/AR dropdown
        └── pages/
            ├── public/
            │   ├── Register.jsx    # Full form (UPPERCASE, Latin-only, 185 countries, 1598 communes, react-select)
            │   ├── Recap.jsx       # Summary + CIB card + payment notice + reCAPTCHA
            │   ├── Processing.jsx  # Payment waiting screen
            │   ├── Success.jsx     # Bib card + QR + participant info + transaction details
            │   ├── Failed.jsx      # SATIM error reason + retry + contact support
            │   ├── SetPassword.jsx # Admin invitation accept
            │   ├── FAQ.jsx         # Accordion FAQ
            │   ├── PrivacyPolicy.jsx
            │   ├── Terms.jsx
            │   └── LegalNotice.jsx
            └── admin/
                ├── Login.jsx       # 2-step: credentials → OTP (6 digits)
                ├── Dashboard.jsx   # Stats cards + 8 Recharts graphs
                ├── Runners.jsx     # Runner table + filters + sort + create modal + edit + CSV export
                ├── ScannerView.jsx # QR camera scanner + manual bib + distribute + history
                ├── Bibs.jsx        # Bib range config + auto/manual range stats
                ├── Settings.jsx    # 2 tabs (Inscriptions, Mon compte)
                ├── Activity.jsx    # Activity log with action filter
                └── UserManagement.jsx # Invite/manage admin users
```

## Database Models (Prisma)
1. **Registration** — Runner registration (personal info, phone E.164, bib, QR token, payment, status, OTP fields)
2. **AdminUser** — Admin/scanner users (JWT auth, invite flow, OTP: otpCode, otpExpiresAt, otpAttempts)
3. **ScannerSession** — Bib distribution log per operator
4. **Settings** — Singleton (id="default"), registration control + bib config
5. **EmailLog** — Sent email tracking
6. **EmailTemplate** — 2 templates: "confirmation" + "invitation"
7. **ActivityLog** — Admin action audit trail (details field is `Json` / JSONB)

## Auth System
- **2-Factor:** JWT + Email OTP
- POST /admin/login → validates credentials → sends 6-digit OTP to admin email
- POST /admin/verify-otp → validates OTP → issues JWT tokens
- OTP: 6 digits, 5 min expiry, max 3 attempts, rate limited (1/min)
- JWT access token (15 min) + refresh token (7 days)
- Refresh tokens stored in Redis whitelist (`refresh:{userId}:{tokenId}`)
- 3 roles: `super_admin`, `admin`, `scanner`
- Frontend: `access_token` / `refresh_token` in localStorage
- Auth endpoints skip token refresh (login, verify-otp, set-password)

## Bib Attribution
- Sequential via Redis `INCR bib:next` (atomic, no race condition)
- **Bib assigned ONLY on payment success** (not at initiation — prevents gaps)
- Redis key initialized to `bibStart - 1` (INCR gives bibStart)
- Auto range: configurable bibStart→bibEnd (syncs Redis when changed in admin)
- Manual (admin/VIP): must be OUTSIDE auto range
- Bib range locks (`bibRangeLocked=true`) after first successful payment
- Runner levels: Débutant, Confirmé, Elite

## Payment Flow
1. POST /api/register → creates registration (no bib, paymentStatus="pending")
2. POST /api/payment/initiate → call SATIM, return redirect URL (no bib yet)
3. GET /api/payment/callback → confirmOrder + getOrderStatus (server-to-server), assign bib + QR, send email
4. Cleanup job: marks stale "processing" as "failed" after 30 min
5. Email uniqueness: only blocks success/manual/processing — failed/pending records deleted on re-registration

## SATIM Integration
- **Production URL:** https://epg.satim.dz/payment/rest
- **Endpoints:** /register.do, /public/acknowledgeTransaction.do, /getOrderStatus.do, /refund.do
- **Request format:** application/x-www-form-urlencoded (not JSON)
- **Response fields:** PascalCase (OrderStatus, ErrorCode — handled with ?? fallback)
- **Credentials:** lassm9XoUvZx6j / pfwCJEyOoUCRewIs / E001000198

## Frontend Conventions
- **Brand color:** `#C42826` (primary), `#a82220` (hover), `#F2B800` (yellow shapes)
- **No indigo** — all buttons, focus rings, checkboxes use `#C42826`
- **No emojis** — use Lucide React icons everywhere
- **No native `<select>`** — use react-select with custom styles
- **Flags** — use `https://flagcdn.com/w40/{code}.png` images
- **Admin theme** — light/white Frappe-inspired (not dark)
- **Admin responsive** — hamburger sidebar on mobile, lg:ml-60 breakpoint
- **Text inputs** — auto UPPERCASE, Latin only (rejects Arabic)
- **Shared data** — formData.js (countries, phone codes, wilayas, communes, select styles)
- **Public pages** — wrapped in `PublicLayout` (Header + Footer)
- **Phone selectors** — light gray bg, flag + code only, searchable

## Credentials & Keys
- **Default admin:** `superadmin` / `admin123` (OTP sent to configured email)
- **SendGrid:** API key in backend .env, from: `noreply@lassm.dz`, name: `LASSM`
- **reCAPTCHA v2:**
  - Site key: `6LfGf38sAAAAABuBfyIXAxvsoNjVzU8EOmRfQ4rw`
  - Secret key: `6LfGf38sAAAAAE5ycYDfd3eb0hNOHH9umxdAN2aQ`

## CI/CD Workflow
- **Always** create branch → PR → merge (never push to main directly)
- Quick fixes: ask user first if direct push is OK
- Deploy method: HTTP webhook (POST https://tmo.lassm.dz/deploy with secret token)
- GitHub Actions sends webhook → server pulls, installs, builds, restarts PM2
- No SSH needed from GitHub (port 22 restricted for security)

## How to Run (Local)
```bash
docker compose up -d          # PostgreSQL + Redis
cd backend && npm run db:seed && npm run dev   # http://localhost:8820
cd frontend && npm run dev    # http://localhost:3820
```

## Key Decisions & Patterns
- **Bib on success only** — no gaps from failed payments
- **No DECR on failure** — atomic INCR, accept gaps only if callback fails
- **SATIM callback params informational only** — always verify server-to-server
- **Idempotency TTL = 24h** for late SATIM retries
- **Single React app** with code splitting
- **QR token = crypto.randomUUID()** stored in DB
- **bibStart syncs Redis** when admin changes it in settings
- **Email uniqueness per payment status** — failed registrations don't block re-registration
- **VIP manual creation** triggers confirmation email with PDF

## Planned: Multi-Event Support
Plan ready at `.claude/plans/jolly-spinning-charm.md`. Key approach:
- Event model replaces Settings (each event = its own config)
- eventId FK on Registration only (ScannerSession/ActivityLog link through Registration)
- One event active at a time, full history for past events
- Pricing per event, bib range per event
