# Access Control Plan — Quantum Vorvex

> Status: **Phase 1 in progress.** Design refined after external review (Gemini + ChatGPT)
> and a decision to fully remove the dead `Staff` module now.
> Last updated: 2026-06-14

## Background — why this is needed

Authentication is solid (JWT, brute-force lockout, single-session option, no user
enumeration). **Authorization is not.** Across 15 route files only 3 endpoints check
role. Every other endpoint only runs `verifyToken` — "are you logged in," not "are you
allowed." Any logged-in user (incl. a `staff` token) can manage staff, rewrite the
permission matrix, collect payments, read financials, change pricing, and edit settings
directly via the API. The frontend role map only hides UI; it enforces nothing.

There were two disconnected identity tables: `User` (login) and `Staff` (an RBAC module
whose accounts can't actually log in). **The `Staff`, `StaffSession`, `StaffProperty`,
`ActivityLog`, and old `Permission` tables are all empty (0 rows)** — confirmed 2026-06-14.
So there is nothing to migrate; the Staff module is dead code and is removed outright.

## Approved decisions

1. **Granularity:** per-module access **level** — `none` / `view` / `manage`, with
   explicit per-route action checks (`requirePermission(module, action)`) and a
   method-based default that routes may override.
2. **Identity:** one table — `User` — for everyone who logs in; each user has one `Role`.
   The legacy `Staff` module (tables + controller + routes + frontend panel) is
   **removed entirely in Phase 1** (all its tables are empty).
3. **Sidebar:** the freed `Staff` slot is **repurposed into a top-level "Users & Roles"**
   management panel (not just Settings → Users).
4. **First login:** password change is optional in Settings. A `mustChangePassword` flag
   is added but unused for now.
5. **New users** get default password `Welcome@123` (bcrypt-hashed); changeable later.
6. **Backend modules = real route domains (11):** `bookings, maintenance, guests, rooms,
   documents, food, housekeeping, billing, reports, settings, users`.
   `today` and `cancellations` are **UI-only** panels, visibility derived in the frontend
   (today ← reports/bookings; cancellations ← bookings). Avoids query-aware middleware
   over shared routes. *(`users` is the module for the Users & Roles panel + role mgmt.)*
7. **Role management is owner-only.** Only `isOwner` roles may create/update/delete roles
   or assign roles to users; others are read-only on roles.
8. **Last-owner invariant:** active users whose role `isOwner` must stay ≥ 1 — enforced on
   delete, deactivate, role reassignment, and role edits.
9. **Session freshness:** JWT carries `userId` (not the permission set). Middleware
   resolves the user's *current* role + permissions per request from a cache; role
   reassignment / permission edits take effect immediately via cache-bust. Password and
   role changes revoke sessions by bumping the existing `sessionVersion`. No new column.
10. **Access level is a Prisma enum** (`AccessLevel`); the **module key stays a `String`**
    validated against a central `MODULES` const, so new panels don't need a DB enum migration.

## Data model (Prisma)

```prisma
enum AccessLevel { NONE  VIEW  MANAGE }

model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  description String?
  isSystem    Boolean          @default(false)  // seeded roles: protected from deletion
  isOwner     Boolean          @default(false)  // implicit full access — bypasses checks
  users       User[]
  permissions RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model RolePermission {
  id     String      @id @default(cuid())
  roleId String
  role   Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  module String                          // validated against central MODULES list
  level  AccessLevel @default(NONE)
  @@unique([roleId, module])
  @@index([roleId])
}

model User {
  // … existing fields …
  role               String   @default("staff")   // legacy; dropped in final cleanup
  roleId             String?
  roleRef            Role?    @relation(fields: [roleId], references: [id])
  mustChangePassword Boolean  @default(false)      // wired, unused for now
  // sessionVersion reused for session revocation
  @@index([roleId])
}
```

**Removed (Phase 1):** `Staff`, `StaffSession`, `StaffProperty`, `ActivityLog`,
`Permission`, plus `Property.staff` relation. A clean `AuditLog` (FK → `User`) is
introduced in the enforcement phase.

## Seeding

Three system roles mirroring today's behavior:
- **Owner** (`isSystem`, `isOwner`) — `MANAGE` on all 11 modules.
- **Manager** (`isSystem`) — `MANAGE` on all except `users` (`NONE`).
- **Staff** (`isSystem`) — `MANAGE` on `bookings, maintenance, guests, rooms,
  housekeeping`; `NONE` on `documents, food, billing, reports, settings, users`.

Link seeded users to roles (owner/legacy-admin → Owner, manager → Manager, staff → Staff).
Update `seed.js`; strip the staff/session/permission/activity block from `seedDemo.js`.

## Rollout

| Phase | Scope | Ships |
|------|-------|-------|
| **1 — Data + Users & Roles slice + Staff teardown** | Schema (Role/RolePermission/AccessLevel, User.roleId/mustChangePassword); drop the 5 empty Staff tables; remove staff backend (`staffController`, `routes/staff`, app mount) + staff block in `seedDemo`; seed roles + link users. Minimal roles read API + users API takes `roleId`/default password. Repurpose sidebar `Staff` → **Users & Roles** panel (user list + create/edit/deactivate with role dropdown; role list view). | Working Users & Roles screen; no enforcement yet |
| **2 — Backend enforcement** | `server/src/config/modules.js`; `requirePermission(module, action?)`; per-`roleId` cache + bust; apply to all routers; full role CRUD (owner-only, last-owner invariant); role matrix editor in the panel; `POST /auth/change-password` (bumps `sessionVersion`); `AuditLog` for authz-sensitive events. | **Closes the security gaps — independently shippable** |
| **3 — Dynamic frontend** | `/auth/me` returns `{module: level}`; sidebar + `useCan` action gating read from it; global 403 interceptor re-syncs `/auth/me`; change-password UI. | UI reflects real permissions |
| **4 — Cleanup** | Drop legacy `User.role`; remove any remaining dead permission logic. | Cutover complete |

## Notes carried from review
- Per-route explicit action overrides where verb ≠ intent (e.g. `POST /reports/export` = view).
- Cache busts on permission change, user role reassignment, and role delete/restore.
- Consider role soft-delete (`active`/`deletedAt`) to preserve audit context (Phase 2).
- "Send temp password to user" option in the create-user UI (Phase 1/2 UI).
- Negative tests: non-owner hitting `POST /roles`, `PUT /users/:id`, etc. (Phase 2).
