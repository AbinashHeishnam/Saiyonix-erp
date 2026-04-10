import api from "./client";

export type ResultSubject = {
  examSubjectId: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  subjectName?: string;
};

export type ResultPayload = {
  studentId: string;
  examId: string;
  totalMarks: number;
  percentage: number;
  grade?: string | null;
  subjects: ResultSubject[];
};

export async function getResults(examId: string, studentId?: string) {
  const res = await api.get(`/results/${examId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function publishResults(examId: string) {
  const res = await api.patch(`/results/${examId}/publish`);
  return res.data?.data ?? res.data;
}

export async function recomputeResults(examId: string) {
  const res = await api.post(`/results/${examId}/recompute`);
  return res.data?.data ?? res.data;
}
