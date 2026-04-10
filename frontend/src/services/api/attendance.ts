import api from "./client";

export type AttendanceRecord = {
  id: string;
  studentId: string;
  student?: { fullName?: string };
  attendanceDate: string;
  status: string;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceSummary = {
  studentId?: string;
  academicYearId?: string;
  month?: number;
  year?: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  excusedDays?: number;
  attendancePercentage: number;
  riskFlag?: boolean;
};

export type ClassTeacherAttendanceContext = {
  academicYearId: string;
  sections: Array<{
    id: string;
    sectionName: string;
    classId: string;
    className?: string | null;
    students: Array<{ id: string; fullName?: string | null; profilePhotoUrl?: string | null }>;
    timetableSlots: Array<{
      id: string;
      dayOfWeek: number;
      period?: { periodNumber?: number | null } | null;
      classSubject?: { subject?: { name?: string | null } | null } | null;
    }>;
  }>;
};

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

export async function updateAttendance(id: string, payload: {
  status?: string;
  remarks?: string | null;
  correctionReason?: string;
}) {
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
  return res.data?.data ?? res.data;
}

export async function getSchoolSummary(params: { academicYearId: string; date?: string }) {
  const res = await api.get("/attendance/summaries/school", { params });
  return res.data?.data ?? res.data;
}

export async function getClassTeacherAttendanceContext() {
  const res = await api.get("/attendance/class-teacher/context");
  return (res.data?.data ?? res.data) as ClassTeacherAttendanceContext;
}

export type AttendanceContext = {
  classId: string;
  className?: string | null;
  sectionId: string;
  sectionName: string;
  academicYearId: string;
  date: string;
  timeSlot: string;
  alreadySubmitted?: boolean;
  nextOpenAt?: string | null;
  isOpen?: boolean;
  windowStart?: string;
  windowEnd?: string;
  startTime?: string;
  endTime?: string;
};

export async function getAttendanceContext() {
  const res = await api.get("/attendance/context");
  return (res.data?.data ?? res.data) as AttendanceContext;
}
