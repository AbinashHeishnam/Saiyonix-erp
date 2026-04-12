import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMarksEntryMatrix, getTeacherAssignedExams, listSections, submitExamMarksBulk } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";

type AssignedExam = {
  examId: string;
  examTitle?: string | null;
  classId: string;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  marksStatus?: string | null;
};

type SectionItem = { id: string; sectionName: string; classId: string };

export default function TeacherMarksScreen() {
  const assignedQuery = useQuery({
    queryKey: ["teacher", "assigned-exams"],
    queryFn: getTeacherAssignedExams,
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: () => listSections({ page: 1, limit: 200 }),
  });

  const assignedList = (assignedQuery.data ?? []) as AssignedExam[];
  const sectionList = (sectionsQuery.data ?? []) as SectionItem[];

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [totalMarksBySubject, setTotalMarksBySubject] = useState<Record<string, string>>({});
  const [passMarksBySubject, setPassMarksBySubject] = useState<Record<string, string>>({});
  const [marksByStudent, setMarksByStudent] = useState<Record<string, Record<string, string>>>({});
  const [initialTotals, setInitialTotals] = useState<Record<string, string>>({});
  const [initialPass, setInitialPass] = useState<Record<string, string>>({});
  const [initialMarks, setInitialMarks] = useState<Record<string, Record<string, string>>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const examOptions = useMemo(() => {
    const map = new Map<string, string>();
    assignedList.forEach((item) => {
      if (item.examId) map.set(item.examId, item.examTitle ?? item.examId);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [assignedList]);

  const classOptions = useMemo(() => {
    if (!selectedExamId) return [];
    const map = new Map<string, string>();
    assignedList
      .filter((item) => item.examId === selectedExamId)
      .forEach((item) => {
        if (item.classId) map.set(item.classId, item.className ?? item.classId);
      });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [assignedList, selectedExamId]);

  const sectionOptions = useMemo(() => {
    if (!selectedExamId || !selectedClassId) return [] as SectionItem[];
    const assignedSections = assignedList.filter(
      (item) => item.examId === selectedExamId && item.classId === selectedClassId
    );
    const hasAllSections = assignedSections.some((item) => !item.sectionId);
    if (hasAllSections) {
      return sectionList.filter((sec) => sec.classId === selectedClassId);
    }
    const sectionIds = new Set(assignedSections.map((item) => item.sectionId).filter(Boolean) as string[]);
    return sectionList.filter((sec) => sectionIds.has(sec.id));
  }, [assignedList, sectionList, selectedExamId, selectedClassId]);

  const matrixQuery = useQuery({
    queryKey: ["marks-entry-matrix", selectedExamId, selectedClassId, selectedSectionId],
    queryFn: () =>
      getMarksEntryMatrix({
        examId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
      }),
    enabled: Boolean(selectedExamId && selectedClassId && selectedSectionId),
  });

  const subjects = (matrixQuery.data?.subjects ?? []) as any[];
  const students = (matrixQuery.data?.students ?? []) as any[];
  const markRows = (matrixQuery.data?.marks ?? []) as any[];

  useEffect(() => {
    if (!matrixQuery.data) return;
    const nextTotal: Record<string, string> = {};
    const nextPass: Record<string, string> = {};
    subjects.forEach((subject) => {
      nextTotal[subject.examSubjectId] = String(subject.maxMarks ?? "");
      nextPass[subject.examSubjectId] = String(subject.passMarks ?? "");
    });
    setTotalMarksBySubject(nextTotal);
    setPassMarksBySubject(nextPass);
    setInitialTotals(nextTotal);
    setInitialPass(nextPass);

    const nextMarks: Record<string, Record<string, string>> = {};
    markRows.forEach((row: any) => {
      const rowMarks: Record<string, string> = {};
      Object.entries(row.marks ?? {}).forEach(([examSubjectId, value]: any) => {
        rowMarks[examSubjectId] = value?.marksObtained != null ? String(value.marksObtained) : "";
      });
      nextMarks[row.studentId] = rowMarks;
    });
    setMarksByStudent(nextMarks);
    setInitialMarks(nextMarks);
    setFormError(null);
    setMessage(null);
    setIsEditing(false);
  }, [matrixQuery.data, subjects.length, markRows.length]);

  const allSubmitted = subjects.length > 0 && subjects.every((subject) => subject.marksStatus === "SUBMITTED");
  const inputsDisabled = allSubmitted && !isEditing;

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    setMessage(null);
    try {
      if (!subjects.length || !students.length) {
        setFormError("No subjects or students found.");
        return;
      }

      if (allSubmitted && !isEditing) {
        setFormError("Marks are already submitted for this section.");
        return;
      }

      for (const subject of subjects) {
        const total = Number(totalMarksBySubject[subject.examSubjectId]);
        const pass = Number(passMarksBySubject[subject.examSubjectId]);
        if (!total || total <= 0) {
          setFormError(`Total marks required for ${subject.subjectName ?? "subject"}.`);
          return;
        }
        if (pass > total) {
          setFormError(`Pass marks cannot exceed total for ${subject.subjectName ?? "subject"}.`);
          return;
        }
      }

      const payloadSubjects = subjects.map((subject) => {
        const items = students.map((student) => {
          const value = marksByStudent[student.studentId]?.[subject.examSubjectId] ?? "";
          const isAbsent = value.trim().toLowerCase() === "a";
          const marksObtained = isAbsent ? 0 : Number(value || 0);
          return { studentId: student.studentId, marksObtained, isAbsent };
        });
        return {
          subjectId: subject.subjectId ?? subject.examSubjectId,
          totalMarks: Number(totalMarksBySubject[subject.examSubjectId] ?? 0),
          passMarks: Number(passMarksBySubject[subject.examSubjectId] ?? 0),
          items,
        };
      });

      await submitExamMarksBulk({
        examId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        subjects: payloadSubjects,
      });

      setMessage(allSubmitted ? "Marks updated successfully." : "Marks submitted successfully.");
      matrixQuery.refetch();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? "Failed to submit marks.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = assignedQuery.isLoading || sectionsQuery.isLoading;

  return (
    <PageShell loading={isLoading} loadingLabel="Loading marks workspace">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Marks Entry" subtitle="Enter marks for all subjects" />

      {assignedQuery.error || sectionsQuery.error ? <ErrorState message="Unable to load marks entry context." /> : null}

      <Card title="Select Exam & Section">
        <View style={styles.filters}>
          <Select
            label="Exam"
            value={selectedExamId}
            onChange={setSelectedExamId}
            options={examOptions}
            placeholder="Choose exam"
          />
          <Select
            label="Class"
            value={selectedClassId}
            onChange={(value) => {
              setSelectedClassId(value);
              setSelectedSectionId("");
            }}
            options={classOptions}
            placeholder="Choose class"
          />
          <Select
            label="Section"
            value={selectedSectionId}
            onChange={setSelectedSectionId}
            options={sectionOptions.map((sec) => ({ value: sec.id, label: sec.sectionName }))}
            placeholder="Choose section"
          />
        </View>
      </Card>

      {matrixQuery.isLoading ? <LoadingState /> : null}
      {matrixQuery.error ? <ErrorState message="Unable to load marks matrix." /> : null}

      {selectedExamId && selectedClassId && selectedSectionId ? (
        subjects.length ? (
          <View style={styles.section}>
            <Card title="Subjects">
              <View style={styles.subjectGrid}>
                {subjects.map((subject) => (
                  <View key={subject.examSubjectId} style={styles.subjectCard}>
                    <Text style={styles.subjectTitle}>{subject.subjectName ?? "Subject"}</Text>
                    <Input
                      label="Total Marks"
                      value={totalMarksBySubject[subject.examSubjectId] ?? ""}
                      onChangeText={(value) =>
                        setTotalMarksBySubject((prev) => ({ ...prev, [subject.examSubjectId]: value }))
                      }
                      keyboardType="numeric"
                    />
                    <Input
                      label="Pass Marks"
                      value={passMarksBySubject[subject.examSubjectId] ?? ""}
                      onChangeText={(value) =>
                        setPassMarksBySubject((prev) => ({ ...prev, [subject.examSubjectId]: value }))
                      }
                      keyboardType="numeric"
                    />
                    <Text style={styles.subjectMeta}>Status: {subject.marksStatus ?? "PENDING"}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card title="Student Marks">
              <View style={styles.helperRow}>
                <Text style={styles.helperText}>Enter marks or use "A" for absent.</Text>
                {allSubmitted ? (
                  <Button
                    title={isEditing ? "Stop Editing" : "Edit Marks"}
                    variant="secondary"
                    onPress={() => setIsEditing((prev) => !prev)}
                  />
                ) : null}
              </View>
              {students.length ? (
                <View style={styles.studentList}>
                  {students.map((student) => (
                    <View key={student.studentId} style={styles.studentCard}>
                      <Text style={styles.studentName}>
                        {student.fullName ?? "Student"} {student.rollNumber ? `• Roll ${student.rollNumber}` : ""}
                      </Text>
                      {subjects.map((subject) => (
                        <Input
                          key={`${student.studentId}-${subject.examSubjectId}`}
                        label={subject.subjectName ?? "Subject"}
                        value={marksByStudent[student.studentId]?.[subject.examSubjectId] ?? ""}
                        onChangeText={(value) =>
                          setMarksByStudent((prev) => ({
                            ...prev,
                            [student.studentId]: {
                              ...(prev[student.studentId] ?? {}),
                              [subject.examSubjectId]: value,
                            },
                          }))
                        }
                          keyboardType="default"
                        helper="Enter number or A"
                        inputSize="sm"
                        {...(inputsDisabled ? { helper: "Marks locked" } : {})}
                      />
                    ))}
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState title="No students found" subtitle="Students will appear once the section is loaded." />
              )}
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              {message ? <Text style={styles.successText}>{message}</Text> : null}
              <Button
                title={submitting ? "Submitting..." : allSubmitted ? "Update Marks" : "Submit Marks"}
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || inputsDisabled}
              />
            </Card>
          </View>
        ) : (
          <Card>
            <EmptyState title="No marks matrix" subtitle="No subjects available for the selected exam." />
          </Card>
        )
      ) : (
        <Card>
          <EmptyState title="Select an exam" subtitle="Choose exam, class, and section to start." />
        </Card>
      )}
    </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink[50],
  },
  content: {
    padding: 20,
    gap: 16,
  },
  filters: {
    gap: 12,
  },
  section: {
    gap: 16,
  },
  subjectGrid: {
    gap: 12,
  },
  subjectCard: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  subjectMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helperText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    flex: 1,
  },
  studentList: {
    gap: 14,
    marginTop: 12,
  },
  studentCard: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  studentName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.rose[500],
    fontFamily: typography.fontBody,
  },
  successText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
  },
});
