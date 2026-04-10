import api from "./client";

export type Exam = {
  id: string;
  academicYearId: string;
  termNo: number;
  title: string;
  isPublished: boolean;
  isLocked: boolean;
  isFinalExam?: boolean;
  timetablePublishedAt?: string | null;
  createdAt?: string;
};

export type ExamSubject = {
  id: string;
  classSubjectId: string;
  maxMarks: number;
  passMarks: number;
  classSubject?: {
    classId?: string;
    class?: { className?: string };
    subject?: { name?: string };
  };
  timetable?: Array<{
    id: string;
    examDate: string;
    startTime: string;
    endTime: string;
    venue?: string | null;
  }>;
};

export type ExamDetail = Exam & { examSubjects: ExamSubject[] };

export async function listExams(params?: { academicYearId?: string; classId?: string; page?: number; limit?: number }) {
  const res = await api.get("/exams", { params });
  return res.data;
}

export async function registerForExam(payload: { examId: string; studentId?: string }) {
  const res = await api.post("/exams/register", payload);
  return res.data?.data ?? res.data;
}

export async function getExamById(id: string) {
  const res = await api.get(`/exams/${id}`);
  return res.data?.data ?? res.data;
}

export async function publishExam(id: string) {
  const res = await api.patch(`/exams/${id}/publish`);
  return res.data?.data ?? res.data;
}

export type ExamRegistrationSummary = {
  examId: string;
  status: string;
  createdAt: string;
  title: string | null;
  termNo: number | null;
  type: string | null;
};

export async function listExamRegistrations(studentId?: string) {
  const res = await api.get("/exams/registrations", {
    params: studentId ? { studentId } : undefined,
  });
  return (res.data?.data ?? res.data) as ExamRegistrationSummary[];
}

export async function listExamRegistrationsAdmin(examId: string) {
  const res = await api.get("/exams/registrations/admin", { params: { examId } });
  return res.data?.data ?? res.data;
}

export async function lockExam(id: string) {
  const res = await api.patch(`/exams/${id}/lock`);
  return res.data?.data ?? res.data;
}

export async function lockExamMarks(id: string) {
  const res = await api.patch(`/exams/${id}/lock-marks`);
  return res.data?.data ?? res.data;
}

export async function unlockExamMarks(id: string) {
  const res = await api.patch(`/exams/${id}/unlock-marks`);
  return res.data?.data ?? res.data;
}
