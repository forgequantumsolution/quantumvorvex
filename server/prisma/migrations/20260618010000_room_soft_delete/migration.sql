-- Soft delete for rooms via a dedicated timestamp (aligns with Booking.deletedAt),
-- replacing the previous status = 'deleted' convention. Additive + nullable.
ALTER TABLE "Room" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Speeds up the `deletedAt IS NULL` filter applied to every room list/board/report.
CREATE INDEX "Room_deletedAt_idx" ON "Room"("deletedAt");

-- Backfill: rooms previously soft-deleted via status='deleted' must stay hidden
-- now that filtering switches to deletedAt. Stamp them and clear the sentinel
-- status so a future restore leaves a valid operational status.
UPDATE "Room"
SET "deletedAt" = CURRENT_TIMESTAMP,
    "status"    = 'available'
WHERE "status" = 'deleted';
