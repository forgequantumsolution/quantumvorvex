-- Pre-deploy check for migration 20261024000000_multi_property.
-- READ-ONLY: run it against the live database before deploying. It changes nothing.
--
--   docker compose -f docker-compose.uat.yml exec -T postgres \
--     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < multi-property-preflight.sql
--
-- Every row marked BLOCKER must show ok before you deploy. The migration also
-- checks these itself and stops without changing anything, but it is quicker to
-- find out here.

BEGIN TRANSACTION READ ONLY;

\echo '== Already applied? (no row = not yet applied)'
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations WHERE migration_name = '20261024000000_multi_property';

\echo '== Checks'
WITH first_property AS (SELECT "id" FROM "Property" ORDER BY "createdAt" LIMIT 1)
SELECT 'BLOCKER' AS level, 'Hotel settings rows (must be 0 or 1)' AS check,
       count(*)::text AS found, CASE WHEN count(*) <= 1 THEN 'ok' ELSE 'FIX: keep one row' END AS result
FROM "Hotel"
UNION ALL
SELECT 'BLOCKER', 'Rooms assigned to a property other than the oldest',
       count(*)::text, CASE WHEN count(*) = 0 THEN 'ok' ELSE 'FIX: see migration message' END
FROM "Room" WHERE "propertyId" IS NOT NULL AND "propertyId" <> (SELECT "id" FROM first_property)
UNION ALL
SELECT 'info', 'Existing Property rows (data goes into the oldest)',
       count(*)::text, 'ok' FROM "Property"
UNION ALL
SELECT 'info', 'Bookings/guests with a stray propertyId (auto-repaired)',
       ((SELECT count(*) FROM "Booking" WHERE "propertyId" IS NOT NULL AND "propertyId" NOT IN (SELECT "id" FROM "Property"))
      + (SELECT count(*) FROM "Guest"   WHERE "propertyId" IS NOT NULL AND "propertyId" NOT IN (SELECT "id" FROM "Property")))::text, 'ok'
UNION ALL
SELECT 'info', 'Users with no role (given access on first start)',
       count(*)::text, 'ok' FROM "User" WHERE "roleId" IS NULL;

\echo '== Row counts and money totals — save this output and compare after the deploy'
SELECT 'Room' AS t, count(*) AS n, NULL::text AS total FROM "Room"
UNION ALL SELECT 'RoomType', count(*), NULL FROM "RoomType"
UNION ALL SELECT 'Guest', count(*), NULL FROM "Guest"
UNION ALL SELECT 'Booking', count(*), sum(amount)::text FROM "Booking"
UNION ALL SELECT 'Invoice', count(*), sum(total)::text || ' / paid ' || sum("amountPaid")::text FROM "Invoice"
UNION ALL SELECT 'Payment', count(*), sum(amount)::text FROM "Payment"
UNION ALL SELECT 'User', count(*), NULL FROM "User"
UNION ALL SELECT 'Notification', count(*), NULL FROM "Notification"
UNION ALL SELECT 'MaintenanceRequest', count(*), NULL FROM "MaintenanceRequest"
UNION ALL SELECT 'Document', count(*), NULL FROM "Document"
ORDER BY 1;

ROLLBACK;
