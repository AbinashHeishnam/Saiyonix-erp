import api from "./client";
import type { Exam, ExamDetail, ExamRegistrationSummary } from "@saiyonix/types";

export async function listExams(params?: {
  academicYearId?: string;
  classId?: string;
  page?: number;
  limit?: number;
}) {
  const res = await api.get("/exams", { params });
  return res.data;
}

export async function registerForExam(payload: { examId: string; studentId?: string }) {
  const res = await api.post("/exams/register", payload);
  return res.data?.data ?? res.data;
}

export async function getExamById(id: string) {
  const res = await api.get(`/exams/${id}`);
  return (res.data?.data ?? res.data) as ExamDetail;
}

export async function listExamRegistrations(studentId?: string) {
  const res = await api.get("/exams/registrations", {
    params: studentId ? { studentId } : undefined,
  });
  return (res.data?.data ?? res.data) as ExamRegistrationSummary[];
}

export async function getStudentExamRoutine(studentId?: string) {
  const res = await api.get("/exam/student/me", {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export type ExamListResponse = {
  data?: Exam[];
  meta?: { page?: number; limit?: number; total?: number };
};
