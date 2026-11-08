-- UPI payment details and the public web address for guest links. Adds columns only.
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "upiName" TEXT;
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "publicUrl" TEXT;
