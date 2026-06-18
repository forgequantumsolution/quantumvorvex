-- Room.number was globally unique, so a soft-deleted room kept reserving its
-- number and a new room couldn't reuse it. Replace the full unique index with a
-- PARTIAL one that only applies to live rooms (deletedAt IS NULL). Duplicate
-- numbers among live rooms still raise P2002 (→ 409 in createRoom); a number
-- belonging only to soft-deleted rooms is free to reuse.
DROP INDEX "Room_number_key";

CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number") WHERE "deletedAt" IS NULL;
