-- Gym member ID scans (Aadhaar front/back)
CREATE TABLE "GymMemberDocument" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymMemberDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GymMemberDocument_memberId_side_key" ON "GymMemberDocument"("memberId", "side");
CREATE INDEX "GymMemberDocument_memberId_idx" ON "GymMemberDocument"("memberId");

ALTER TABLE "GymMemberDocument" ADD CONSTRAINT "GymMemberDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
