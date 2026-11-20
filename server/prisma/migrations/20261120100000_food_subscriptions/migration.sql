-- Food: customers, subscriptions, payments, daily meal log, weekly menu
-- AlterTable
ALTER TABLE "FoodPlan" ADD COLUMN     "meals" TEXT NOT NULL DEFAULT '["breakfast","lunch","dinner"]';

-- CreateTable
CREATE TABLE "FoodCustomer" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "diet" TEXT,
    "guestId" TEXT,
    "bookingId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSubscription" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT NOT NULL,
    "meals" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pausedAt" TIMESTAMP(3),
    "pausedDays" INTEGER NOT NULL DEFAULT 0,
    "isRenewal" BOOLEAN NOT NULL DEFAULT false,
    "bookingId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodPayment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'cash',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FoodPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMealLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "meal" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FoodMealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMenuItem" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "meal" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodCustomer_propertyId_phone_idx" ON "FoodCustomer"("propertyId", "phone");

-- CreateIndex
CREATE INDEX "FoodCustomer_bookingId_idx" ON "FoodCustomer"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCustomer_propertyId_customerNo_key" ON "FoodCustomer"("propertyId", "customerNo");

-- CreateIndex
CREATE INDEX "FoodSubscription_propertyId_endDate_idx" ON "FoodSubscription"("propertyId", "endDate");

-- CreateIndex
CREATE INDEX "FoodSubscription_customerId_idx" ON "FoodSubscription"("customerId");

-- CreateIndex
CREATE INDEX "FoodSubscription_bookingId_idx" ON "FoodSubscription"("bookingId");

-- CreateIndex
CREATE INDEX "FoodPayment_propertyId_paidAt_idx" ON "FoodPayment"("propertyId", "paidAt");

-- CreateIndex
CREATE INDEX "FoodPayment_subscriptionId_idx" ON "FoodPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "FoodMealLog_propertyId_date_idx" ON "FoodMealLog"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FoodMealLog_customerId_date_meal_key" ON "FoodMealLog"("customerId", "date", "meal");

-- CreateIndex
CREATE UNIQUE INDEX "FoodMenuItem_propertyId_weekday_meal_key" ON "FoodMenuItem"("propertyId", "weekday", "meal");

-- AddForeignKey
ALTER TABLE "FoodCustomer" ADD CONSTRAINT "FoodCustomer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodCustomer" ADD CONSTRAINT "FoodCustomer_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodCustomer" ADD CONSTRAINT "FoodCustomer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSubscription" ADD CONSTRAINT "FoodSubscription_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSubscription" ADD CONSTRAINT "FoodSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FoodCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSubscription" ADD CONSTRAINT "FoodSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FoodPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPayment" ADD CONSTRAINT "FoodPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPayment" ADD CONSTRAINT "FoodPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FoodSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPayment" ADD CONSTRAINT "FoodPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FoodCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMealLog" ADD CONSTRAINT "FoodMealLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMealLog" ADD CONSTRAINT "FoodMealLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FoodCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMealLog" ADD CONSTRAINT "FoodMealLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FoodSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMenuItem" ADD CONSTRAINT "FoodMenuItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

