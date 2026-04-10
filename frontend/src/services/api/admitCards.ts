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

export async function generateAdmitCards(examId: string) {
  const res = await api.post(`/admit-cards/${examId}/generate`);
  return res.data?.data ?? res.data;
}

export async function unlockAdmitCard(examId: string, studentId: string, reason?: string) {
  const res = await api.patch(`/admit-cards/${examId}/unlock`, { studentId, reason });
  return res.data?.data ?? res.data;
}

export async function listAdmitCardControls(examId?: string) {
  const res = await api.get(`/admin/admit-card/controls`, {
    params: examId ? { examId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function setAdmitCardPublishStatus(payload: {
  examId: string;
  isPublished: boolean;
}) {
  const res = await api.patch(`/admin/admit-card/publish`, payload);
  return res.data?.data ?? res.data;
}
