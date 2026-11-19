-- Visitor ID scans (Aadhaar front/back)
CREATE TABLE "VisitorDocument" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitorDocument_visitorId_side_key" ON "VisitorDocument"("visitorId", "side");
CREATE INDEX "VisitorDocument_visitorId_idx" ON "VisitorDocument"("visitorId");

ALTER TABLE "VisitorDocument" ADD CONSTRAINT "VisitorDocument_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
