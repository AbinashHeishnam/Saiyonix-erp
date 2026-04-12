import api from "./client";
import type { FeeStatus, ReceiptItem } from "@saiyonix/types";

export async function getStudentFeeStatus(studentId: string) {
  const res = await api.get(`/fee/student/${studentId}`);
  return (res.data?.data ?? res.data) as FeeStatus;
}

export async function payFee(payload: {
  studentId?: string;
  amount: number;
  academicYearId?: string | null;
  academicYear?: string | null;
  classId?: string | null;
  payment?: { orderId: string; paymentId: string; signature: string } | null;
}) {
  const res = await api.post("/fee/pay", payload);
  return res.data?.data ?? res.data;
}

export async function listReceipts(params?: { studentId?: string }) {
  const res = await api.get("/fee/receipts", { params });
  return (res.data?.data ?? res.data) as ReceiptItem[];
}

export async function getReceipt(paymentId: string, params?: { studentId?: string }) {
  const res = await api.get(`/fee/receipts/${paymentId}`, { params });
  return res.data?.data ?? res.data;
}
