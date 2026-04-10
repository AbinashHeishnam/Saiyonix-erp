import api from "./client";

export type SubstitutionItem = {
  id: string;
  date: string;
  period?: { id: string; periodNumber: number; startTime?: string; endTime?: string };
  class?: { id: string; className: string };
  section?: { id: string; sectionName: string };
  absentTeacher?: { id: string; fullName: string | null };
  substituteTeacher?: { id: string; fullName: string | null };
  timetableSlot?: {
    id?: string;
    classSubject?: { subject?: { name?: string | null } | null } | null;
  };
  isClassTeacherSubstitution?: boolean;
  reason?: string | null;
};

export type AvailabilityItem = {
  periodId: string;
  periodNumber: number;
  freeTeachers: { id: string; fullName: string | null }[];
};

export type ApprovedLeaveItem = {
  id: string;
  teacherId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  leaveType?: string | null;
  teacher?: { id: string; fullName: string | null; employeeId?: string | null };
  slots?: {
    id: string;
    period: { id: string; periodNumber: number; startTime?: string | null; endTime?: string | null };
    class: { id: string; className: string | null };
    section: { id: string; sectionName: string | null };
    subject: { id: string; name: string | null };
  }[];
};

export async function getTeacherSubstitutionsToday() {
  const res = await api.get("/teacher/substitutions/today");
  const payload = res.data?.data ?? res.data;
  return Array.isArray(payload) ? (payload as SubstitutionItem[]) : (payload?.items ?? []);
}

export async function listAdminSubstitutions(params: {
  date?: string;
  teacherId?: string;
  classId?: string;
  academicYearId?: string;
  includeAvailability?: boolean;
  page?: number;
  limit?: number;
}) {
  const res = await api.get("/admin/substitutions", { params });
  const payload = res.data?.data ?? res.data;
  const items = payload?.items ?? payload ?? [];
  const availability = payload?.availability ?? [];
  const approvedLeaves = payload?.approvedLeaves ?? [];
  const meta = res.data?.meta ?? null;
  return { items, availability, approvedLeaves, meta };
}
