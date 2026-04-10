import api from "./client";

export type ReportCardPayload = {
  studentId: string;
  examId: string;
  totalMarks: number;
  percentage: number;
  grade?: string | null;
  subjects: Array<{
    examSubjectId: string;
    marksObtained: number;
    maxMarks: number;
    passMarks: number;
    subjectName?: string;
  }>;
};

export async function getReportCard(examId: string, studentId?: string) {
  const res = await api.get(`/report-cards/${examId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function getReportCardPdf(examId: string, studentId?: string, force?: boolean) {
  const res = await api.get(`/report-cards/${examId}/pdf`, {
    params: studentId || force ? { ...(studentId ? { studentId } : {}), ...(force ? { force: true } : {}) } : undefined,
  });
  return res.data?.data ?? res.data;
}
