/**
 * Backfill qrToken for rooms created before the maintenance-QR feature.
 * Idempotent: only rooms with a null qrToken are touched.
 *
 * Run from the server/ directory:  node scripts/backfill-room-qr-tokens.js
 */
import prisma from '../src/utils/prisma.js'
import { generateQrToken } from '../src/controllers/roomsController.js'

async function main() {
  const rooms = await prisma.room.findMany({
    where: { qrToken: null },
    select: { id: true, number: true },
  })

  if (rooms.length === 0) {
    console.log('All rooms already have a qrToken. Nothing to do.')
    return
  }

  console.log(`Backfilling qrToken for ${rooms.length} room(s)...`)
  for (const room of rooms) {
    await prisma.room.update({
      where: { id: room.id },
      data: { qrToken: generateQrToken() },
    })
    console.log(`  ✓ Room ${room.number}`)
  }
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
