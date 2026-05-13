-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN "availableRaceDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Volunteer" ADD COLUMN "canArriveEarly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Volunteer" ADD COLUMN "previousExperience" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "languagesSpoken" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "canStandLongTime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Volunteer" ADD COLUMN "tshirtSize" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "agreedInstructions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Volunteer" ADD COLUMN "agreedBriefing" BOOLEAN NOT NULL DEFAULT false;
