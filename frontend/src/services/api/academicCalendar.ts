import api from "./client";

export type AcademicCalendarEvent = {
  id: string;
  academicYearId: string;
  title: string;
  description?: string | null;
  eventType:
    | "SESSION_START"
    | "SESSION_END"
    | "HOLIDAY"
    | "TEMPORARY_HOLIDAY"
    | "HALF_DAY"
    | "EXAM_START"
    | "EXAM_END"
    | "IMPORTANT_NOTICE"
    | "OTHER";
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  affectsAttendance?: boolean;
  affectsClasses?: boolean;
  isTemporaryTodayOnly?: boolean;
  notifyUsers?: boolean;
  color?: string | null;
};

export type AcademicCalendarSummary = {
  sessionStart: string | null;
  sessionEnd: string | null;
  totalEvents: number;
  holidayCount: number;
};

export async function listAcademicCalendarEvents(params: {
  academicYearId: string;
  from?: string;
  to?: string;
  eventType?: string;
}) {
  const res = await api.get("/academic-calendar", { params });
  return res.data?.data ?? res.data;
}

export async function getAcademicCalendarSummary(academicYearId: string) {
  const res = await api.get("/academic-calendar/summary", { params: { academicYearId } });
  return (res.data?.data ?? res.data) as AcademicCalendarSummary;
}

export async function createAcademicCalendarEvent(payload: {
  academicYearId: string;
  title: string;
  description?: string;
  eventType: AcademicCalendarEvent["eventType"];
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  affectsAttendance?: boolean;
  affectsClasses?: boolean;
  isTemporaryTodayOnly?: boolean;
  notifyUsers?: boolean;
  color?: string;
}) {
  const res = await api.post("/academic-calendar", payload);
  return res.data?.data ?? res.data;
}

export async function updateAcademicCalendarEvent(id: string, payload: Partial<{
  title: string;
  description?: string;
  eventType: AcademicCalendarEvent["eventType"];
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  affectsAttendance?: boolean;
  affectsClasses?: boolean;
  isTemporaryTodayOnly?: boolean;
  notifyUsers?: boolean;
  color?: string;
}>) {
  const res = await api.patch(`/academic-calendar/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteAcademicCalendarEvent(id: string) {
  const res = await api.delete(`/academic-calendar/${id}`);
  return res.data?.data ?? res.data;
}

export async function createEmergencyHoliday(payload: {
  academicYearId: string;
  title?: string;
  description?: string;
  notifyUsers?: boolean;
}) {
  const res = await api.post("/academic-calendar/emergency-holiday", payload);
  return res.data?.data ?? res.data;
}
