-- PG / per-bed letting: rooms can be sold by bed, bookings can target one bed,
-- per-bed bookings made together share a groupId, and PG security deposits are
-- tracked separately from advance rent.
ALTER TABLE "Room" ADD COLUMN "rentMode" TEXT NOT NULL DEFAULT 'room';
ALTER TABLE "Room" ADD COLUMN "bedCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Room" ADD COLUMN "bedDailyRate" DOUBLE PRECISION;
ALTER TABLE "Room" ADD COLUMN "bedMonthlyRate" DOUBLE PRECISION;

ALTER TABLE "Guest" ADD COLUMN "bedNo" INTEGER;

ALTER TABLE "Booking" ADD COLUMN "bedNo" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "securityDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");
