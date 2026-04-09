-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "phoneCountryCode" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "countryOfResidence" TEXT NOT NULL,
    "wilaya" TEXT,
    "commune" TEXT,
    "ville" TEXT,
    "emergencyPhoneCountryCode" TEXT NOT NULL,
    "emergencyPhoneNumber" TEXT NOT NULL,
    "emergencyPhone" TEXT NOT NULL,
    "tshirtSize" TEXT NOT NULL,
    "runnerLevel" TEXT NOT NULL,
    "declarationFit" BOOLEAN NOT NULL DEFAULT false,
    "declarationRules" BOOLEAN NOT NULL DEFAULT false,
    "declarationImage" BOOLEAN NOT NULL DEFAULT false,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "bibNumber" INTEGER,
    "qrToken" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "transactionNumber" TEXT,
    "approvalCode" TEXT,
    "paymentAmount" INTEGER NOT NULL DEFAULT 200000,
    "paymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "distributedAt" TIMESTAMP(3),
    "distributedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "inviteAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerSession" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "bibNumber" INTEGER NOT NULL,
    "runnerName" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'qr',

    CONSTRAINT "ScannerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "registrationDeadline" TIMESTAMP(3),
    "maxCapacity" INTEGER,
    "bibStart" INTEGER NOT NULL DEFAULT 101,
    "bibEnd" INTEGER NOT NULL DEFAULT 1500,
    "bibPrefix" TEXT,
    "bibRangeLocked" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseOnExhaustion" BOOLEAN NOT NULL DEFAULT true,
    "eventName" TEXT NOT NULL DEFAULT 'Trail des Mouflons d''Or 2026',
    "eventDate" TIMESTAMP(3),
    "eventCity" TEXT NOT NULL DEFAULT 'Alger',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_email_key" ON "Registration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_bibNumber_key" ON "Registration"("bibNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_qrToken_key" ON "Registration"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_transactionId_key" ON "Registration"("transactionId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "Registration_paymentStatus_idx" ON "Registration"("paymentStatus");

-- CreateIndex
CREATE INDEX "Registration_lastName_firstName_idx" ON "Registration"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "Registration"("email");

-- CreateIndex
CREATE INDEX "Registration_bibNumber_idx" ON "Registration"("bibNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_inviteToken_key" ON "AdminUser"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "EmailTemplate"("name");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_adminUsername_idx" ON "ActivityLog"("adminUsername");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
