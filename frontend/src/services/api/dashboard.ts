import api from "./client";

export type AttendanceSummary = {
  attendancePercentage?: number;
  presentDays?: number;
  absentDays?: number;
  lateDays?: number;
  halfDays?: number;
  totalDays?: number;
  riskFlag?: boolean;
};

export type NoticeLite = {
  id: string;
  title: string;
  noticeType?: string;
  publishedAt?: string;
  createdAt?: string;
};

export type CircularLite = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

export type StudentDashboardData = {
  todaysAttendanceStatus: string | null;
  attendanceSummary: AttendanceSummary;
  currentClassName?: string | null;
  currentSectionName?: string | null;
  currentAcademicYear?: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
  promotionStatus?: string | null;
  promotionCongrats?: boolean;
  promotionIsFinalClass?: boolean;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  upcomingExams?: Array<{
    examId: string;
    examTitle: string;
    subject: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    shift?: string | null;
    roomNumber?: string | null;
  }>;
};

export type TeacherDashboardData = {
  todaysClasses: Array<{ id: string; dayOfWeek: string; roomNo?: string | null }>;
  attendancePendingClasses: Array<unknown>;
  atRiskStudents: Array<{
    studentId: string;
    studentName?: string | null;
    classId: string;
    sectionId: string;
    className?: string | null;
    sectionName?: string | null;
    attendancePercentage: number;
  }>;
  classTeacherSections?: Array<{
    id: string;
    classId: string;
    className?: string | null;
    sectionName?: string | null;
  }>;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  currentAcademicYear?: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
};

export type ParentDashboardData = {
  children: Array<{
    studentId: string;
    studentName?: string | null;
    className?: string | null;
    sectionName?: string | null;
    rollNumber?: number | null;
    currentAcademicYear?: {
      id: string;
      label: string;
      startDate: string;
      endDate: string;
    } | null;
    todaysAttendanceStatus: string | null;
    attendanceSummary: AttendanceSummary;
    promotionStatus?: string | null;
    promotionCongrats?: boolean;
    promotionIsFinalClass?: boolean;
  }>;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  upcomingExams?: Array<{
    examId: string;
    examTitle: string;
    subject: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    shift?: string | null;
    roomNumber?: string | null;
    studentId?: string;
    studentName?: string | null;
  }>;
};

export async function getStudentDashboard() {
  const res = await api.get("/dashboard/student");
  return res.data?.data ?? res.data;
}

export async function getTeacherDashboard() {
  const res = await api.get("/dashboard/teacher");
  return res.data?.data ?? res.data;
}

export async function getParentDashboard() {
  const res = await api.get("/dashboard/parent");
  return res.data?.data ?? res.data;
}
