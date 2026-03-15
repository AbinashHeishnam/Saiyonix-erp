-- Drop global unique indexes for student identifiers
DROP INDEX "Student_registrationNumber_key";
DROP INDEX "Student_admissionNumber_key";

-- Add school-scoped unique indexes for student identifiers
CREATE UNIQUE INDEX "Student_schoolId_registrationNumber_key"
ON "Student"("schoolId", "registrationNumber");

CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key"
ON "Student"("schoolId", "admissionNumber");

-- Add performance indexes for Phase-1 queries
CREATE INDEX "Student_schoolId_deletedAt_idx"
ON "Student"("schoolId", "deletedAt");

CREATE INDEX "Class_schoolId_deletedAt_idx"
ON "Class"("schoolId", "deletedAt");

CREATE INDEX "Class_schoolId_academicYearId_idx"
ON "Class"("schoolId", "academicYearId");

CREATE INDEX "Section_classId_deletedAt_idx"
ON "Section"("classId", "deletedAt");

CREATE INDEX "StudentEnrollment_classId_idx"
ON "StudentEnrollment"("classId");

CREATE INDEX "StudentEnrollment_sectionId_idx"
ON "StudentEnrollment"("sectionId");

CREATE INDEX "Teacher_schoolId_deletedAt_idx"
ON "Teacher"("schoolId", "deletedAt");

CREATE INDEX "TeacherSubjectClass_teacherId_academicYearId_idx"
ON "TeacherSubjectClass"("teacherId", "academicYearId");

CREATE INDEX "TeacherSubjectClass_sectionId_idx"
ON "TeacherSubjectClass"("sectionId");

CREATE INDEX "TimetableSlot_sectionId_idx"
ON "TimetableSlot"("sectionId");

CREATE INDEX "TimetableSlot_teacherId_academicYearId_idx"
ON "TimetableSlot"("teacherId", "academicYearId");
