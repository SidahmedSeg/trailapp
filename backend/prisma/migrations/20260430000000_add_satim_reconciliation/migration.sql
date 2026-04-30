-- Add SatimReconciliation table for the orphan-recovery admin tool.
-- Idempotent: uses IF NOT EXISTS / IF EXISTS to be safe on environments
-- where parts may already exist from earlier raw-SQL fixes (production
-- has already moved bibNumber to a compound [bibNumber, eventId] unique
-- outside the migration history).

-- Sync DB to schema for bibNumber uniqueness (idempotent)
DROP INDEX IF EXISTS "Registration_bibNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Registration_bibNumber_eventId_key" ON "Registration"("bibNumber", "eventId");

-- Drop legacy plain email index if it lingers (compound [email, eventId] unique covers lookup)
DROP INDEX IF EXISTS "Registration_email_idx";

-- New table
CREATE TABLE IF NOT EXISTS "SatimReconciliation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "depositDate" TIMESTAMP(3),
    "approvedAmount" INTEGER NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "cardPan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "linkToken" TEXT,
    "linkExpiresAt" TIMESTAMP(3),
    "linkSentToEmail" TEXT,
    "linkSentAt" TIMESTAMP(3),
    "registrationId" TEXT,
    "enteredCardPan" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SatimReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SatimReconciliation_linkToken_key"           ON "SatimReconciliation"("linkToken");
CREATE UNIQUE INDEX IF NOT EXISTS "SatimReconciliation_registrationId_key"      ON "SatimReconciliation"("registrationId");
CREATE        INDEX IF NOT EXISTS "SatimReconciliation_eventId_status_idx"      ON "SatimReconciliation"("eventId", "status");
CREATE        INDEX IF NOT EXISTS "SatimReconciliation_linkToken_idx"           ON "SatimReconciliation"("linkToken");
CREATE UNIQUE INDEX IF NOT EXISTS "SatimReconciliation_eventId_orderNumber_key" ON "SatimReconciliation"("eventId", "orderNumber");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SatimReconciliation_eventId_fkey') THEN
    ALTER TABLE "SatimReconciliation" ADD CONSTRAINT "SatimReconciliation_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SatimReconciliation_registrationId_fkey') THEN
    ALTER TABLE "SatimReconciliation" ADD CONSTRAINT "SatimReconciliation_registrationId_fkey"
      FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
