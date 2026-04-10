import api from "./client";

export type FeeOverviewSnapshot = {
  academicYearId: string;
  hasSetup: boolean;
  totalStudents: number;
  totalCollected: number;
  totalPending: number;
  totalFees: number;
  paidStudents: number;
  unpaidStudents: number;
  collectionRate: number;
  termComparison: { term: string; collected: number }[];
  monthlyTrend: { month: string; collected: number }[];
  classWise: { className: string; collected: number; pending: number }[];
  paymentMethodSplit: { method: string; amount: number }[];
  topDefaulters?: { studentName: string; className: string | null; pendingAmount: number }[];
};

export async function getAdminFeeOverview(params?: { academicYearId?: string }) {
  const res = await api.get("/admin/fees/overview", {
    params: params?.academicYearId ? { academicYearId: params.academicYearId } : undefined,
  });
  return (res.data?.data ?? res.data) as FeeOverviewSnapshot;
}
