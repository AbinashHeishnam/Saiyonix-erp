/*
  Warnings:

  - A unique constraint covering the columns `[sectionId,dayOfWeek,periodId,effectiveFrom]` on the table `TimetableSlot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sectionId,dayOfWeek,periodId,classSubjectId,effectiveFrom]` on the table `TimetableSlot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teacherId,academicYearId,dayOfWeek,periodId,effectiveFrom]` on the table `TimetableSlot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AcademicCalendarEventType" AS ENUM ('SESSION_START', 'SESSION_END', 'HOLIDAY', 'TEMPORARY_HOLIDAY', 'HALF_DAY', 'EXAM_START', 'EXAM_END', 'IMPORTANT_NOTICE', 'OTHER');

-- DropIndex
DROP INDEX "TimetableSlot_sectionId_dayOfWeek_periodId_classSubjectId_key";

-- DropIndex
DROP INDEX "TimetableSlot_sectionId_dayOfWeek_periodId_key";

-- DropIndex
DROP INDEX "TimetableSlot_teacherId_academicYearId_dayOfWeek_periodId_key";

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "calendarEventId" TEXT;

-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "effectiveFrom" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AcademicCalendarEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "AcademicCalendarEventType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "affectsAttendance" BOOLEAN NOT NULL DEFAULT false,
    "affectsClasses" BOOLEAN NOT NULL DEFAULT false,
    "isTemporaryTodayOnly" BOOLEAN NOT NULL DEFAULT false,
    "notifyUsers" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_schoolId_idx" ON "AcademicCalendarEvent"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_academicYearId_idx" ON "AcademicCalendarEvent"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_startDate_idx" ON "AcademicCalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarEvent_endDate_idx" ON "AcademicCalendarEvent"("endDate");

-- CreateIndex
CREATE INDEX "Holiday_calendarEventId_idx" ON "Holiday"("calendarEventId");

-- CreateIndex
CREATE INDEX "TimetableSlot_sectionId_academicYearId_effectiveFrom_idx" ON "TimetableSlot"("sectionId", "academicYearId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_sectionId_dayOfWeek_periodId_effectiveFrom_key" ON "TimetableSlot"("sectionId", "dayOfWeek", "periodId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_sectionId_dayOfWeek_periodId_classSubjectId_e_key" ON "TimetableSlot"("sectionId", "dayOfWeek", "periodId", "classSubjectId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_teacherId_academicYearId_dayOfWeek_periodId_e_key" ON "TimetableSlot"("teacherId", "academicYearId", "dayOfWeek", "periodId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarEvent" ADD CONSTRAINT "AcademicCalendarEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "AcademicCalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
