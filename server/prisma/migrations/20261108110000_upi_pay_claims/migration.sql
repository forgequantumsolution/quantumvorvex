-- UPI pay flow: an uploaded payment-QR image per property, and guests' "I've paid"
-- reports awaiting staff confirmation. Adds a column and a table only.
ALTER TABLE "Hotel" ADD COLUMN IF NOT EXISTS "upiQrUrl" TEXT;

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "guestName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "utr" TEXT NOT NULL,
    "payerName" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentClaim_propertyId_status_idx" ON "PaymentClaim"("propertyId", "status");

-- CreateIndex
CREATE INDEX "PaymentClaim_refId_idx" ON "PaymentClaim"("refId");

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
