-- Invoice config on the hotel record (serial numbering + details printed on invoices).
ALTER TABLE "Hotel" ADD COLUMN "invoicePrefix" TEXT DEFAULT 'INV-';
ALTER TABLE "Hotel" ADD COLUMN "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Hotel" ADD COLUMN "invoicePadding" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Hotel" ADD COLUMN "placeOfSupply" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "bankIfsc" TEXT;

-- Per-booking tax-invoice serial (assigned on first generation, editable, unique).
ALTER TABLE "Booking" ADD COLUMN "invoiceNo" TEXT;
CREATE UNIQUE INDEX "Booking_invoiceNo_key" ON "Booking"("invoiceNo");
