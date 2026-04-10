import api from "./client";

export async function getPaymentLogs(params: {
  studentName?: string;
  studentId?: string;
  status?: "SUCCESS" | "FAILED" | "";
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await api.get("/admin/payments/logs", { params });
  return res.data?.data ?? res.data;
}

export async function downloadPaymentReceipt(paymentId: string) {
  const res = await api.get(`/admin/payments/${paymentId}/receipt`, {
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function createManualPayment(payload: {
  studentId: string;
  feeTermId: string;
  amount: number;
  method: "CASH" | "ONLINE";
  transactionId?: string;
}) {
  const res = await api.post("/admin/payments/manual", payload);
  return res.data?.data ?? res.data;
}
