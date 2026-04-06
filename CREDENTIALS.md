# Quantum Vorvex — Credentials Reference

## Application URLs

| Service   | URL                      |
|-----------|--------------------------|
| Frontend  | http://localhost:5173    |
| Backend   | http://localhost:5000    |

---

## Login Accounts

| Role    | Email                          | Password     | Access Level                                              |
|---------|--------------------------------|--------------|-----------------------------------------------------------|
| Owner   | owner@quantumvorvex.com        | owner123     | Full access — all modules + user management               |
| Owner   | admin@hotel.com                | admin123     | Full access — legacy account                              |
| Manager | manager@quantumvorvex.com      | manager123   | Operational — all modules except Staff and user management|
| Staff   | staff@quantumvorvex.com        | staff123     | Front-desk — Check-In, Rooms, Guests, Housekeeping, Maintenance |

---

## Role Permissions Summary

### Owner
- All modules: Dashboard, Rooms, Floor Plan, Check-In, Guests, Bookings, Documents, Food, Billing, Reports, Maintenance, Housekeeping, Channels, Staff, Settings
- Settings tabs: All tabs including **Users & Access**
- Can create, edit, delete user accounts
- Can assign any role including Owner

### Manager
- All operational modules except Staff panel
- Settings tabs: Hotel Profile, Room Config, Facilities, Food Plans, Tax & Pricing, Documents, Notifications
- Cannot access Users & Access tab
- Cannot create or modify user accounts

### Staff
- Limited to: Dashboard, Rooms, Check-In, Guests, Housekeeping, Maintenance
- No access to Billing, Reports, Settings, Bookings, Documents, Food, Channels, Staff

---

## Database

| Item             | Value                                      |
|------------------|--------------------------------------------|
| Engine           | SQLite (local dev)                         |
| File             | server/prisma/dev.db                       |
| DATABASE_URL     | file:./dev.db                              |

---

## Environment (server/.env)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="quantum-vorvex-secret-2026"
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
MESSAGING_PROVIDER=mock
```

---

## Dev Startup

```bash
# From project root — starts both frontend and backend
npm run dev

# Backend only
npm run dev:server

# Frontend only
npm run dev:client

# Re-seed database
cd server && npm run db:seed
```

---

## API Auth

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

Token is returned on login from `POST /api/v1/auth/login` and also set as an httpOnly cookie.
