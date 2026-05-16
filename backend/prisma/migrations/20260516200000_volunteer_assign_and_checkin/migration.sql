-- Rename existing volunteers_manager role to admin_volunteers
UPDATE "AdminUser" SET "role" = 'admin_volunteers' WHERE "role" = 'volunteers_manager';

-- Assignment to a team leader + race-day check-in
ALTER TABLE "Volunteer" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "assignedAt"   TIMESTAMP(3);
ALTER TABLE "Volunteer" ADD COLUMN "assignedBy"   TEXT;
ALTER TABLE "Volunteer" ADD COLUMN "checkedInAt"  TIMESTAMP(3);
ALTER TABLE "Volunteer" ADD COLUMN "checkedInBy"  TEXT;

-- FK from Volunteer.assignedToId → AdminUser.id (nullable, SET NULL on AdminUser delete)
ALTER TABLE "Volunteer"
  ADD CONSTRAINT "Volunteer_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for "list volunteers assigned to this admin"
CREATE INDEX "Volunteer_assignedToId_idx" ON "Volunteer"("assignedToId");
