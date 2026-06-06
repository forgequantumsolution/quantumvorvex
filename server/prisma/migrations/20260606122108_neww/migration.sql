/*
  Warnings:

  - A unique constraint covering the columns `[ticketNo]` on the table `MaintenanceRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ticketNo` to the `MaintenanceRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `MaintenanceRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MaintenanceRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN     "ticketNo" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "issueType" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "reportedBy" SET DEFAULT 'Front Desk';

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_ticketNo_key" ON "MaintenanceRequest"("ticketNo");
