# CropFlow

**Tracks a crop from arrival to payment.**
Built for the IBM Bob 2.0 Hackathon (Sep 25–27, 2026).

CropFlow addresses the problem statement: *"Farmers often face long waiting
times, lack of information regarding procurement schedules, and uncertainty
about procurement status."* It gives a farmer one Farmer ID that follows
their crop through every stage — registration, slot booking, token &
live queue, gate entry, weighing, quality check, procurement approval, and
payment — with the same record reachable through the app, SMS, or an
assisted-access operator for farmers without a smartphone.

This repo builds on the architecture and planning already done for our
SIH26032 (KisanSetu) submission — same core domain, tightened scope and
rebranded for this hackathon's 48-hour window.

---

## 1. Project structure

```
cropflow/
├── database/
│   ├── schema.sql       # PostgreSQL tables, enums, indexes
│   └── seed.sql         # Demo centres & slots (reference data)
├── backend/              # Node.js + Express REST API
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/  (auth, error handling)
│   │   ├── routes/      (one file per resource)
│   │   ├── controllers/ (business logic)
│   │   └── utils/       (token generator, wait-time estimator, SMS, notify)
│   ├── scripts/
│   │   ├── migrate.js   # applies schema.sql + seed.sql
│   │   └── seed.js      # creates demo users/farmers/tokens with bcrypt hashes
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/              # React (Vite) + Tailwind
    ├── src/
    │   ├── api/client.js  # fetch wrapper, attaches JWT
    │   ├── context/AuthContext.jsx
    │   ├── components/    (Navbar, ProgressTracker, StatusBadge, ProtectedRoute)
    │   └── pages/         (one per screen)
    ├── package.json
    └── .env.example
```

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite + Tailwind CSS + React Router |
| Backend | Node.js + Express, JWT auth, bcrypt password hashing |
| Database | PostgreSQL 13+ |
| SMS | Provider-agnostic mock (`backend/src/utils/smsProvider.js`) — logs to console by default; swap in Twilio/MSG91/etc. for the real thing |
| Hosting (suggested) | Render/Railway for the API + Postgres, Vercel/Netlify for the frontend |

## 3. Local setup

### Prerequisites
- Node.js 18+
- PostgreSQL 13+ running locally (or a hosted instance — Neon/Supabase/Render all give a free Postgres in minutes if nobody wants to install it locally)

### Database
```bash
createdb cropflow
```

### Backend
```bash
cd backend
cp .env.example .env      # then fill in PGUSER/PGPASSWORD/JWT_SECRET etc.
npm install
npm run migrate           # creates tables + seeds centres/slots
npm run seed               # creates demo users, farmers, one full sample journey
npm run dev                 # starts on http://localhost:5000
```

Demo logins after seeding (password for all: `password123`):

| Username | Role |
| --- | --- |
| `admin` | admin |
| `officer1` | officer |
| `operator1` | operator |
| `ravi`, `lakshmi`, `muthu` | farmer |

### Frontend
```bash
cd frontend
cp .env.example .env       # points at the backend URL
npm install
npm run dev                 # starts on http://localhost:5173
```

Open http://localhost:5173 and log in with any demo account above.

---

## 4. Git workflow for the team

Since everyone's IBM Bob usage is limited, use Bob for the parts that
actually need judgment calls (debugging a specific error, deciding how to
wire a new feature into what's already here) rather than regenerating
boilerplate that's already in this repo.

1. **One shared repo, feature branches.**
   ```bash
   git clone <your-repo-url>
   cd cropflow
   git checkout -b feature/<short-name>     # e.g. feature/officer-dashboard-polish
   ```
2. **Small, frequent commits** with clear messages (`git commit -m "Add payment processing endpoint"`), not one giant end-of-hackathon commit.
3. **Pull before you push**, resolve conflicts locally:
   ```bash
   git pull origin main --rebase
   git push origin feature/<short-name>
   ```
4. **Open a PR into `main`** even solo — it gives you a diff to sanity-check before merging, and a clean history to show judges.
5. **Never commit `.env` files** — both `backend/.env` and `frontend/.env` are already covered by `.gitignore`. Commit only the `.env.example` files.
6. **Suggested split**, mirroring the roles in this codebase:
   - **Backend owner(s):** `backend/src/routes`, `backend/src/controllers`, DB migrations
   - **Frontend owner(s):** `frontend/src/pages`, `frontend/src/components`
   - **Integration/demo owner:** seed data, environment setup, deployment, demo script rehearsal
7. **Before the final submission**, agree on a merge freeze time (e.g. 2 hours before deadline) so the last hour is testing and the demo run-through, not a last-minute merge conflict.

## 5. API overview

All endpoints are prefixed with `/api`. Protected routes require
`Authorization: Bearer <token>` from `/auth/login`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/assisted-register` (operator/admin only) |
| Farmers | `GET /farmers/:id`, `GET /farmers/search?q=`, `PUT /farmers/:id` |
| Crops | `POST /crops`, `GET /crops/farmer/:id`, `PATCH /crops/:id/status` |
| Centres | `GET /centres`, `GET /centres/:id`, `GET /centres/workload` |
| Slots | `GET /slots/centre/:id`, `POST /slots/book` |
| Tokens | `POST /tokens`, `GET /tokens/:id`, `PATCH /tokens/:id/status` (officer/admin) |
| Queue | `GET /queue/centre/:centreId`, `GET /queue/token/:tokenId` |
| Procurement | `POST /procurement/weighing`, `POST /procurement/quality`, `POST /procurement/approve` (all officer/admin) |
| Payments | `GET /payments/farmer/:id`, `PATCH /payments/:id/process` (officer/admin) |
| Notifications | `GET /notifications/farmer/:id`, `POST /notifications` |
| Analytics | `GET /analytics/overview`, `GET /analytics/centres` (officer/admin) |

## 6. Demo script (aim for under 5 minutes)

1. **Farmer registers & adds a crop** — log in as `ravi`, show the dashboard, add a new crop under "My crops."
2. **Book a slot** — pick a centre, pick a slot, get a token instantly. Point out the SMS log line in the backend terminal (`[MOCK SMS] to ...`) — that's the SMS channel firing for real, just not hitting a paid gateway during the demo.
3. **Show the live queue** — open the token screen, point at "farmers ahead" and the wait-time estimate, and read out the plain-language explanation under it (not a black-box number).
4. **Switch to the officer dashboard** (`officer1`) — advance the token through Gate → Weighing → Quality → Procurement, entering a weight and a quality grade live.
5. **Approve procurement** — set a rate per bag, approve it, and immediately show the payment record appear.
6. **Process the payment** and flip back to the farmer's screen (or the seeded `muthu` account, which already has a completed journey) to show the full rail lit up green from arrival to payment.
7. **Operator portal** — briefly show registering a farmer with no phone and issuing them a token, to cover the accessibility angle from the problem statement.
8. **Admin dashboard** — close with the analytics view: farmers today, average wait, pending payments.

## 7. What's deliberately out of scope for the 48 hours

- Real SMS gateway integration (mocked, but swappable in one file)
- ML-based wait-time prediction (the transparent rules-based estimate is the intended MVP approach — see `backend/src/utils/waitTimeEstimator.js`)
- Multi-language UI strings beyond the language field (structure is there; translations can be added to `frontend/src/pages` as time allows)
- Automated test suite (manual test checklist recommended instead, given the time budget)

## 8. Security notes for the submission

- Passwords are hashed with bcrypt, never stored in plain text.
- JWTs expire (`JWT_EXPIRES_IN` in `backend/.env`).
- Role checks live in `backend/src/middleware/auth.js` (`requireRole`) and are applied per-route, not just in the frontend.
- Change `JWT_SECRET` in `backend/.env` to a real random string before deploying — the `.env.example` value is a placeholder.
- Don't commit real `.env` files or your IBM Bob credentials to the repo.
