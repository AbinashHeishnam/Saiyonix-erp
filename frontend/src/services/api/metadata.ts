import api from "./client";

export type AcademicYear = {
  id: string;
  label: string;
  isActive: boolean;
};

export type Section = {
  id: string;
  sectionName: string;
  classId: string;
  classTeacherId?: string | null;
};

export type Student = {
  id: string;
  fullName: string;
  enrollments?: Array<{ classId: string; sectionId: string; academicYearId: string }>;
};

export type TimetableSlot = {
  id: string;
  sectionId: string;
  classSubjectId: string;
  academicYearId: string;
  dayOfWeek: number;
  periodId: string;
  period?: { periodNumber?: number };
  classSubject?: { subject?: { name?: string } };
};

export async function listAcademicYears() {
  const res = await api.get("/academic-years");
  return res.data;
}

export async function getActiveAcademicYear() {
  const res = await api.get("/academic-years/active");
  return res.data?.data ?? res.data;
}

export async function getPreviousAcademicYear() {
  const res = await api.get("/academic-years/previous");
  return res.data?.data ?? res.data;
}

export async function getAcademicYearTransitionMeta() {
  const res = await api.get("/academic-years/transition-meta");
  return res.data?.data ?? res.data;
}

export async function listSections(params?: { academicYearId?: string; classId?: string }) {
  const res = await api.get("/sections", { params });
  return res.data;
}

export async function listStudents() {
  const res = await api.get("/students");
  return res.data;
}

export async function listTimetableSlots() {
  const res = await api.get("/timetable-slots");
  return res.data;
}

export async function getSectionTimetable(sectionId: string) {
  const res = await api.get(`/sections/${sectionId}/timetable`);
  return res.data?.data ?? res.data;
}
