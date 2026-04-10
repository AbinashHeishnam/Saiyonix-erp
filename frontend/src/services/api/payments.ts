import api from "./client";

export async function createPaymentOrder(payload: {
  amount?: number;
  currency?: string;
  receipt?: string;
  metadata?: Record<string, unknown>;
  studentId?: string;
  academicYearId?: string;
  academicYear?: string;
  classId?: string;
}) {
  const res = await api.post("/payments/create-order", payload);
  return res.data?.data ?? res.data;
}

export async function verifyPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  studentId: string;
  amount: number;
  academicYearId?: string;
  errorMessage?: string;
}) {
  const res = await api.post("/payments/verify", payload);
  return res.data?.data ?? res.data;
}

export async function getRazorpayKey() {
  const res = await api.get("/payments/razorpay-key");
  return res.data?.data ?? res.data;
}
