-- Simplify invoice serial config to a fixed shape: "<prefix><year>-<DD>/<MM>/<NN>".
-- The free-form token template is replaced by an editable year part; DD/MM come
-- from the booking date and NN is the per-day counter (InvoiceCounter).
ALTER TABLE "Hotel" DROP COLUMN IF EXISTS "invoiceFormat";
ALTER TABLE "Hotel" ADD COLUMN "invoiceYear" TEXT;
