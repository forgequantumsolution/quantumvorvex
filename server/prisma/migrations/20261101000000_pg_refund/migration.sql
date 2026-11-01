-- Move-out settlement: how much of the security deposit went against dues and how
-- much money was refunded. New columns only; existing rows keep their values.
ALTER TABLE "Booking" ADD COLUMN "depositUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "refundedAt" TIMESTAMP(3);
