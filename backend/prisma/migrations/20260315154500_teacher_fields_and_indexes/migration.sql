-- Drop global unique index on employeeId
DROP INDEX "Teacher_employeeId_key";

-- Add new fields to Teacher
ALTER TABLE "Teacher"
ADD COLUMN "gender" TEXT,
ADD COLUMN "qualification" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "photoUrl" TEXT;

-- Add composite unique constraint for school-scoped employeeId
CREATE UNIQUE INDEX "Teacher_schoolId_employeeId_key"
ON "Teacher"("schoolId", "employeeId");

-- Add index for employeeId lookup
CREATE INDEX "Teacher_employeeId_idx"
ON "Teacher"("employeeId");

-- Add parentId index for faster lookups
CREATE INDEX "ParentStudentLink_parentId_idx"
ON "ParentStudentLink"("parentId");
