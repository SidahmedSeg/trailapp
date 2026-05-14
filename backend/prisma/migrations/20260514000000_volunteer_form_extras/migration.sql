-- Volunteer form rev — residence fields, skills, single-rule agreement, reject lifecycle
ALTER TABLE "Volunteer" ADD COLUMN "wilaya" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "commune" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "skills" JSONB;
ALTER TABLE "Volunteer" ADD COLUMN "otherSkills" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "agreedRules" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Volunteer" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Volunteer" ADD COLUMN "rejectedBy" TEXT;
