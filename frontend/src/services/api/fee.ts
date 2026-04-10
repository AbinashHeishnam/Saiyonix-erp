import api from "./client";

export type FeeStatus = {
  baseAmount: number | null;
  scholarshipAmount: number | null;
  discountAmount: number | null;
  lateFee: number | null;
  finalAmount: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  dueDate?: string | null;
  status: "PAID" | "PARTIAL" | "PENDING" | "NOT_PUBLISHED" | string;
};

export async function getStudentFeeStatus(studentId: string) {
  const res = await api.get(`/fee/student/${studentId}`);
  return res.data?.data ?? res.data;
}

export async function createFeeStructure(payload: {
  classId: string;
  amount: number;
  academicYearId?: string;
  academicYear?: string;
  category?: string;
}) {
  const res = await api.post("/fee/structure", payload);
  return res.data?.data ?? res.data;
}

export async function publishFeeStructure(payload: {
  classId: string;
  academicYearId?: string;
  academicYear?: string;
  category?: string;
}) {
  const res = await api.post("/fee/publish", payload);
  return res.data?.data ?? res.data;
}

export async function createScholarship(payload: {
  title?: string;
  discountPercent?: number;
  classId?: string;
  sectionId?: string;
  admissionNumber?: string;
  academicYearId?: string;
  academicYear?: string;
}) {
  const res = await api.post("/fee/scholarships", payload);
  return res.data?.data ?? res.data;
}

export async function listScholarships(params?: { academicYearId?: string }) {
  const res = await api.get("/fee/scholarships", { params });
  return res.data?.data ?? res.data;
}

export async function updateScholarship(id: string, payload: {
  title?: string;
  discountPercent?: number;
  classId?: string;
  sectionId?: string;
  admissionNumber?: string;
  academicYearId?: string;
  academicYear?: string;
}) {
  const res = await api.patch(`/fee/scholarships/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteScholarship(id: string) {
  const res = await api.delete(`/fee/scholarships/${id}`);
  return res.data?.data ?? res.data;
}

export async function createDiscount(payload: {
  studentId?: string;
  classId?: string;
  sectionId?: string;
  amount: number;
  isPercent?: boolean;
  academicYearId?: string;
  academicYear?: string;
}) {
  const res = await api.post("/fee/discounts", payload);
  return res.data?.data ?? res.data;
}

export async function updateDiscount(id: string, payload: {
  studentId?: string;
  classId?: string;
  sectionId?: string;
  amount: number;
  isPercent?: boolean;
  academicYearId?: string;
  academicYear?: string;
}) {
  const res = await api.patch(`/fee/discounts/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteDiscount(id: string) {
  const res = await api.delete(`/fee/discounts/${id}`);
  return res.data?.data ?? res.data;
}

export async function listDiscounts(params?: { academicYearId?: string }) {
  const res = await api.get("/fee/discounts", { params });
  return res.data?.data ?? res.data;
}

export async function createFeeDeadline(payload: {
  dueDate: string;
  lateFeePercent?: number;
  classId?: string;
  academicYearId?: string;
  academicYear?: string;
}) {
  const res = await api.post("/fee/fee-deadlines", payload);
  return res.data?.data ?? res.data;
}

export async function listFeeDeadlines(params?: { academicYearId?: string }) {
  const res = await api.get("/fee/fee-deadlines", { params });
  return res.data?.data ?? res.data;
}

export async function listLateRecords(params?: { academicYearId?: string; classId?: string }) {
  const res = await api.get("/fee/late-records", { params });
  return res.data?.data ?? res.data;
}

export type FeeStructureSummary = {
  id: string;
  classId: string;
  className: string | null;
  academicYearId: string;
  academicYear: string | null;
  category: string | null;
  amount: number;
  isPublished: boolean;
  updatedAt: string;
};

export async function listFeeStructures(params?: {
  academicYearId?: string;
  classId?: string;
  category?: string;
  isPublished?: boolean;
}) {
  const res = await api.get("/fee/structure", { params });
  return (res.data?.data ?? res.data) as FeeStructureSummary[];
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
  return res.data?.data ?? res.data;
}

export async function getReceipt(paymentId: string, params?: { studentId?: string }) {
  const res = await api.get(`/fee/receipts/${paymentId}`, { params });
  return res.data?.data ?? res.data;
}
