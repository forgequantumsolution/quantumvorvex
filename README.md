# Quantum Vorvex — Hotel Management System

A full-stack hotel management system: rooms, guests, bookings, billing, housekeeping,
maintenance, staff, reports, and more.

## Tech Stack

**Backend** (`server/`)
- Node.js + Express (REST API under `/api/v1`)
- PostgreSQL via Prisma ORM
- JWT auth, Helmet, rate limiting, request logging (Winston)

**Frontend** (`client/`)
- React 19 + Vite + Tailwind CSS
- Redux Toolkit (+ redux-persist) for state management
- Formik + Yup for forms and validation
- Axios API client

## Project Structure

```
quantumvorvex/
├── package.json                # root dev scripts (runs client + server together)
├── server/                     # Node + Express + Prisma (PostgreSQL)
│   ├── prisma/
│   │   ├── schema.prisma       # data models (provider = postgresql)
│   │   └── migrations/         # generated on first `prisma migrate dev`
│   └── src/
│       ├── server.js           # entry point (app.listen + seed + cron)
│       ├── app.js              # Express app factory (middleware + routes)
│       ├── routes/             # one router per resource
│       ├── controllers/        # request handlers (use Prisma)
│       ├── middleware/         # auth, validation
│       └── utils/              # prisma client, logger, seed, cron
└── client/                     # React + Vite + Tailwind
    └── src/
        ├── main.jsx            # bootstraps <Provider> + <PersistGate>
        ├── App.jsx             # panel-based shell + auth gate
        ├── store/
        │   ├── index.js        # configureStore + redux-persist
        │   ├── hooks.js        # typed selector/dispatch + bound-action hooks
        │   └── slices/         # ui, auth, hotel, toast
        ├── validation/         # Yup schemas (auth, staff, booking, guest, …)
        ├── api/client.js       # axios instance (attaches Bearer token)
        ├── components/
        │   ├── ui/             # reusable UI incl. FormikField, FormField, Modal
        │   ├── auth/           # LoginPage
        │   ├── layout/         # Sidebar, Topbar, Layout
        │   └── modules/        # feature modules (dashboard, rooms, guests, …)
        ├── hooks/  utils/  assets/
```

## Prerequisites

- Node.js 18+ and npm
- A running PostgreSQL instance (local or managed)

## Setup

1. **Install dependencies** (root, client, and server):
   ```bash
   npm run install:all
   ```

2. **Configure the backend environment.** Copy the example and fill in real values:
   ```bash
   cp server/.env.example server/.env
   ```
   At minimum set `DATABASE_URL` (PostgreSQL) and `JWT_SECRET`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quantumvorvex?schema=public"
   JWT_SECRET="<32+ random chars — node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
   ```

3. **Start PostgreSQL.** If you don't have a local Postgres, the quickest option is
   Docker (matches the `DATABASE_URL` above):
   ```bash
   docker run --name vorvex-pg --restart unless-stopped \
     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=quantumvorvex -p 5432:5432 -d postgres:16
   ```
   The data persists across restarts. After a reboot (or restarting Docker), the
   container comes back automatically thanks to `--restart unless-stopped`; if it's
   stopped you can bring it back with:
   ```bash
   docker start vorvex-pg
   ```

4. **Create the database schema and seed demo data:**
   ```bash
   cd server
   npx prisma migrate dev --name init   # creates tables in PostgreSQL
   npm run db:seed                       # seeds demo hotel, rooms, and users
   cd ..
   ```

## Running

From the repository root:

```bash
npm run dev        # runs the API (port 5000) and the client (port 5173) together
```

Or individually:

```bash
npm run dev:server # API only
npm run dev:client # client only
```

The client expects the API at `/api/v1` (set `VITE_API_URL` in `client/.env` to override).
Set `VITE_MOCK=true` in `client/.env` to run the UI against built-in mock data with no backend.

## Demo Accounts (after seeding)

| Role    | Email                       | Password    |
| ------- | --------------------------- | ----------- |
| Owner   | owner@quantumvorvex.com     | owner123    |
| Manager | manager@quantumvorvex.com   | manager123  |
| Staff   | staff@quantumvorvex.com     | staff123    |

## Useful Scripts

| Command                         | What it does                              |
| ------------------------------- | ----------------------------------------- |
| `npm run dev`                   | Run client + server together              |
| `npm run build`                 | Build the client for production           |
| `npm run db:migrate`            | Run Prisma migrations (`server/`)         |
| `npm run db:seed`               | Seed the database (`server/`)             |
| `cd server && npx prisma studio`| Browse the database in a GUI              |
