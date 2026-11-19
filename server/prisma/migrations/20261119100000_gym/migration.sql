-- CreateTable
CREATE TABLE "GymPlan" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymMember" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "healthNotes" TEXT,
    "goal" TEXT,
    "source" TEXT NOT NULL DEFAULT 'walk_in',
    "guestId" TEXT,
    "notes" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GymMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymMembership" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "frozenAt" TIMESTAMP(3),
    "frozenDays" INTEGER NOT NULL DEFAULT 0,
    "isRenewal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymPayment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'cash',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "GymPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GymPlan_propertyId_idx" ON "GymPlan"("propertyId");

-- CreateIndex
CREATE INDEX "GymMember_propertyId_phone_idx" ON "GymMember"("propertyId", "phone");

-- CreateIndex
CREATE INDEX "GymMember_propertyId_joinedAt_idx" ON "GymMember"("propertyId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GymMember_propertyId_memberNo_key" ON "GymMember"("propertyId", "memberNo");

-- CreateIndex
CREATE INDEX "GymMembership_propertyId_endDate_idx" ON "GymMembership"("propertyId", "endDate");

-- CreateIndex
CREATE INDEX "GymMembership_memberId_idx" ON "GymMembership"("memberId");

-- CreateIndex
CREATE INDEX "GymPayment_propertyId_paidAt_idx" ON "GymPayment"("propertyId", "paidAt");

-- CreateIndex
CREATE INDEX "GymPayment_membershipId_idx" ON "GymPayment"("membershipId");

-- AddForeignKey
ALTER TABLE "GymPlan" ADD CONSTRAINT "GymPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMember" ADD CONSTRAINT "GymMember_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMember" ADD CONSTRAINT "GymMember_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMembership" ADD CONSTRAINT "GymMembership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMembership" ADD CONSTRAINT "GymMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymMembership" ADD CONSTRAINT "GymMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "GymPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "GymMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

