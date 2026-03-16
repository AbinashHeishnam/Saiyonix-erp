-- CreateIndex
CREATE INDEX "AdmitCard_examId_idx" ON "AdmitCard"("examId");

-- CreateIndex
CREATE INDEX "Assignment_classSubjectId_idx" ON "Assignment"("classSubjectId");

-- CreateIndex
CREATE INDEX "Assignment_sectionId_dueAt_idx" ON "Assignment"("sectionId", "dueAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_submittedAt_idx" ON "AssignmentSubmission"("assignmentId", "submittedAt");

-- CreateIndex
CREATE INDEX "ExamSubject_classSubjectId_idx" ON "ExamSubject"("classSubjectId");

-- CreateIndex
CREATE INDEX "ExamTimetable_examDate_idx" ON "ExamTimetable"("examDate");

-- CreateIndex
CREATE INDEX "Mark_examSubjectId_idx" ON "Mark"("examSubjectId");

-- CreateIndex
CREATE INDEX "Note_classSubjectId_idx" ON "Note"("classSubjectId");

-- CreateIndex
CREATE INDEX "Note_sectionId_createdAt_idx" ON "Note"("sectionId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_examId_idx" ON "RankSnapshot"("examId");

-- CreateIndex
CREATE INDEX "RankSnapshot_examId_classRank_idx" ON "RankSnapshot"("examId", "classRank");

-- CreateIndex
CREATE INDEX "ReportCard_examId_idx" ON "ReportCard"("examId");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_academicYearId_idx" ON "StudentAttendance"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_sectionId_rollNumber_idx" ON "StudentEnrollment"("sectionId", "rollNumber");

-- CreateIndex
CREATE INDEX "SyllabusProgressLog_syllabusTopicId_idx" ON "SyllabusProgressLog"("syllabusTopicId");
