# LifeLine Tours — Booking & Fleet Management System

A full-stack booking and fleet management web app for **LifeLine Tours** (Cape Town),
operated under **Lyfe Computer Technologies**. It handles private chauffeur services,
airport transfers, tours, weddings, matric dances and vehicle hire.

Built to run **locally with zero external setup** — no database server, no cloud
accounts. The database is an embedded SQLite file using Node's built-in `node:sqlite`.

---

## Live demo (GitHub Pages)

**https://elvisfalcao.github.io/LifeLineTours/**

GitHub Pages only serves static files, so the live link runs a **browser-only build**:
the same UI backed by an in-browser mock of the API. Data is seeded and saved in your
browser's `localStorage` (per browser, just for you) — it's a clickable demo, not a
shared multi-user system. Sign in with any demo login below; "Reset demo data" on the
sign-in screen restores the original seed.

The real, full-stack app (shared database, server-side PDF invoices) is the `npm start`
version below. You can preview the exact Pages build locally with `npm run demo`
(http://localhost:4100).

> How it works: the root `index.html` sets `window.__LLT_DEMO__ = true` and reuses the
> frontend in `public/`. In demo mode, `public/js/api.js` routes calls to the in-browser
> backend in `public/js/demo/` instead of the network. The real app is untouched.

---

## Quick start

```bash
npm install
npm start
```

Then open **http://localhost:4000**

The first run automatically creates the database and seeds demo data
(2 vehicles, 3 customers, sample bookings).

### Demo logins

| Role   | Email                          | Password   | Access                                            |
|--------|--------------------------------|------------|---------------------------------------------------|
| Admin  | admin@lifelinetours.co.za      | admin123   | Everything — bookings, fleet, reports, users      |
| Staff  | staff@lifelinetours.co.za      | staff123   | Bookings, customers, calendar, fleet              |
| Driver | driver@lifelinetours.co.za     | driver123  | Their assigned trips & pickup details only        |

> On the login screen you can click any demo row to auto-fill it.

### Useful commands

| Command           | What it does                                              |
|-------------------|----------------------------------------------------------|
| `npm start`       | Run the app on port 4000                                 |
| `npm run dev`     | Run with auto-reload on file changes                     |
| `npm run reset-db`| Delete the database so the next start re-seeds fresh data |

Change the port with `PORT=5000 npm start`.

---

## Features (mapped to the specification)

- **Bookings** — capture customer + trip details, auto reference numbers (`LLT-2026-0001`),
  trip types, status workflow, deposits and payments.
- **Availability system** — prevents double-booking a vehicle for overlapping times;
  live availability check while filling in the booking form.
- **Booking rules** — 24-hour minimum notice (with override confirmation), 50% deposit
  default, Cash/EFT methods, four payment statuses.
- **Booking workflow** — New Request → Confirmed → Deposit Received → Driver Assigned →
  Picked Up → Trip In Progress → Completed (+ Cancelled).
- **Calendar** — Google-Calendar-style month view of all trips, colour-coded by status.
- **Customer database** — history, total spent, last booking, notes.
- **Invoices** — generated PDF invoice / booking confirmation per booking.
- **WhatsApp templates** — one-tap pre-filled WhatsApp messages (confirmation, deposit
  reminder, driver details, trip reminder) via `wa.me` deep links.
- **Dashboard** — today's bookings, upcoming trips, available/busy vehicles, monthly
  revenue, outstanding payments.
- **Reports** — revenue (totals, by month, by trip type) and per-vehicle performance
  (trips, revenue, most-used service).
- **User roles** — Admin, Staff, Driver, enforced on both the API and the UI.

---

## Tech stack

- **Backend:** Node.js + Express, JWT auth, bcrypt password hashing, PDFKit invoices.
- **Database:** SQLite via Node's built-in `node:sqlite` (file at `data/lifeline.db`).
- **Frontend:** Vanilla JS single-page app (ES modules, no build step) + custom CSS.

## Project structure

```
src/
  server.js          Express app + route mounting
  db.js              SQLite schema
  seed.js            First-run demo data
  services.js        Booking logic (availability, payments, WhatsApp)
  auth.js            JWT + role middleware
  constants.js       Enums, pricing, message templates, business info
  routes/            API endpoints (auth, bookings, vehicles, customers,
                     dashboard, reports, users, invoices, meta)
public/
  index.html, css/styles.css
  js/                app shell, router, api client, shared UI, views/
```

---

## Future expansion (already structured for it)

The spec's roadmap items — customer online booking portal, Google Maps, WhatsApp Business
API, driver mobile app, GPS tracking, email notifications, reviews — fit on top of the
current REST API and schema. To deploy to the cloud (Vercel + Supabase/Postgres as the
spec suggests), the `db.js` / `services.js` data layer can be swapped to a Postgres client
while keeping the routes and frontend unchanged.
