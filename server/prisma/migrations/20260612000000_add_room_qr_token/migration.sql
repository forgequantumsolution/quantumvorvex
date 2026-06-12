-- AlterTable
ALTER TABLE "Room" ADD COLUMN "qrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Room_qrToken_key" ON "Room"("qrToken");
