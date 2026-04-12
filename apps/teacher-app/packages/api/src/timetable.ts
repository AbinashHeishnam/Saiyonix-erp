import api from "./client";
import type { TimetableGrouped } from "@saiyonix/types";

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
