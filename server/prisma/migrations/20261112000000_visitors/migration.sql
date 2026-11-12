-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "visitorAutoApprove" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visitorToken" TEXT;

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "passNo" TEXT NOT NULL,
    "passToken" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'other',
    "hostName" TEXT,
    "roomNumber" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "vehicleNo" TEXT,
    "companions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'desk',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expectedAt" TIMESTAMP(3),
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "consentAt" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorBlock" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_passToken_key" ON "Visitor"("passToken");

-- CreateIndex
CREATE INDEX "Visitor_propertyId_createdAt_idx" ON "Visitor"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Visitor_propertyId_status_idx" ON "Visitor"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Visitor_propertyId_phone_idx" ON "Visitor"("propertyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_propertyId_passNo_key" ON "Visitor"("propertyId", "passNo");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorBlock_propertyId_phone_key" ON "VisitorBlock"("propertyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Property_visitorToken_key" ON "Property"("visitorToken");

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorBlock" ADD CONSTRAINT "VisitorBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

