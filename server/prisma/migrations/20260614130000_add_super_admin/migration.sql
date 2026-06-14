-- Protected super-admin flag (RBAC). Additive, defaults false — safe for existing rows.
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
