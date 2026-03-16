-- Add correction status enum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Make correctedAt optional
ALTER TABLE "AttendanceCorrection"
  ALTER COLUMN "correctedAt" DROP DEFAULT,
  ALTER COLUMN "correctedAt" DROP NOT NULL;

-- Add correction request fields
ALTER TABLE "AttendanceCorrection"
  ADD COLUMN "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "requestedById" TEXT,
  ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewRemarks" TEXT;
