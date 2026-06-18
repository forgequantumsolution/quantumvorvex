-- Soft delete for bookings. Additive + nullable — safe for existing rows (all
-- existing bookings stay live with deletedAt = NULL).
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Speeds up the `deletedAt IS NULL` filter applied to every list/stats query.
CREATE INDEX "Booking_deletedAt_idx" ON "Booking"("deletedAt");
