-- Token-based invoice serial format (e.g. "{PREFIX}/{YYYY}-{DD}/{MM}/{SEQ}" → RA/2026-27/06/01).
ALTER TABLE "Hotel" ADD COLUMN "invoiceFormat" TEXT DEFAULT '{PREFIX}{SEQ}';

-- Per-bucket running counter so {SEQ} restarts when the date part changes.
-- period = the serial with {SEQ} stripped, e.g. "RA/2026-27/06/".
CREATE TABLE "InvoiceCounter" (
  "id"      TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "period"  TEXT NOT NULL,
  "next"    INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceCounter_hotelId_period_key" ON "InvoiceCounter"("hotelId", "period");
