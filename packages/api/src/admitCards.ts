import api from "./client";

export type AdmitCardPayload = {
  studentId: string;
  examId: string;
  isLocked: boolean;
  lockReason?: string | null;
  admitCardNumber?: string;
  pdfUrl?: string | null;
};

export async function getAdmitCard(examId: string, studentId?: string) {
  const res = await api.get(`/admit-cards/${examId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function getAdmitCardPdf(examId: string, studentId?: string) {
  const res = await api.get(`/admit-cards/${examId}/pdf`, {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}
