-- Multi-property support.
--
-- Every operational table gets a required "propertyId". Existing single-hotel data
-- is backfilled into one property (the oldest existing Property row, or a newly
-- created "Main Property"), so nothing is lost and the app keeps working as before.
-- Per-property uniqueness replaces the old global unique keys (room numbers,
-- booking/invoice/ticket numbers, catalog names), and non-owner users are given
-- access to the backfill property with the role they already had.

-- ── 0. Safety checks: stop (nothing is changed) rather than guess ───────────────
-- The whole migration runs in one transaction, so raising here leaves the
-- database exactly as it was.
DO $$
DECLARE
  first_pid TEXT := (SELECT "id" FROM "Property" ORDER BY "createdAt" LIMIT 1);
  hotels    INT  := (SELECT count(*) FROM "Hotel");
BEGIN
  -- Each property owns exactly one settings row; with several, which one is the
  -- real hotel profile (invoice prefix, GSTIN, bank details) is a human decision.
  IF hotels > 1 THEN
    RAISE EXCEPTION 'multi_property: found % rows in "Hotel" (expected at most 1). Keep the row the app uses (SELECT * FROM "Hotel" ORDER BY "createdAt"), remove the others, then deploy again.', hotels;
  END IF;
  -- All existing data is backfilled into the oldest property. Rooms already
  -- assigned to another property would end up separated from their bookings.
  IF EXISTS (SELECT 1 FROM "Room" WHERE "propertyId" IS NOT NULL AND "propertyId" <> first_pid) THEN
    RAISE EXCEPTION 'multi_property: some rooms are assigned to a property other than the oldest one (%). Move them first (UPDATE "Room" SET "propertyId" = NULL WHERE "propertyId" <> ''%''), then deploy again.', first_pid, first_pid;
  END IF;
END $$;

-- ── 1. Property: identity only (code + timestamps); profile fields live on Hotel ──
ALTER TABLE "Property"
  ADD COLUMN "code"      TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "Property" ("id", "name", "status", "createdAt")
SELECT 'default', COALESCE((SELECT "name" FROM "Hotel" ORDER BY "createdAt" LIMIT 1), 'Main Property'), 'active', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Property");

UPDATE "Property" p SET "code" = 'P' || lpad(n.rn::text, 2, '0')
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt") AS rn FROM "Property") n
WHERE p."id" = n."id";

ALTER TABLE "Property" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Property_code_key" ON "Property"("code");

-- Make sure the backfill property has a settings row, then carry over any profile
-- fields that only existed on Property before dropping them.
INSERT INTO "Hotel" ("id", "name", "updatedAt")
SELECT 'default', (SELECT "name" FROM "Property" ORDER BY "createdAt" LIMIT 1), CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Hotel");

ALTER TABLE "Hotel" ADD COLUMN "propertyId" TEXT;

UPDATE "Hotel" h SET
  "propertyId" = p."id",
  "address"    = COALESCE(h."address", p."address"),
  "phone"      = COALESCE(h."phone",   p."phone"),
  "gstin"      = COALESCE(h."gstin",   p."gstin")
FROM (SELECT * FROM "Property" ORDER BY "createdAt" LIMIT 1) p;

ALTER TABLE "Property" DROP COLUMN "address", DROP COLUMN "gstin", DROP COLUMN "phone";

ALTER TABLE "Hotel" ALTER COLUMN "propertyId" SET NOT NULL;
CREATE UNIQUE INDEX "Hotel_propertyId_key" ON "Hotel"("propertyId");

-- ── 2. Add + backfill propertyId on every operational table ─────────────────────
ALTER TABLE "Room" DROP CONSTRAINT "Room_propertyId_fkey";

ALTER TABLE "Amenity"             ADD COLUMN "propertyId" TEXT;
ALTER TABLE "CompetitorRate"      ADD COLUMN "propertyId" TEXT;
ALTER TABLE "FoodPlan"            ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Invoice"             ADD COLUMN "propertyId" TEXT;
ALTER TABLE "LinenRecord"         ADD COLUMN "propertyId" TEXT;
ALTER TABLE "MaintenanceRequest"  ADD COLUMN "propertyId" TEXT;
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "MessageTemplate"     ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Notification"        ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Payment"             ADD COLUMN "propertyId" TEXT;
ALTER TABLE "PricingRule"         ADD COLUMN "propertyId" TEXT;
ALTER TABLE "RoomInspection"      ADD COLUMN "propertyId" TEXT;
ALTER TABLE "RoomType"            ADD COLUMN "propertyId" TEXT;

DO $$
DECLARE pid TEXT := (SELECT "id" FROM "Property" ORDER BY "createdAt" LIMIT 1);
BEGIN
  UPDATE "Amenity"             SET "propertyId" = pid WHERE "propertyId" IS NULL;
  -- Booking/Guest already had an unused, unconstrained propertyId column: any
  -- value that isn't a real property is meaningless, so it is backfilled too.
  UPDATE "Booking"             SET "propertyId" = pid WHERE "propertyId" IS NULL OR "propertyId" NOT IN (SELECT "id" FROM "Property");
  UPDATE "CompetitorRate"      SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "FoodPlan"            SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "Guest"               SET "propertyId" = pid WHERE "propertyId" IS NULL OR "propertyId" NOT IN (SELECT "id" FROM "Property");
  UPDATE "Invoice"             SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "LinenRecord"         SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "MaintenanceRequest"  SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "MaintenanceSchedule" SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "MessageTemplate"     SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "Notification"        SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "Payment"             SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "PricingRule"         SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "Room"                SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "RoomInspection"      SET "propertyId" = pid WHERE "propertyId" IS NULL;
  UPDATE "RoomType"            SET "propertyId" = pid WHERE "propertyId" IS NULL;
END $$;

ALTER TABLE "Amenity"             ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Booking"             ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "CompetitorRate"      ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "FoodPlan"            ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Guest"               ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Invoice"             ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "LinenRecord"         ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "MaintenanceRequest"  ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "MaintenanceSchedule" ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "MessageTemplate"     ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Notification"        ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Payment"             ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "PricingRule"         ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "Room"                ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "RoomInspection"      ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "RoomType"            ALTER COLUMN "propertyId" SET NOT NULL;

-- ── 3. Global unique keys → per-property unique keys ────────────────────────────
DROP INDEX "Amenity_name_key";
DROP INDEX "Booking_bookingNo_key";
DROP INDEX "Booking_invoiceNo_key";
DROP INDEX "FoodPlan_name_key";
DROP INDEX "Guest_docId_key";
DROP INDEX "Invoice_invoiceNo_key";
DROP INDEX "MaintenanceRequest_ticketNo_key";
DROP INDEX "MessageTemplate_trigger_key";
DROP INDEX "RoomType_name_key";

CREATE UNIQUE INDEX "Amenity_propertyId_name_key"                ON "Amenity"("propertyId", "name");
CREATE UNIQUE INDEX "Booking_propertyId_bookingNo_key"           ON "Booking"("propertyId", "bookingNo");
CREATE UNIQUE INDEX "Booking_propertyId_invoiceNo_key"           ON "Booking"("propertyId", "invoiceNo");
CREATE UNIQUE INDEX "FoodPlan_propertyId_name_key"               ON "FoodPlan"("propertyId", "name");
CREATE UNIQUE INDEX "Guest_propertyId_docId_key"                 ON "Guest"("propertyId", "docId");
CREATE UNIQUE INDEX "Invoice_propertyId_invoiceNo_key"           ON "Invoice"("propertyId", "invoiceNo");
CREATE UNIQUE INDEX "MaintenanceRequest_propertyId_ticketNo_key" ON "MaintenanceRequest"("propertyId", "ticketNo");
CREATE UNIQUE INDEX "MessageTemplate_propertyId_trigger_key"     ON "MessageTemplate"("propertyId", "trigger");
CREATE UNIQUE INDEX "RoomType_propertyId_name_key"               ON "RoomType"("propertyId", "name");

-- Room numbers: unique per property among live rooms (partial index, not expressible
-- in the Prisma schema — see the note on Room.number).
DROP INDEX "Room_number_key";
CREATE UNIQUE INDEX "Room_propertyId_number_key" ON "Room"("propertyId", "number") WHERE "deletedAt" IS NULL;

CREATE INDEX "CompetitorRate_propertyId_idx"      ON "CompetitorRate"("propertyId");
CREATE INDEX "LinenRecord_propertyId_idx"         ON "LinenRecord"("propertyId");
CREATE INDEX "MaintenanceSchedule_propertyId_idx" ON "MaintenanceSchedule"("propertyId");
CREATE INDEX "Notification_propertyId_idx"        ON "Notification"("propertyId");
CREATE INDEX "Payment_propertyId_createdAt_idx"   ON "Payment"("propertyId", "createdAt");
CREATE INDEX "PricingRule_propertyId_idx"         ON "PricingRule"("propertyId");
CREATE INDEX "Room_propertyId_idx"                ON "Room"("propertyId");
CREATE INDEX "RoomInspection_propertyId_idx"      ON "RoomInspection"("propertyId");

-- ── 4. Per-property access (role per property for non-owner users) ──────────────
CREATE TABLE "PropertyAccess" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roleId"     TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyAccess_propertyId_idx" ON "PropertyAccess"("propertyId");
CREATE UNIQUE INDEX "PropertyAccess_userId_propertyId_key" ON "PropertyAccess"("userId", "propertyId");

-- Existing non-owner users keep working: give them the backfill property with the
-- role they already had.
INSERT INTO "PropertyAccess" ("id", "userId", "propertyId", "roleId")
SELECT 'pa_' || u."id", u."id", (SELECT "id" FROM "Property" ORDER BY "createdAt" LIMIT 1), u."roleId"
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId"
WHERE r."isOwner" = false;

-- ── 5. Foreign keys ─────────────────────────────────────────────────────────────
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FoodPlan" ADD CONSTRAINT "FoodPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitorRate" ADD CONSTRAINT "CompetitorRate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LinenRecord" ADD CONSTRAINT "LinenRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomInspection" ADD CONSTRAINT "RoomInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
