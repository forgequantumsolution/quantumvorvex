-- Parent/guardian details + native address on bookings and guests
ALTER TABLE "Booking" ADD COLUMN "guardianName" TEXT,
ADD COLUMN "guardianPhone" TEXT,
ADD COLUMN "guardianAadhaar" TEXT,
ADD COLUMN "nativeAddress" TEXT;

ALTER TABLE "Guest" ADD COLUMN "guardianName" TEXT,
ADD COLUMN "guardianPhone" TEXT,
ADD COLUMN "guardianAadhaar" TEXT,
ADD COLUMN "nativeAddress" TEXT;
