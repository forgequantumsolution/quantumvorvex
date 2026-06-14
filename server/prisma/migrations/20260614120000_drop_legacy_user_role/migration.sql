-- Drop the legacy User.role string column (RBAC Phase 4). Identity is unified on
-- User.roleId -> Role; no consumer reads this column anymore.
ALTER TABLE "User" DROP COLUMN "role";
