import type { UserRole } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { normalizeDate } from "@/core/utils/date";
import { getCache, setCache } from "@/core/cache/cache";
import { listCirculars } from "@/modules/circular/service";
import { listNoticesForActor } from "@/modules/noticeBoard/service";
import { getUnreadCount } from "@/modules/notification/service";
import {
  getStudentMonthlySummary,
  getStudentMonthlySummaries,
} from "@/modules/attendance/summaries/service";
import { listTimetableForTeacher } from "@/modules/timetableSlot/service";
import {
  canStudentInteractWithPreviousYear,
  getPreviousAcademicYear,
} from "@/modules/academicYear/service";

const DAY_NAME_MAP: Record<string, string> = {
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
  Sun: "SUNDAY",
};

function getLocalDayName(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const shortName = dtf.format(date);
  return DAY_NAME_MAP[shortName] ?? "SUNDAY";
}

const academicYearSelect = {
  id: true,
  label: true,
  startDate: true,
  endDate: true,
};

async function getActiveAcademicYear(schoolId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: academicYearSelect,
  });

  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  return academicYear;
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

async function getClassTeacherSections(
  schoolId: string,
  teacherId: string,
  academicYearId: string
) {
  return prisma.section.findMany({
    where: {
      classTeacherId: teacherId,
      deletedAt: null,
      class: { schoolId, deletedAt: null, academicYearId },
    },
    select: {
      id: true,
      classId: true,
      sectionName: true,
      class: { select: { className: true } },
    },
    orderBy: [{ class: { classOrder: "asc" } }, { sectionName: "asc" }],
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
    select: { classId: true, sectionId: true, rollNumber: true },
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

async function getUpcomingExamsForEnrollment(params: {
  schoolId: string;
  classId: string;
  sectionId: string;
  rollNumber: number | null;
  limit?: number;
}) {
  const today = normalizeDate(new Date());
  const items = await prisma.examTimetable.findMany({
    where: {
      examDate: { gte: today },
      examSubject: {
        exam: { schoolId: params.schoolId, isPublished: true },
        classSubject: { classId: params.classId },
      },
    },
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    take: params.limit ?? 3,
    select: {
      examDate: true,
      startTime: true,
      endTime: true,
      shift: true,
      examSubject: {
        select: {
          exam: { select: { id: true, title: true } },
          classSubject: { select: { subject: { select: { name: true } } } },
        },
      },
    },
  });

  const examIds = Array.from(new Set(items.map((item) => item.examSubject.exam.id)));
  const allocations =
    examIds.length === 0
      ? []
      : await prisma.examRoomAllocation.findMany({
          where: {
            examId: { in: examIds },
            sectionId: params.sectionId,
          },
        });

  const allocationMap = new Map<string, typeof allocations>();
  for (const allocation of allocations) {
    const list = allocationMap.get(allocation.examId) ?? [];
    list.push(allocation);
    allocationMap.set(allocation.examId, list);
  }

  return items.map((item) => {
    const examId = item.examSubject.exam.id;
    const rollNo = params.rollNumber ?? -1;
    const room = (allocationMap.get(examId) ?? []).find(
      (alloc) => rollNo >= alloc.rollFrom && rollNo <= alloc.rollTo
    );

    return {
      examId,
      examTitle: item.examSubject.exam.title,
      subject: item.examSubject.classSubject.subject.name,
      date: item.examDate,
      startTime: item.startTime,
      endTime: item.endTime,
      shift: item.shift,
      roomNumber: room?.roomNumber ?? null,
    };
  });
}

export async function getStudentDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const cacheKey = `dashboard:student:${params.userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  const student = await getStudentByUserId(params.schoolId, params.userId);
  const activeAcademicYear = await getActiveAcademicYear(params.schoolId);
  const { month, year } = getCurrentMonthYear();
  const today = normalizeDate(new Date());

  const latestEnrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId: student.id,
      student: { schoolId: params.schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      academicYearId: true,
      classId: true,
      sectionId: true,
      rollNumber: true,
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
      academicYear: { select: academicYearSelect },
    },
  });

  const lastPromotion = await prisma.promotionRecord.findFirst({
    where: { studentId: student.id, student: { schoolId: params.schoolId } },
    orderBy: { createdAt: "desc" },
    select: { status: true, isFinalClass: true },
  });

  let effectiveEnrollment = latestEnrollment;
  if (await canStudentInteractWithPreviousYear(params.schoolId)) {
    const previousYear = await getPreviousAcademicYear(params.schoolId);
    if (previousYear?.id) {
      const previousEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: student.id,
          academicYearId: previousYear.id,
          student: { schoolId: params.schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          academicYearId: true,
          classId: true,
          sectionId: true,
          rollNumber: true,
          class: { select: { className: true } },
          section: { select: { sectionName: true } },
          academicYear: { select: academicYearSelect },
        },
      });
      if (previousEnrollment) {
        effectiveEnrollment = previousEnrollment;
      }
    }
  }

  const dashboardAcademicYear =
    effectiveEnrollment?.academicYear ?? activeAcademicYear;
  const dashboardAcademicYearId = dashboardAcademicYear.id;
  const enrollment =
    effectiveEnrollment ??
    (await getEnrollmentForYear(
      params.schoolId,
      student.id,
      activeAcademicYear.id
    ));

  const [attendanceSummary, todayRecord, notices, circulars, unread, upcomingExams] = await Promise.all([
    getStudentMonthlySummary({
      schoolId: params.schoolId,
      studentId: student.id,
      academicYearId: dashboardAcademicYearId,
      month,
      year,
    }),
    prisma.studentAttendance.findFirst({
      where: {
        studentId: student.id,
        academicYearId: dashboardAcademicYearId,
        attendanceDate: today,
        student: { schoolId: params.schoolId, deletedAt: null },
        section: {
          deletedAt: null,
          class: { schoolId: params.schoolId, deletedAt: null },
        },
      },
      select: { status: true },
    }),
    listNoticesForActor(params.schoolId, { userId: params.userId, roleType: "STUDENT" }, undefined, { active: true }),
    getCircularsForTarget(params.schoolId, {
      classId: enrollment?.classId,
      sectionId: enrollment?.sectionId,
      roleType: "STUDENT",
    }),
    getUnreadCount(params.schoolId, params.userId),
    enrollment
      ? getUpcomingExamsForEnrollment({
          schoolId: params.schoolId,
          classId: enrollment.classId,
          sectionId: enrollment.sectionId,
          rollNumber: enrollment.rollNumber ?? null,
          limit: 3,
        })
      : [],
  ]);

  const result = {
    todaysAttendanceStatus: todayRecord?.status ?? null,
    attendanceSummary,
    currentClassName: effectiveEnrollment?.class?.className ?? null,
    currentSectionName: effectiveEnrollment?.section?.sectionName ?? null,
    currentAcademicYear: dashboardAcademicYear,
    promotionStatus: lastPromotion?.status ?? null,
    promotionCongrats: lastPromotion?.status === "PROMOTED",
    promotionIsFinalClass: Boolean(lastPromotion?.isFinalClass),
    pendingTasks: [],
    duesSummary: null,
    recentNotices: notices.items,
    recentCirculars: circulars.items,
    unreadNotificationsCount: unread.count,
    upcomingExams,
  };
  await setCache(cacheKey, result, 30);
  return result;
}

export async function getTeacherDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const cacheKey = `dashboard:teacher:${params.userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  const teacher = await getTeacherByUserId(params.schoolId, params.userId);
  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const dayName = getLocalDayName(new Date(), timeZone);
  const activeAcademicYear = await getActiveAcademicYear(params.schoolId);
  const academicYearId = activeAcademicYear.id;
  const { month, year } = getCurrentMonthYear();

  const [timetableRaw, notices, circulars, unread, sections] = await Promise.all([
    listTimetableForTeacher(params.schoolId, teacher.id, academicYearId),
    listNoticesForActor(params.schoolId, { userId: params.userId, roleType: "TEACHER" }, undefined, { active: true }),
    getCircularsForTarget(params.schoolId, { roleType: "TEACHER" }),
    getUnreadCount(params.schoolId, params.userId),
    getClassTeacherSections(params.schoolId, teacher.id, academicYearId),
  ]);

  const timetable = Array.isArray(timetableRaw)
    ? timetableRaw
    : Array.isArray((timetableRaw as any)?.data)
      ? (timetableRaw as any).data
      : Array.isArray((timetableRaw as any)?.items)
        ? (timetableRaw as any).items
        : [];

  const todaysClasses = timetable.filter((entry: any) => entry.dayOfWeek === dayName);

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
          select: {
            studentId: true,
            sectionId: true,
            classId: true,
            student: { select: { fullName: true } },
            section: {
              select: {
                sectionName: true,
                class: { select: { className: true } },
              },
            },
          },
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
      studentName: enrollment.student?.fullName ?? null,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      className: enrollment.section?.class?.className ?? null,
      sectionName: enrollment.section?.sectionName ?? null,
      attendancePercentage: summary?.attendancePercentage ?? 0,
      riskFlag: summary?.riskFlag ?? false,
    };
  });

  const result = {
    todaysClasses,
    attendancePendingClasses: [],
    atRiskStudents: atRiskStudents.filter((student) => student.riskFlag),
    recentNotices: notices.items,
    recentCirculars: circulars.items,
    unreadNotificationsCount: unread.count,
    currentAcademicYear: activeAcademicYear,
    classTeacherSections: sections.map((section) => ({
      id: section.id,
      classId: section.classId,
      className: section.class?.className ?? null,
      sectionName: section.sectionName ?? null,
    })),
  };
  await setCache(cacheKey, result, 30);
  return result;
}

export async function getParentDashboard(params: {
  schoolId: string;
  userId: string;
}) {
  const cacheKey = `dashboard:parent:${params.userId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  const parent = await getParentByUserId(params.schoolId, params.userId);
  const { month, year } = getCurrentMonthYear();
  const today = normalizeDate(new Date());

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  });

  const studentIds = links.map((link) => link.studentId);

  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds }, schoolId: params.schoolId, deletedAt: null },
        select: { id: true, fullName: true },
      })
    : [];

  const validStudentIds = students.map((student) => student.id);
  const studentNameMap = new Map(students.map((student) => [student.id, student.fullName]));

  const previousYearId = (await canStudentInteractWithPreviousYear(params.schoolId))
    ? (await getPreviousAcademicYear(params.schoolId))?.id ?? null
    : null;

  const enrollmentRows = validStudentIds.length
    ? await prisma.studentEnrollment.findMany({
        where: {
          studentId: { in: validStudentIds },
          student: { schoolId: params.schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          studentId: true,
          academicYearId: true,
          classId: true,
          sectionId: true,
          rollNumber: true,
          class: { select: { className: true } },
          section: { select: { sectionName: true } },
          academicYear: { select: academicYearSelect },
        },
      })
    : [];

  const latestEnrollmentByStudent = new Map<string, (typeof enrollmentRows)[number]>();
  if (previousYearId) {
    for (const row of enrollmentRows) {
      if (row.academicYearId === previousYearId && !latestEnrollmentByStudent.has(row.studentId)) {
        latestEnrollmentByStudent.set(row.studentId, row);
      }
    }
  }

  for (const row of enrollmentRows) {
    if (!latestEnrollmentByStudent.has(row.studentId)) {
      latestEnrollmentByStudent.set(row.studentId, row);
    }
  }

  const promotionRows = validStudentIds.length
    ? await prisma.promotionRecord.findMany({
        where: { studentId: { in: validStudentIds }, student: { schoolId: params.schoolId } },
        orderBy: { createdAt: "desc" },
        select: { studentId: true, status: true, isFinalClass: true },
      })
    : [];

  const lastPromotionByStudent = new Map<string, { status: string | null; isFinalClass: boolean }>();
  for (const row of promotionRows) {
    if (!lastPromotionByStudent.has(row.studentId)) {
      lastPromotionByStudent.set(row.studentId, {
        status: row.status ?? null,
        isFinalClass: Boolean(row.isFinalClass),
      });
    }
  }

  const attendanceSummaries = await Promise.all(
    validStudentIds.map(async (studentId) => {
      const enrollment = latestEnrollmentByStudent.get(studentId);
      const academicYearId = enrollment?.academicYearId;
      if (!academicYearId) return [studentId, null] as const;
      const summary = await getStudentMonthlySummary({
        schoolId: params.schoolId,
        studentId,
        academicYearId,
        month,
        year,
      });
      return [studentId, summary] as const;
    })
  );

  const summaryByStudent = new Map(attendanceSummaries);

  const todayRecords = await Promise.all(
    validStudentIds.map(async (studentId) => {
      const enrollment = latestEnrollmentByStudent.get(studentId);
      const academicYearId = enrollment?.academicYearId;
      if (!academicYearId) return [studentId, null] as const;
      const record = await prisma.studentAttendance.findFirst({
        where: {
          studentId,
          academicYearId,
          attendanceDate: today,
          student: { schoolId: params.schoolId, deletedAt: null },
          section: {
            deletedAt: null,
            class: { schoolId: params.schoolId, deletedAt: null },
          },
        },
        select: { status: true },
      });
      return [studentId, record?.status ?? null] as const;
    })
  );

  const todayStatusByStudent = new Map(todayRecords);

  const enrollments = validStudentIds
    .map((studentId) => latestEnrollmentByStudent.get(studentId))
    .filter((item): item is NonNullable<(typeof enrollmentRows)[number]> => Boolean(item));

  const upcomingExamLists = await Promise.all(
    enrollments.map((enrollment) =>
      getUpcomingExamsForEnrollment({
        schoolId: params.schoolId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        rollNumber: enrollment.rollNumber ?? null,
        limit: 2,
      }).then((items) =>
        items.map((item) => ({
          ...item,
          studentId: enrollment.studentId,
          studentName: studentNameMap.get(enrollment.studentId) ?? null,
        }))
      )
    )
  );

  const upcomingExams = upcomingExamLists.flat();

  const children = validStudentIds.map((studentId) => {
    const attendanceSummary = summaryByStudent.get(studentId) ?? {
      studentId,
      academicYearId: latestEnrollmentByStudent.get(studentId)?.academicYearId ?? null,
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
      studentName: studentNameMap.get(studentId) ?? null,
      className: latestEnrollmentByStudent.get(studentId)?.class?.className ?? null,
      sectionName: latestEnrollmentByStudent.get(studentId)?.section?.sectionName ?? null,
      rollNumber: latestEnrollmentByStudent.get(studentId)?.rollNumber ?? null,
      currentAcademicYear: latestEnrollmentByStudent.get(studentId)?.academicYear ?? null,
      todaysAttendanceStatus: todayStatusByStudent.get(studentId) ?? null,
      attendanceSummary,
      promotionStatus: lastPromotionByStudent.get(studentId)?.status ?? null,
      promotionCongrats: lastPromotionByStudent.get(studentId)?.status === "PROMOTED",
      promotionIsFinalClass: lastPromotionByStudent.get(studentId)?.isFinalClass ?? false,
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
    listNoticesForActor(params.schoolId, { userId: params.userId, roleType: "PARENT" }, undefined, { active: true }),
    getUnreadCount(params.schoolId, params.userId),
  ]);

  const fallbackCirculars =
    enrollments.length === 0
      ? (await getCircularsForTarget(params.schoolId, { roleType: "PARENT" })).items
      : Array.from(circularMap.values());

  const result = {
    children,
    upcomingFeeDues: [],
    recentNotices: notices.items,
    recentCirculars: fallbackCirculars,
    unreadNotificationsCount: unread.count,
    upcomingExams,
  };
  await setCache(cacheKey, result, 30);
  return result;
}
