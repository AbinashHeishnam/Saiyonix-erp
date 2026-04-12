import api from "./client";

export async function listCertificateRequests(params?: { studentId?: string }) {
  const res = await api.get("/certificate/requests", { params });
  return res.data?.data ?? res.data;
}

export async function requestCertificate(payload: {
  type: string;
  reason?: string;
  studentId?: string;
}) {
  const res = await api.post("/certificate/request", payload);
  return res.data?.data ?? res.data;
}
