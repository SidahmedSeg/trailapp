-- Volunteer QR token for the badge / public card page
ALTER TABLE "Volunteer" ADD COLUMN "qrToken" TEXT;
CREATE UNIQUE INDEX "Volunteer_qrToken_key" ON "Volunteer"("qrToken");
