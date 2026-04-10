import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";

const PRESENT_STATUSES = ["PRESENT", "LATE", "HALF_DAY", "EXCUSED"] as const;

type ActorContext = {
  userId?: string;
  roleType?: string;
};

function ensureActor(actor: ActorContext) {
  if (!actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  return actor;
}

async function ensureStudentAccess(
  schoolId: string,
  studentId: string,
  actor: ActorContext
) {
  const { roleType, userId } = ensureActor(actor);
  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
    return;
  }

  if (roleType === "STUDENT") {
    if (!userId) throw new ApiError(401, "Unauthorized");
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Forbidden");
    }
    return;
  }

  if (roleType === "PARENT") {
    if (!userId) throw new ApiError(401, "Unauthorized");
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Forbidden");
    }
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, studentId },
      select: { id: true },
    });
    if (!link) {
      throw new ApiError(403, "Forbidden");
    }
    return;
  }

  if (roleType === "TEACHER") {
    if (!userId) throw new ApiError(401, "Unauthorized");
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Forbidden");
    }
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    });
    if (!activeYear) {
      throw new ApiError(400, "Active academic year not found");
    }
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, academicYearId: activeYear.id },
      select: { classId: true, sectionId: true },
    });
    if (!enrollment) {
      throw new ApiError(403, "Forbidden");
    }

    const [classTeacher, sectionTeacher, subjectTeacher] = await Promise.all([
      prisma.class.findFirst({
        where: { id: enrollment.classId, classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.section.findFirst({
        where: { id: enrollment.sectionId, classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.teacherSubjectClass.findFirst({
        where: {
          teacherId: teacher.id,
          sectionId: enrollment.sectionId,
          academicYearId: activeYear.id,
        },
        select: { id: true },
      }),
    ]);

    if (!classTeacher && !sectionTeacher && !subjectTeacher) {
      throw new ApiError(403, "Forbidden");
    }
    return;
  }

  throw new ApiError(403, "Forbidden");
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}

export async function getStudentHistory(
  schoolId: string,
  studentId: string,
  actor: ActorContext
) {
  await ensureStudentAccess(schoolId, studentId, actor);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      registrationNumber: true,
      admissionNumber: true,
    },
  });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId },
    include: {
      academicYear: {
        select: { id: true, label: true, startDate: true, endDate: true, isActive: true },
      },
      class: { select: { id: true, className: true, classOrder: true } },
      section: { select: { id: true, sectionName: true } },
    },
    orderBy: { academicYear: { startDate: "asc" } },
  });

  if (enrollments.length === 0) {
    return { student, timeline: [] };
  }

  const academicYearIds = Array.from(new Set(enrollments.map((e) => e.academicYearId)));
  const classIds = Array.from(new Set(enrollments.map((e) => e.classId)));
  const sectionIds = Array.from(new Set(enrollments.map((e) => e.sectionId)));

  const [classSubjects, teacherAssignments, attendanceGrouped, feeRecords, promotionRecords] =
    await Promise.all([
      prisma.classSubject.findMany({
        where: { classId: { in: classIds } },
        include: { subject: { select: { id: true, name: true, code: true, isElective: true } } },
      }),
      prisma.teacherSubjectClass.findMany({
        where: { academicYearId: { in: academicYearIds }, sectionId: { in: sectionIds } },
        include: {
          teacher: { select: { id: true, fullName: true, designation: true } },
          classSubject: { include: { subject: { select: { id: true, name: true, code: true } } } },
        },
      }),
      prisma.studentAttendance.groupBy({
        by: ["academicYearId", "status"],
        where: { studentId, academicYearId: { in: academicYearIds } },
        _count: { _all: true },
      }),
      prisma.feeRecord.findMany({
        where: { studentId, academicYearId: { in: academicYearIds }, isActive: true },
        select: { academicYearId: true, totalAmount: true, paidAmount: true },
      }),
      prisma.promotionRecord.findMany({
        where: { studentId, academicYearId: { in: academicYearIds } },
        orderBy: { createdAt: "desc" },
        include: {
          promotedClass: { select: { id: true, className: true } },
          promotedSection: { select: { id: true, sectionName: true } },
        },
      }),
    ]);

  const [classTeachers, sectionTeachers] = await Promise.all([
    prisma.class.findMany({
      where: { id: { in: classIds }, deletedAt: null },
      select: {
        id: true,
        classTeacher: { select: { id: true, fullName: true, designation: true, userId: true } },
      },
    }),
    prisma.section.findMany({
      where: { id: { in: sectionIds }, deletedAt: null },
      select: {
        id: true,
        classTeacher: { select: { id: true, fullName: true, designation: true, userId: true } },
      },
    }),
  ]);

  const subjectsByClass = new Map<string, Array<(typeof classSubjects)[number]>>();
  for (const subject of classSubjects) {
    const list = subjectsByClass.get(subject.classId) ?? [];
    list.push(subject);
    subjectsByClass.set(subject.classId, list);
  }

  const teacherBySectionYear = new Map<string, Array<typeof teacherAssignments[number]>>();
  for (const assignment of teacherAssignments) {
    const key = `${assignment.academicYearId}:${assignment.sectionId ?? ""}`;
    const list = teacherBySectionYear.get(key) ?? [];
    list.push(assignment);
    teacherBySectionYear.set(key, list);
  }

  const attendanceByYear = new Map<string, { total: number; present: number }>();
  for (const row of attendanceGrouped) {
    const current = attendanceByYear.get(row.academicYearId) ?? { total: 0, present: 0 };
    current.total += row._count._all;
    if (PRESENT_STATUSES.includes(row.status as (typeof PRESENT_STATUSES)[number])) {
      current.present += row._count._all;
    }
    attendanceByYear.set(row.academicYearId, current);
  }

  const feesByYear = new Map<string, { total: number; paid: number }>();
  for (const record of feeRecords) {
    const current = feesByYear.get(record.academicYearId) ?? { total: 0, paid: 0 };
    current.total += Number(record.totalAmount ?? 0);
    current.paid += Number(record.paidAmount ?? 0);
    feesByYear.set(record.academicYearId, current);
  }

  const promotionByYear = new Map<string, (typeof promotionRecords)[number]>();
  for (const record of promotionRecords) {
    if (!promotionByYear.has(record.academicYearId)) {
      promotionByYear.set(record.academicYearId, record);
    }
  }

  const finals = await prisma.exam.findMany({
    where: { academicYearId: { in: academicYearIds }, isFinalExam: true },
    select: { id: true, academicYearId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const finalExamByYear = new Map<string, string>();
  for (const exam of finals) {
    if (!finalExamByYear.has(exam.academicYearId)) {
      finalExamByYear.set(exam.academicYearId, exam.id);
    }
  }

  const reportCards = await prisma.reportCard.findMany({
    where: {
      studentId,
      examId: { in: Array.from(finalExamByYear.values()) },
    },
    select: { examId: true, percentage: true, classRank: true, sectionRank: true },
  });
  const reportByExam = new Map(reportCards.map((r) => [r.examId, r]));

  const allExams = await prisma.exam.findMany({
    where: { academicYearId: { in: academicYearIds } },
    select: { id: true, academicYearId: true, title: true, termNo: true, isFinalExam: true },
  });
  const reportCardsAll = await prisma.reportCard.findMany({
    where: { studentId, examId: { in: allExams.map((e) => e.id) } },
    select: { examId: true, totalMarks: true, percentage: true, grade: true, classRank: true, sectionRank: true },
  });
  const examById = new Map(allExams.map((exam) => [exam.id, exam]));
  const reportsByYear = new Map<string, Array<(typeof reportCardsAll)[number] & { exam: typeof allExams[number] }>>();
  for (const report of reportCardsAll) {
    const exam = examById.get(report.examId);
    if (!exam) continue;
    const list = reportsByYear.get(exam.academicYearId) ?? [];
    list.push({ ...report, exam });
    reportsByYear.set(exam.academicYearId, list);
  }

  const yearRanges = enrollments.map((e) => ({
    academicYearId: e.academicYearId,
    startDate: e.academicYear.startDate,
    endDate: e.academicYear.endDate,
  }));

  const [studentLeaves, auditLogs] = await Promise.all([
    prisma.studentLeave.findMany({
      where: { studentId },
      select: { id: true, fromDate: true, toDate: true, status: true, reason: true },
    }),
    prisma.auditLog.findMany({
      where: { entity: "Student", entityId: studentId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const leavesByYear = new Map<string, Array<(typeof studentLeaves)[number]>>();
  for (const leave of studentLeaves) {
    for (const range of yearRanges) {
      if (overlaps(range.startDate, range.endDate, leave.fromDate, leave.toDate)) {
        const list = leavesByYear.get(range.academicYearId) ?? [];
        list.push(leave);
        leavesByYear.set(range.academicYearId, list);
      }
    }
  }

  const logsByYear = new Map<string, Array<(typeof auditLogs)[number]>>();
  for (const log of auditLogs) {
    for (const range of yearRanges) {
      if (log.createdAt >= range.startDate && log.createdAt <= range.endDate) {
        const list = logsByYear.get(range.academicYearId) ?? [];
        list.push(log);
        logsByYear.set(range.academicYearId, list);
      }
    }
  }

  const timeline = enrollments.map((enrollment) => {
    const subjects = (subjectsByClass.get(enrollment.classId) ?? []).map((item) => ({
      id: item.subject.id,
      name: item.subject.name,
      code: item.subject.code,
      isElective: item.subject.isElective,
      periodsPerWeek: item.periodsPerWeek,
    }));

    const assignmentKey = `${enrollment.academicYearId}:${enrollment.sectionId}`;
    const teacherMapping = (teacherBySectionYear.get(assignmentKey) ?? []).map((assignment) => ({
      teacher: assignment.teacher,
      subject: assignment.classSubject.subject,
      sectionId: assignment.sectionId ?? null,
    }));

    const attendance = attendanceByYear.get(enrollment.academicYearId) ?? {
      total: 0,
      present: 0,
    };
    const attendancePercent = attendance.total
      ? Math.round((attendance.present / attendance.total) * 10000) / 100
      : 0;

    const fees = feesByYear.get(enrollment.academicYearId) ?? { total: 0, paid: 0 };

    const promotion = promotionByYear.get(enrollment.academicYearId);
    let promotionType: "AUTO" | "MANUAL" | "FAILED" | "FINAL" | null = null;
    if (promotion) {
      if (promotion.isFinalClass) {
        promotionType = "FINAL";
      } else if (promotion.isManuallyPromoted) {
        promotionType = "MANUAL";
      } else if (promotion.status === "ELIGIBLE" || promotion.status === "PROMOTED") {
        promotionType = "AUTO";
      } else {
        promotionType = "FAILED";
      }
    }

    const examId = finalExamByYear.get(enrollment.academicYearId) ?? null;
    const report = examId ? reportByExam.get(examId) : null;

    const leaves = leavesByYear.get(enrollment.academicYearId) ?? [];
    const logs = logsByYear.get(enrollment.academicYearId) ?? [];
    const reports = reportsByYear.get(enrollment.academicYearId) ?? [];

    const classTeacher = classTeachers.find((cls) => cls.id === enrollment.classId)?.classTeacher ?? null;
    const sectionTeacher = sectionTeachers.find((sec) => sec.id === enrollment.sectionId)?.classTeacher ?? null;

    return {
      academicYear: enrollment.academicYear,
      enrollment: {
        class: enrollment.class,
        section: enrollment.section,
        rollNumber: enrollment.rollNumber ?? null,
        createdAt: enrollment.createdAt,
      },
      classTeacher: sectionTeacher ?? classTeacher ?? null,
      subjects,
      teacherMapping,
      performance: {
        percentage: report?.percentage ?? null,
        rank: report?.classRank ?? report?.sectionRank ?? null,
      },
      results: reports.map((item) => ({
        examId: item.examId,
        examTitle: item.exam.title,
        termNo: item.exam.termNo,
        isFinalExam: item.exam.isFinalExam,
        totalMarks: item.totalMarks ?? null,
        percentage: item.percentage ?? null,
        grade: item.grade ?? null,
        classRank: item.classRank ?? null,
        sectionRank: item.sectionRank ?? null,
      })),
      attendance: {
        totalDays: attendance.total,
        presentDays: attendance.present,
        attendancePercent,
      },
      financial: {
        totalFees: fees.total,
        paidFees: fees.paid,
        pendingFees: Math.max(0, fees.total - fees.paid),
      },
      activity: {
        leaves: {
          total: leaves.length,
          approved: leaves.filter((l) => l.status === "APPROVED").length,
          pending: leaves.filter((l) => l.status === "PENDING").length,
        },
      },
      logs: {
        total: logs.length,
        recent: logs.slice(0, 5).map((log) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          createdAt: log.createdAt,
        })),
      },
      systemTrace: {
        promotionStatus: promotion?.status ?? null,
        promotionType,
        promotedClass: promotion?.promotedClass ?? null,
        promotedSection: promotion?.promotedSection ?? null,
        isFinalClass: promotion?.isFinalClass ?? false,
      },
    };
  });

  return { student, timeline };
}
