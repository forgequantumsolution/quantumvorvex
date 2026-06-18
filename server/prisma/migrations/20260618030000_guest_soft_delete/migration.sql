-- Soft delete for guests (aligns with Room.deletedAt / Booking.deletedAt).
-- Additive + nullable — safe for existing rows (all stay live).
ALTER TABLE "Guest" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Speeds up the `deletedAt IS NULL` filter applied to every guest list/stat query.
CREATE INDEX "Guest_deletedAt_idx" ON "Guest"("deletedAt");
