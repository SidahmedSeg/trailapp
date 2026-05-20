-- Declare ScannerSession.registrationId as a proper FK so Prisma can use
-- `include: { registration: { … } }` instead of manual map+merge logic.
--
-- onDelete NO ACTION mirrors the legacy soft-relation behavior (ScannerSession
-- rows survive even if the underlying Registration is later removed).

-- CreateIndex
CREATE INDEX "ScannerSession_registrationId_idx"
  ON "ScannerSession"("registrationId");

-- AddForeignKey
ALTER TABLE "ScannerSession"
  ADD CONSTRAINT "ScannerSession_registrationId_fkey"
  FOREIGN KEY ("registrationId")
  REFERENCES "Registration"("id")
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
