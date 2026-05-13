-- AlterTable
ALTER TABLE "Event" ADD COLUMN "volunteersOpen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "volunteerId" TEXT,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "nationality" TEXT,
    "motivation" TEXT,
    "cvPath" TEXT,
    "idPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "interviewSlots" JSONB,
    "interviewSentAt" TIMESTAMP(3),
    "interviewSentTo" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_eventId_volunteerId_key" ON "Volunteer"("eventId", "volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_eventId_email_key" ON "Volunteer"("eventId", "email");

-- CreateIndex
CREATE INDEX "Volunteer_eventId_status_idx" ON "Volunteer"("eventId", "status");

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
