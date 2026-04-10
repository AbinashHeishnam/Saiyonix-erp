import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Table from "../../components/Table";
import Input from "../../components/Input";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import {
  getTeacherAssignedExams,
  getMarksEntryMatrix,
  submitExamMarksBulk,
} from "../../services/api/examWorkflow";

type AssignedExam = {
  examId: string;
  examTitle?: string;
  examType?: string | null;
  classId: string;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  marksStatus?: string | null;
  schedule?: {
    examDate?: string;
    startTime?: string;
    endTime?: string;
    shift?: string;
  } | null;
};

type SectionItem = { id: string; sectionName: string; classId: string };

type MatrixSubject = {
  examSubjectId: string;
  subjectId: string | null;
  subjectName: string | null;
  maxMarks: number;
  passMarks: number;
  marksStatus: string;
};

type MatrixStudent = {
  studentId: string;
  fullName: string;
  rollNumber?: number | null;
};

type MatrixMarkRow = {
  studentId: string;
  marks: Record<string, { marksObtained: number | null; isAbsent: boolean }>;
};

export default function MarksEntryPage() {
  const { data: assigned, loading, error } = useAsync(async () => {
    const res = await getTeacherAssignedExams();
    return (res ?? []) as AssignedExam[];
  }, []);

  const { data: sections } = useAsync(async () => {
    const res = await api.get("/sections", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, []);

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

  const assignedList = (assigned ?? []) as AssignedExam[];
  const sectionList = (sections ?? []) as SectionItem[];

  const examOptions = useMemo(() => {
    const map = new Map<string, string>();
    assignedList.forEach((item) => {
      if (item.examId) {
        map.set(item.examId, item.examTitle ?? item.examId);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [assignedList]);

  const classOptions = useMemo(() => {
    if (!selectedExamId) return [] as Array<{ id: string; label: string }>;
    const map = new Map<string, string>();
    assignedList
      .filter((item) => item.examId === selectedExamId)
      .forEach((item) => {
        if (item.classId) {
          map.set(item.classId, item.className ?? item.classId);
        }
      });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
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
    const sectionIds = new Set(
      assignedSections.map((item) => item.sectionId).filter(Boolean) as string[]
    );
    return sectionList.filter((sec) => sectionIds.has(sec.id));
  }, [assignedList, sectionList, selectedExamId, selectedClassId]);

  const { data: matrix, loading: loadingMatrix, error: matrixError, refresh } = useAsync(async () => {
    if (!selectedExamId || !selectedClassId || !selectedSectionId) return null;
    return await getMarksEntryMatrix({
      examId: selectedExamId,
      classId: selectedClassId,
      sectionId: selectedSectionId,
    });
  }, [selectedExamId, selectedClassId, selectedSectionId]);

  const subjects = (matrix?.subjects ?? []) as MatrixSubject[];
  const students = (matrix?.students ?? []) as MatrixStudent[];
  const markRows = (matrix?.marks ?? []) as MatrixMarkRow[];
  const eligibilityBlocked =
    (matrixError ?? "").includes("Admit card not published") ||
    (matrixError ?? "").includes("Not registered for exam");

  useEffect(() => {
    if (!matrix) return;
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
    markRows.forEach((row) => {
      const rowMarks: Record<string, string> = {};
      Object.entries(row.marks).forEach(([examSubjectId, value]) => {
        rowMarks[examSubjectId] =
          value.marksObtained != null ? String(value.marksObtained) : "";
      });
      nextMarks[row.studentId] = rowMarks;
    });
    setMarksByStudent(nextMarks);
    setInitialMarks(nextMarks);
    setFormError(null);
    setMessage(null);
    setIsEditing(false);
  }, [matrix, subjects.length, markRows.length]);

  const allSubmitted = subjects.length > 0 && subjects.every((subject) => subject.marksStatus === "SUBMITTED");
  const inputsDisabled = eligibilityBlocked || (allSubmitted && !isEditing);

  const hasChanges = () => {
    for (const subject of subjects) {
      const total = totalMarksBySubject[subject.examSubjectId] ?? "";
      const pass = passMarksBySubject[subject.examSubjectId] ?? "";
      if (total !== (initialTotals[subject.examSubjectId] ?? "")) return true;
      if (pass !== (initialPass[subject.examSubjectId] ?? "")) return true;
    }
    for (const student of students) {
      const row = marksByStudent[student.studentId] ?? {};
      const initialRow = initialMarks[student.studentId] ?? {};
      for (const subject of subjects) {
        const value = row[subject.examSubjectId] ?? "";
        const initialValue = initialRow[subject.examSubjectId] ?? "";
        if (value !== initialValue) return true;
      }
    }
    return false;
  };

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
        for (const student of students) {
          const value = marksByStudent[student.studentId]?.[subject.examSubjectId];
          if (value === undefined || value === "") {
            setFormError("Fill marks for all students and subjects.");
            return;
          }
        }
      }

      if (allSubmitted && isEditing && !hasChanges()) {
        setFormError("No changes detected. Update marks before resubmitting.");
        return;
      }

      const subjectsPayload = subjects.map((subject) => {
        const items = students.map((student) => ({
          studentId: student.studentId,
          marksObtained: Number(marksByStudent[student.studentId]?.[subject.examSubjectId] ?? 0),
        }));
        return {
          subjectId: subject.subjectId ?? "",
          totalMarks: Number(totalMarksBySubject[subject.examSubjectId] ?? 0),
          passMarks: Number(passMarksBySubject[subject.examSubjectId] ?? 0),
          items,
        };
      });

      await submitExamMarksBulk({
        examId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        subjects: subjectsPayload,
      });

      setMessage(allSubmitted ? "Marks updated successfully." : "Marks submitted successfully.");
      refresh();
    } catch (err: unknown) {
      setFormError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to submit marks"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Marks Entry" subtitle="Enter marks for all subjects" />

      <Card title="Select Exam & Class">
        {loading ? (
          <LoadingState label="Loading assignments" />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Exam"
              value={selectedExamId}
              onChange={(event) => {
                setSelectedExamId(event.target.value);
                setSelectedClassId("");
                setSelectedSectionId("");
              }}
            >
              <option value="">Select exam</option>
              {examOptions.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.label}
                </option>
              ))}
            </Select>
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(event) => {
                setSelectedClassId(event.target.value);
                setSelectedSectionId("");
              }}
              disabled={!selectedExamId}
            >
              <option value="">Select class</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.label}
                </option>
              ))}
            </Select>
            <Select
              label="Section"
              value={selectedSectionId}
              onChange={(event) => setSelectedSectionId(event.target.value)}
              disabled={!selectedClassId}
            >
              <option value="">Select section</option>
              {sectionOptions.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.sectionName}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <Card title="Marks Entry">
        {loadingMatrix ? (
          <LoadingState label="Loading subjects" />
        ) : matrixError ? (
          <p className="text-sm text-sunrise-600">{matrixError}</p>
        ) : matrix ? (
          <>
            {subjects.length ? (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {subjects.map((subject) => (
                  <div key={subject.examSubjectId} className="rounded-xl border border-ink-100 p-3">
                    <p className="text-sm font-semibold text-ink-800">{subject.subjectName ?? "Subject"}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {subject.marksStatus === "SUBMITTED" ? "Submitted" : "Pending"}
                    </p>
                    <div className="mt-2 grid gap-2">
                      <Input
                        label="Total Marks"
                        type="number"
                        disabled={inputsDisabled}
                        value={totalMarksBySubject[subject.examSubjectId] ?? ""}
                        onChange={(event) =>
                          setTotalMarksBySubject((prev) => ({
                            ...prev,
                            [subject.examSubjectId]: event.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Pass Marks"
                        type="number"
                        disabled={inputsDisabled}
                        value={passMarksBySubject[subject.examSubjectId] ?? ""}
                        onChange={(event) =>
                          setPassMarksBySubject((prev) => ({
                            ...prev,
                            [subject.examSubjectId]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No subjects" description="No subjects assigned for this exam." />
            )}

            {subjects.length && students.length ? (
              <Table columns={["Roll", "Student", ...subjects.map((s) => s.subjectName ?? "Subject")]}
              >
                {students.map((student) => (
                  <tr key={student.studentId} className="rounded-lg bg-white shadow-soft">
                    <td className="px-3 py-3">{student.rollNumber ?? "Pending"}</td>
                    <td className="px-3 py-3">{student.fullName}</td>
                    {subjects.map((subject) => (
                      <td key={subject.examSubjectId} className="px-3 py-3">
                        <input
                          type="number"
                          disabled={inputsDisabled}
                          className="w-24 rounded-lg border border-ink-200 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          value={marksByStudent[student.studentId]?.[subject.examSubjectId] ?? ""}
                          onChange={(event) =>
                            setMarksByStudent((prev) => ({
                              ...prev,
                              [student.studentId]: {
                                ...(prev[student.studentId] ?? {}),
                                [subject.examSubjectId]: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Table>
            ) : null}

            {formError && <p className="mt-3 text-sm text-sunrise-600">{formError}</p>}
            {message && <p className="mt-3 text-sm text-jade-600">{message}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {allSubmitted && !isEditing ? (
                <>
                  <span className="rounded-full bg-jade-100 px-3 py-1 text-xs font-semibold text-jade-700">
                    Marks Submitted
                  </span>
                  <Button variant="secondary" onClick={() => setIsEditing(true)}>
                    Edit Marks
                  </Button>
                </>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || !subjects.length || eligibilityBlocked}>
                  {submitting
                    ? "Submitting..."
                    : allSubmitted
                      ? "Resubmit Marks"
                      : "Submit All Subjects"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="Select a class" description="Choose exam, class, and section to start." />
        )}
      </Card>
    </div>
  );
}
