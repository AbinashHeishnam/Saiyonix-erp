import type { UserRole } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { normalizeDate } from "../../core/utils/date";
import { listCirculars } from "../circular/service";
import { listNotices } from "../noticeBoard/service";
import { getUnreadCount } from "../notification/service";
import {
  getStudentMonthlySummary,
  getStudentMonthlySummaries,
} from "../attendance/summaries/service";
import { listTimetableForTeacher } from "../timetableSlot/service";

const DAY_OF_WEEK_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

async function getActiveAcademicYearId(schoolId: string): Promise<string> {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  return academicYear.id;
}

function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

async function getStudentByUserId(schoolId: string, userId: string) {
  const student = await prisma.student.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!student) {
    throw new ApiError(403, "Student account not linked");
  }

  return student;
}

async function getTeacherByUserId(schoolId: string, userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  return teacher;
}

async function getClassTeacherSections(schoolId: string, teacherId: string) {
  return prisma.section.findMany({
    where: {
      classTeacherId: teacherId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true, classId: true },
  });
}

async function getParentByUserId(schoolId: string, userId: string) {
  const parent = await prisma.parent.findFirst({
    where: { schoolId, userId },
    select: { id: true },
  });

  if (!parent) {
    throw new ApiError(403, "Parent account not linked");
  }

  return parent;
}

async function getEnrollmentForYear(
  schoolId: string,
  studentId: string,
  academicYearId: string
) {
  return prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: { classId: true, sectionId: true },
  });
}

async function getCircularsForTarget(
  schoolId: string,
  filters: { classId?: string | null; sectionId?: string | null; roleType: UserRole }
) {
  const { classId, sectionId, roleType } = filters;
  return listCirculars(schoolId, {
    roleType,
    ...(classId ? { classId } : {}),
    ...(sectionId ? { sectionId } : {}),
  });
}

export async function getStudentDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const student = await getStudentByUserId(params.schoolId, params.userId);
  const academicYearId = await getActiveAcademicYearId(params.schoolId);
  const { month, year } = getCurrentMonthYear();
  const today = normalizeDate(new Date());

  const enrollment = await getEnrollmentForYear(
    params.schoolId,
    student.id,
    academicYearId
  );

  const [attendanceSummary, todayRecord, notices, circulars, unread] = await Promise.all([
    getStudentMonthlySummary({
      schoolId: params.schoolId,
      studentId: student.id,
      academicYearId,
      month,
      year,
    }),
    prisma.studentAttendance.findFirst({
      where: {
        studentId: student.id,
        academicYearId,
        attendanceDate: today,
        student: { schoolId: params.schoolId, deletedAt: null },
        section: {
          deletedAt: null,
          class: { schoolId: params.schoolId, deletedAt: null },
        },
      },
      select: { status: true },
    }),
    listNotices(params.schoolId, { active: true }),
    getCircularsForTarget(params.schoolId, {
      classId: enrollment?.classId,
      sectionId: enrollment?.sectionId,
      roleType: "STUDENT",
    }),
    getUnreadCount(params.schoolId, params.userId),
  ]);

  return {
    todaysAttendanceStatus: todayRecord?.status ?? null,
    attendanceSummary,
    pendingTasks: [],
    duesSummary: null,
    recentNotices: notices.items,
    recentCirculars: circulars.items,
    unreadNotificationsCount: unread.count,
  };
}

export async function getTeacherDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const teacher = await getTeacherByUserId(params.schoolId, params.userId);
  const dayName = DAY_OF_WEEK_NAMES[new Date().getUTCDay()];
  const academicYearId = await getActiveAcademicYearId(params.schoolId);
  const { month, year } = getCurrentMonthYear();

  const [timetable, notices, circulars, unread, sections] = await Promise.all([
    listTimetableForTeacher(params.schoolId, teacher.id),
    listNotices(params.schoolId, { active: true }),
    getCircularsForTarget(params.schoolId, { roleType: "TEACHER" }),
    getUnreadCount(params.schoolId, params.userId),
    getClassTeacherSections(params.schoolId, teacher.id),
  ]);

  const todaysClasses = timetable.filter((entry) => entry.dayOfWeek === dayName);

  const sectionIds = sections.map((section) => section.id);
  const enrollments =
    sectionIds.length === 0
      ? []
      : await prisma.studentEnrollment.findMany({
          where: {
            sectionId: { in: sectionIds },
            academicYearId,
            student: { schoolId: params.schoolId, deletedAt: null },
          },
          select: { studentId: true, sectionId: true, classId: true },
        });

  const uniqueStudentIds = Array.from(new Set(enrollments.map((item) => item.studentId)));
  const summaries = await getStudentMonthlySummaries({
    schoolId: params.schoolId,
    studentIds: uniqueStudentIds,
    academicYearId,
    month,
    year,
  });

  const atRiskStudents = enrollments.map((enrollment) => {
    const summary = summaries.get(enrollment.studentId);

    return {
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      attendancePercentage: summary?.attendancePercentage ?? 0,
      riskFlag: summary?.riskFlag ?? false,
    };
  });

  return {
    todaysClasses,
    attendancePendingClasses: [],
    atRiskStudents: atRiskStudents.filter((student) => student.riskFlag),
    recentNotices: notices.items,
    recentCirculars: circulars.items,
    unreadNotificationsCount: unread.count,
  };
}

export async function getParentDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const parent = await getParentByUserId(params.schoolId, params.userId);
  const academicYearId = await getActiveAcademicYearId(params.schoolId);
  const { month, year } = getCurrentMonthYear();
  const today = normalizeDate(new Date());

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  });

  const studentIds = links.map((link) => link.studentId);

  const summaries = await getStudentMonthlySummaries({
    schoolId: params.schoolId,
    studentIds,
    academicYearId,
    month,
    year,
  });

  const todayRecords =
    studentIds.length === 0
      ? []
      : await prisma.studentAttendance.findMany({
          where: {
            studentId: { in: studentIds },
            academicYearId,
            attendanceDate: today,
            student: { schoolId: params.schoolId, deletedAt: null },
            section: {
              deletedAt: null,
              class: { schoolId: params.schoolId, deletedAt: null },
            },
          },
          select: { studentId: true, status: true },
        });

  const todayStatusByStudent = new Map(
    todayRecords.map((record) => [record.studentId, record.status])
  );

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      studentId: { in: studentIds },
      academicYearId,
      student: { schoolId: params.schoolId, deletedAt: null },
    },
    select: { studentId: true, classId: true, sectionId: true },
  });

  const children = studentIds.map((studentId) => {
    const attendanceSummary = summaries.get(studentId) ?? {
      studentId,
      academicYearId,
      month,
      year,
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      halfDays: 0,
      excusedDays: 0,
      attendancePercentage: 0,
      riskFlag: false,
    };

    return {
      studentId,
      todaysAttendanceStatus: todayStatusByStudent.get(studentId) ?? null,
      attendanceSummary,
      pendingAssignments: [],
      upcomingFeeDues: [],
    };
  });

  const circularsByEnrollment = await Promise.all(
    enrollments.map((enrollment) =>
      getCircularsForTarget(params.schoolId, {
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        roleType: "PARENT",
      })
    )
  );

  const circularMap = new Map(
    circularsByEnrollment.flatMap((result) =>
      result.items.map((item) => [item.id, item])
    )
  );

  const [notices, unread] = await Promise.all([
    listNotices(params.schoolId, { active: true }),
    getUnreadCount(params.schoolId, params.userId),
  ]);

  const fallbackCirculars =
    enrollments.length === 0
      ? (await getCircularsForTarget(params.schoolId, { roleType: "PARENT" })).items
      : Array.from(circularMap.values());

  return {
    children,
    upcomingFeeDues: [],
    recentNotices: notices.items,
    recentCirculars: fallbackCirculars,
    unreadNotificationsCount: unread.count,
  };
}
