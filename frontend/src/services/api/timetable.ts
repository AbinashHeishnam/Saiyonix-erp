import api from "./client";

export type TimetableSlot = {
  dayOfWeek: number;
  roomNo?: string | null;
  period?: { periodNumber?: number; startTime?: string; endTime?: string };
  classSubject?: { subject?: { name?: string | null } | null } | null;
  teacher?: { id?: string; fullName?: string | null } | null;
  section?: { sectionName?: string | null; class?: { className?: string | null } | null } | null;
};

export type TimetableGrouped = Record<string, TimetableSlot[]>;

export async function getSectionTimetable(sectionId: string, date?: string) {
  const res = await api.get(`/timetable/section/${sectionId}`, {
    params: date ? { date } : undefined,
  });
  return (res.data?.data ?? res.data) as TimetableGrouped;
}

export async function getTeacherTimetable(
  teacherId: string,
  params?: { academicYearId?: string; date?: string }
) {
  const res = await api.get(`/timetable/teacher/${teacherId}`, { params });
  return (res.data?.data ?? res.data) as TimetableGrouped;
}

export async function getTeacherToday() {
  const res = await api.get("/timetable/teacher/today");
  return res.data?.data ?? res.data;
}

export async function getStudentTimetable(date?: string) {
  const res = await api.get("/timetable/student/me", {
    params: { t: Date.now(), ...(date ? { date } : {}) },
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  return (res.data?.data ?? res.data) as TimetableGrouped;
}

export async function getParentTimetable(date?: string) {
  const res = await api.get("/timetable/parent/me", {
    params: { t: Date.now(), ...(date ? { date } : {}) },
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  return res.data?.data ?? res.data;
}

export async function getTimetableLockStatus() {
  const res = await api.get("/admin/timetable/lock-status");
  return res.data?.data ?? res.data;
}

export async function lockTimetable() {
  const res = await api.post("/admin/timetable/lock");
  return res.data?.data ?? res.data;
}

export async function unlockTimetable() {
  const res = await api.post("/admin/timetable/unlock");
  return res.data?.data ?? res.data;
}

export async function getTimetableWorkload() {
  const res = await api.get("/admin/timetable/workload");
  return res.data?.data ?? res.data;
}

export async function validateTimetableSlot(payload: {
  academicYearId: string;
  sectionId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string;
  teacherId: string;
  effectiveFrom?: string;
}) {
  const res = await api.post("/admin/timetable/validate-slot", payload);
  return res.data?.data ?? res.data;
}
