import api from "./client";
import type {
  AttendanceContext,
  AttendanceRecord,
  AttendanceSummary,
  ClassTeacherAttendanceContext,
} from "@saiyonix/types";

export async function listStudentAttendance(params: {
  studentId?: string;
  sectionId?: string;
  academicYearId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  const res = await api.get("/student-attendance", { params });
  return res.data;
}

export async function markAttendance(payload: {
  records: Array<{ studentId: string; status: string; remarks?: string }>;
}) {
  const res = await api.post("/attendance", payload);
  return res.data?.data ?? res.data;
}

export async function updateAttendance(
  id: string,
  payload: { status?: string; remarks?: string | null; correctionReason?: string }
) {
  const res = await api.patch(`/attendance/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function getStudentMonthlySummary(params: {
  studentId: string;
  academicYearId: string;
  month: number;
  year: number;
}) {
  const res = await api.get("/attendance/summaries/student", { params });
  return (res.data?.data ?? res.data) as AttendanceSummary;
}

export async function getSchoolSummary(params: { academicYearId: string; date?: string }) {
  const res = await api.get("/attendance/summaries/school", { params });
  return res.data?.data ?? res.data;
}

export async function getClassTeacherAttendanceContext() {
  const res = await api.get("/attendance/class-teacher/context");
  return (res.data?.data ?? res.data) as ClassTeacherAttendanceContext;
}

export async function getAttendanceContext() {
  const res = await api.get("/attendance/context");
  return (res.data?.data ?? res.data) as AttendanceContext;
}

export type AttendanceListResponse = {
  data?: AttendanceRecord[];
  meta?: { total?: number; page?: number; limit?: number };
};
