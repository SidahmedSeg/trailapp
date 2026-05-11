-- CreateTable
CREATE TABLE "LateRegistrationLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bibNumber" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentToEmail" TEXT,
    "sentAt" TIMESTAMP(3),
    "registrationId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LateRegistrationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LateRegistrationLink_token_key" ON "LateRegistrationLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LateRegistrationLink_registrationId_key" ON "LateRegistrationLink"("registrationId");

-- CreateIndex
CREATE INDEX "LateRegistrationLink_token_idx" ON "LateRegistrationLink"("token");

-- CreateIndex
CREATE INDEX "LateRegistrationLink_eventId_status_idx" ON "LateRegistrationLink"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LateRegistrationLink_eventId_bibNumber_status_key" ON "LateRegistrationLink"("eventId", "bibNumber", "status");

-- AddForeignKey
ALTER TABLE "LateRegistrationLink" ADD CONSTRAINT "LateRegistrationLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateRegistrationLink" ADD CONSTRAINT "LateRegistrationLink_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
