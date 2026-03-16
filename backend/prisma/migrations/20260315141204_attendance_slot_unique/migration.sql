/*
  Warnings:

  - You are about to drop the column `reviewedAt` on the `StudentLeave` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedById` on the `StudentLeave` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,timetableSlotId,attendanceDate]` on the table `StudentAttendance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'EMERGENCY', 'OTHER');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'EXCUSED';

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "StudentAttendance_studentId_attendanceDate_key";

-- AlterTable
ALTER TABLE "StudentLeave" DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "leaveType" "LeaveType";

-- AlterTable
ALTER TABLE "TeacherLeave" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "leaveType" "LeaveType";

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_attendanceDate_idx" ON "StudentAttendance"("studentId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_studentId_timetableSlotId_attendanceDate_key" ON "StudentAttendance"("studentId", "timetableSlotId", "attendanceDate");

-- CreateIndex
CREATE INDEX "StudentLeave_studentId_fromDate_toDate_idx" ON "StudentLeave"("studentId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "StudentLeave_status_idx" ON "StudentLeave"("status");

-- CreateIndex
CREATE INDEX "TeacherLeave_teacherId_fromDate_toDate_idx" ON "TeacherLeave"("teacherId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "TeacherLeave_status_idx" ON "TeacherLeave"("status");
