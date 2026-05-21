-- AlterTable
ALTER TABLE "Registration"
  ADD COLUMN "pickedUpAt"               TIMESTAMP(3),
  ADD COLUMN "pickedUpByName"           TEXT,
  ADD COLUMN "pickedUpByPhone"          TEXT,
  ADD COLUMN "pickedUpByCin"            TEXT,
  ADD COLUMN "pickedUpByCinPhotoPath"   TEXT,
  ADD COLUMN "pickedUpByRelation"       TEXT,
  ADD COLUMN "pickedUpByRegistrationId" TEXT;

-- AddForeignKey
ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_pickedUpByRegistrationId_fkey"
  FOREIGN KEY ("pickedUpByRegistrationId")
  REFERENCES "Registration"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Registration_pickedUpByRegistrationId_idx"
  ON "Registration"("pickedUpByRegistrationId");
