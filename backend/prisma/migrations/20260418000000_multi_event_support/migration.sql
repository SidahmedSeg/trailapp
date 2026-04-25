-- CreateTable: Event
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'trail',
    "description" TEXT,
    "date" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT 'Alger',
    "primaryColor" TEXT NOT NULL DEFAULT '#C42826',
    "logoPath" TEXT,
    "coverImagePath" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactLabel" TEXT,
    "distances" JSONB NOT NULL DEFAULT '[]',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "registrationDeadline" TIMESTAMP(3),
    "maxCapacity" INTEGER,
    "autoCloseOnExhaustion" BOOLEAN NOT NULL DEFAULT true,
    "bibStart" INTEGER NOT NULL DEFAULT 101,
    "bibEnd" INTEGER NOT NULL DEFAULT 1500,
    "bibPrefix" TEXT,
    "bibRangeLocked" BOOLEAN NOT NULL DEFAULT false,
    "priceInCentimes" INTEGER NOT NULL DEFAULT 200000,
    "photoPackPrice" INTEGER,
    "optionalFields" JSONB NOT NULL DEFAULT '{}',
    "termsText" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Event
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_active_idx" ON "Event"("active");
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- Migrate Settings → Event: insert first event from current Settings
INSERT INTO "Event" ("id", "slug", "name", "type", "date", "location",
    "facebookUrl", "instagramUrl", "websiteUrl",
    "registrationOpen", "registrationDeadline", "maxCapacity",
    "autoCloseOnExhaustion", "bibStart", "bibEnd", "bibPrefix", "bibRangeLocked",
    "priceInCentimes", "optionalFields", "active", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    'trail-mouflons-2026',
    "eventName",
    'trail',
    "eventDate",
    "eventCity",
    'https://www.facebook.com/p/Ligue-Algeroise-de-ski-et-des-sports-de-montagne-LASSM-100081974797044/',
    'https://www.instagram.com/lassm.dz/',
    'https://lassm.dz/',
    "registrationOpen",
    "registrationDeadline",
    "maxCapacity",
    "autoCloseOnExhaustion",
    "bibStart",
    "bibEnd",
    "bibPrefix",
    "bibRangeLocked",
    200000,
    '{}',
    true,
    'active',
    NOW(),
    NOW()
FROM "Settings"
WHERE "id" = 'default';

-- Add eventId to Registration (nullable first)
ALTER TABLE "Registration" ADD COLUMN "eventId" TEXT;

-- Backfill: link all existing registrations to the seed event
UPDATE "Registration" SET "eventId" = (SELECT "id" FROM "Event" WHERE "slug" = 'trail-mouflons-2026' LIMIT 1);

-- Make eventId NOT NULL
ALTER TABLE "Registration" ALTER COLUMN "eventId" SET NOT NULL;

-- Add optional fields columns to Registration
ALTER TABLE "Registration" ADD COLUMN "cardPan" TEXT;
ALTER TABLE "Registration" ADD COLUMN "selectedDistance" TEXT;
ALTER TABLE "Registration" ADD COLUMN "medicalCertificatePath" TEXT;
ALTER TABLE "Registration" ADD COLUMN "club" TEXT;
ALTER TABLE "Registration" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "Registration" ADD COLUMN "bestPerformance" TEXT;
ALTER TABLE "Registration" ADD COLUMN "previousParticipations" INTEGER;
ALTER TABLE "Registration" ADD COLUMN "shuttle" BOOLEAN;
ALTER TABLE "Registration" ADD COLUMN "bloodType" TEXT;
ALTER TABLE "Registration" ADD COLUMN "photoPack" BOOLEAN;

-- Clean up duplicate emails: keep the most recent registration per email, delete older duplicates
-- Only deletes pending/failed duplicates (success/manual are never duplicated due to app logic)
DELETE FROM "Registration" a USING "Registration" b
WHERE a.email = b.email AND a."eventId" = b."eventId"
  AND a."createdAt" < b."createdAt"
  AND a."paymentStatus" IN ('pending', 'failed');

-- Drop old email unique constraint, add compound unique
DROP INDEX "Registration_email_key";
CREATE UNIQUE INDEX "Registration_email_eventId_key" ON "Registration"("email", "eventId");

-- Add eventId index and FK
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop Settings table
DROP TABLE "Settings";
