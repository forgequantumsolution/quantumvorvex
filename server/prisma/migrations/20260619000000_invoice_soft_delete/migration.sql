-- Soft delete for invoices (aligns with Room/Booking/Guest deletedAt).
-- Additive + nullable — safe for existing rows (all stay live).
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Speeds up the `deletedAt IS NULL` filter applied to every billing/report query.
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");
