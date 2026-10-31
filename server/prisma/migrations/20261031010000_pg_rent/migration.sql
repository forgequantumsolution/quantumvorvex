-- PG tenancies are billed monthly: each rent invoice links to its bed booking,
-- which tracks how far rent is billed and how much of its advance is applied.
ALTER TABLE "Booking" ADD COLUMN "rentBilledUntil" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "advanceApplied" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Invoice" ADD COLUMN "bookingId" TEXT;
CREATE INDEX "Invoice_bookingId_idx" ON "Invoice"("bookingId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
