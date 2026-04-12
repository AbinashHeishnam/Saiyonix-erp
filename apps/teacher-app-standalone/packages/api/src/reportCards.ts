import api from "./client";
import type { ReportCardPayload } from "@saiyonix/types";

export async function getReportCard(examId: string, studentId?: string) {
  const res = await api.get(`/report-cards/${examId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return (res.data?.data ?? res.data) as ReportCardPayload;
}

export async function getReportCardPdf(examId: string, studentId?: string, force?: boolean) {
  const res = await api.get(`/report-cards/${examId}/pdf`, {
    params: studentId || force ? { ...(studentId ? { studentId } : {}), ...(force ? { force: true } : {}) } : undefined,
  });
  return res.data?.data ?? res.data;
}
