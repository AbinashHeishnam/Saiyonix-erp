import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { switchAcademicYear } from "@/modules/academicYear/service";
import { trigger as triggerNotification } from "@/modules/notification/service";
import { logAudit } from "@/utils/audit";
import type {
  ApplyFinalPromotionInput,
  GeneratePromotionInput,
  ListPromotionInput,
  OverridePromotionInput,
  PreviewPromotionInput,
  PromotionTransitionInput,
  PromotionCriteriaInput,
  PublishPromotionInput,
} from "@/modules/promotion/validation";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

const PRESENT_STATUSES = ["PRESENT", "LATE", "HALF_DAY", "EXCUSED"] as const;

async function getActiveAcademicYearId(schoolId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  return year?.id ?? null;
}

async function resolveStudentIdForParent(schoolId: string, userId: string) {
  const parent = await prisma.parent.findFirst({
    where: { schoolId, userId },
    select: { id: true },
  });
  if (!parent) {
    throw new ApiError(403, "Parent account not linked");
  }

  const link = await prisma.parentStudentLink.findFirst({
    where: { parentId: parent.id, student: { schoolId, deletedAt: null, status: "ACTIVE" } },
    select: { studentId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!link) {
    throw new ApiError(404, "No active linked students found");
  }
  return link.studentId;
}

function ensureActor(actor: ActorContext) {
  if (!actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  return actor;
}

async function resolveTeacherId(schoolId: string, actor: ActorContext) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }
  return teacher.id;
}

export async function upsertPromotionCriteria(
  schoolId: string,
  payload: PromotionCriteriaInput,
  actorUserId?: string
) {
  const promotionCriteria = (prisma as typeof prisma & {
    promotionCriteria?: typeof prisma.promotionCriteria;
  }).promotionCriteria;
  if (!promotionCriteria) {
    throw new ApiError(500, "Promotion criteria model unavailable. Run prisma generate.");
  }

  const existing = await promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId: payload.academicYearId } },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "Promotion criteria already configured for this academic year");
  }

  const created = await promotionCriteria.create({
    data: {
      schoolId,
      academicYearId: payload.academicYearId,
      minAttendancePercent: payload.minAttendancePercent,
      minSubjectPassCount: payload.minSubjectPassCount,
      allowUnderConsideration: payload.allowUnderConsideration ?? true,
    },
  });

  await logAudit({
    userId: actorUserId,
    action: "PROMOTION_CRITERIA_CREATED",
    entity: "PromotionCriteria",
    entityId: created.id,
    metadata: {
      schoolId,
      academicYearId: payload.academicYearId,
      minAttendancePercent: payload.minAttendancePercent,
      minSubjectPassCount: payload.minSubjectPassCount,
      allowUnderConsideration: payload.allowUnderConsideration ?? true,
    },
  });

  try {
    await triggerNotification("PROMOTION_CRITERIA_PUBLISHED", {
      schoolId,
      sentById: actorUserId,
      metadata: {
        academicYearId: payload.academicYearId,
        minAttendancePercent: payload.minAttendancePercent,
        minSubjectPassCount: payload.minSubjectPassCount,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] promotion criteria publish failed", error);
    }
  }

  return created;
}

export async function getPromotionCriteria(schoolId: string, academicYearId: string) {
  const promotionCriteria = (prisma as typeof prisma & { promotionCriteria?: typeof prisma.promotionCriteria })
    .promotionCriteria;
  if (!promotionCriteria) {
    throw new ApiError(500, "Promotion criteria model unavailable. Run prisma generate.");
  }
  return promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId } },
  });
}

async function buildPromotionRecordsForExam(params: {
  schoolId: string;
  academicYearId: string;
  exam: {
    id: string;
    examSubjects: Array<{
      id: string;
      passMarks: Prisma.Decimal;
      classSubject: { classId: string };
    }>;
  };
  criteria: { minAttendancePercent: number; minSubjectPassCount: number };
}) {
  const classIds = Array.from(
    new Set(params.exam.examSubjects.map((subject) => subject.classSubject.classId))
  );
  if (classIds.length === 0) {
    return [];
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId: params.academicYearId,
      classId: { in: classIds },
      student: { schoolId: params.schoolId, deletedAt: null, status: "ACTIVE" },
      class: { schoolId: params.schoolId, deletedAt: null },
      section: { deletedAt: null },
    },
    select: { studentId: true, classId: true, sectionId: true },
  });

  const studentIds = enrollments.map((e) => e.studentId);
  if (studentIds.length === 0) {
    return [];
  }

  const examSubjectIds = params.exam.examSubjects.map((s) => s.id);
  const examSubjectMeta = new Map<
    string,
    { classId: string; passMarks: Prisma.Decimal }
  >();
  const totalSubjectsByClass = new Map<string, number>();
  params.exam.examSubjects.forEach((subject) => {
    examSubjectMeta.set(subject.id, {
      classId: subject.classSubject.classId,
      passMarks: subject.passMarks,
    });
    totalSubjectsByClass.set(
      subject.classSubject.classId,
      (totalSubjectsByClass.get(subject.classSubject.classId) ?? 0) + 1
    );
  });

  const marks = await prisma.mark.findMany({
    where: {
      examSubjectId: { in: examSubjectIds },
      studentId: { in: studentIds },
    },
    select: {
      studentId: true,
      examSubjectId: true,
      marksObtained: true,
      isAbsent: true,
    },
  });

  const attendanceGrouped = await prisma.studentAttendance.groupBy({
    by: ["studentId", "status"],
    where: {
      studentId: { in: studentIds },
      academicYearId: params.academicYearId,
      student: { schoolId: params.schoolId, deletedAt: null },
      section: { class: { schoolId: params.schoolId, deletedAt: null }, deletedAt: null },
    },
    _count: { _all: true },
  });

  const attendanceSummary = new Map<
    string,
    { totalDays: number; presentDays: number }
  >();
  for (const row of attendanceGrouped) {
    const current = attendanceSummary.get(row.studentId) ?? {
      totalDays: 0,
      presentDays: 0,
    };
    current.totalDays += row._count._all;
    if (PRESENT_STATUSES.includes(row.status as (typeof PRESENT_STATUSES)[number])) {
      current.presentDays += row._count._all;
    }
    attendanceSummary.set(row.studentId, current);
  }

  const marksByStudent = new Map<string, Array<typeof marks[number]>>();
  marks.forEach((mark) => {
    if (!marksByStudent.has(mark.studentId)) {
      marksByStudent.set(mark.studentId, []);
    }
    marksByStudent.get(mark.studentId)?.push(mark);
  });

  return enrollments.map((enrollment) => {
    const totalSubjects = totalSubjectsByClass.get(enrollment.classId) ?? 0;
    const studentMarks = marksByStudent.get(enrollment.studentId) ?? [];
    let passedSubjects = 0;
    for (const mark of studentMarks) {
      const meta = examSubjectMeta.get(mark.examSubjectId);
      if (!meta || meta.classId !== enrollment.classId) continue;
      if (mark.isAbsent) continue;
      if (new Prisma.Decimal(mark.marksObtained).gte(meta.passMarks)) {
        passedSubjects += 1;
      }
    }
    const summary = attendanceSummary.get(enrollment.studentId) ?? {
      totalDays: 0,
      presentDays: 0,
    };
    const attendancePercent = summary.totalDays
      ? Math.round((summary.presentDays / summary.totalDays) * 10000) / 100
      : 0;
    const isPass = passedSubjects >= params.criteria.minSubjectPassCount;
    const isEligibleByAttendance =
      attendancePercent >= params.criteria.minAttendancePercent;
    const status = isPass && isEligibleByAttendance ? "ELIGIBLE" : "FAILED";

    return {
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      academicYearId: params.academicYearId,
      attendancePercent,
      passedSubjects,
      totalSubjects,
      status,
    };
  });
}

export async function generatePromotionList(
  schoolId: string,
  payload: GeneratePromotionInput
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id: payload.examId,
      schoolId,
      academicYearId: payload.academicYearId,
      isFinalExam: true,
    },
    select: {
      id: true,
      academicYearId: true,
      isPublished: true,
      isLocked: true,
      examSubjects: {
        select: {
          id: true,
          passMarks: true,
          classSubject: { select: { classId: true } },
        },
      },
    },
  });

  if (!exam) {
    throw new ApiError(400, "Final exam not found");
  }
  if (!exam.isPublished || !exam.isLocked) {
    throw new ApiError(400, "Final exam and result must be completed before promotion");
  }
  const hasPublishedResult = await prisma.reportCard.findFirst({
    where: { examId: exam.id, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
    select: { id: true },
  });
  if (!hasPublishedResult) {
    throw new ApiError(400, "Final exam and result must be completed before promotion");
  }

  const criteria = await prisma.promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId: payload.academicYearId } },
  });
  if (!criteria) {
    throw new ApiError(400, "Promotion criteria not configured");
  }
  return buildPromotionRecordsForExam({
    schoolId,
    academicYearId: payload.academicYearId,
    exam,
    criteria,
  });
}

export async function previewPromotionEligibility(
  schoolId: string,
  payload: PreviewPromotionInput
) {
  const criteria = await prisma.promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId: payload.fromAcademicYearId } },
  });
  if (!criteria) {
    throw new ApiError(400, "Promotion criteria not configured");
  }

  const finalExams = await prisma.exam.findMany({
    where: { schoolId, academicYearId: payload.fromAcademicYearId, isFinalExam: true },
    select: {
      id: true,
      examSubjects: {
        select: {
          id: true,
          passMarks: true,
          classSubject: { select: { classId: true } },
        },
      },
    },
  });

  const results: Array<{
    studentId: string;
    classId: string;
    sectionId: string;
    academicYearId: string;
    attendancePercent: number;
    passedSubjects: number;
    totalSubjects: number;
    failedSubjects: number;
    maxAllowedFailures: number;
    eligibility: "ELIGIBLE" | "FAILED";
  }> = [];

  for (const exam of finalExams) {
    const records = await buildPromotionRecordsForExam({
      schoolId,
      academicYearId: payload.fromAcademicYearId,
      exam,
      criteria,
    });
    for (const record of records) {
      const failedSubjects = Math.max(0, record.totalSubjects - record.passedSubjects);
      const maxAllowedFailures = Math.max(
        0,
        record.totalSubjects - criteria.minSubjectPassCount
      );
      results.push({
        studentId: record.studentId,
        classId: record.classId,
        sectionId: record.sectionId,
        academicYearId: record.academicYearId,
        attendancePercent: record.attendancePercent,
        passedSubjects: record.passedSubjects,
        totalSubjects: record.totalSubjects,
        failedSubjects,
        maxAllowedFailures,
        eligibility: record.status === "ELIGIBLE" ? "ELIGIBLE" : "FAILED",
      });
    }
  }

  return results;
}

export async function listPromotionRecords(
  schoolId: string,
  actor: ActorContext,
  params: ListPromotionInput
) {
  const { roleType } = ensureActor(actor);
  const where: Prisma.PromotionRecordWhereInput = {
    academicYearId: params.academicYearId,
    student: { schoolId, deletedAt: null },
  };
  if (params.status) where.status = params.status;
  if (params.classId) where.classId = params.classId;
  if (params.sectionId) where.sectionId = params.sectionId;
  if (roleType === "TEACHER") {
    const teacherId = await resolveTeacherId(schoolId, actor);
    where.OR = [
      { class: { classTeacherId: teacherId } },
      { section: { classTeacherId: teacherId } },
    ];
    where.status = {
      in: [
        "ELIGIBLE",
        "UNDER_CONSIDERATION",
        "FAILED",
        "PROMOTED",
        "NOT_PROMOTED",
      ],
    };
  }

  return prisma.promotionRecord.findMany({
    where,
    orderBy: [{ classId: "asc" }, { sectionId: "asc" }, { studentId: "asc" }],
    include: {
      student: { select: { id: true, fullName: true } },
      class: { select: { id: true, className: true, classOrder: true } },
      section: { select: { id: true, sectionName: true } },
    },
  });
}

export async function getStudentPromotionStatus(
  schoolId: string,
  actor: ActorContext
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "STUDENT") {
    throw new ApiError(403, "Forbidden");
  }
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const student = await prisma.student.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const activeAcademicYearId = await getActiveAcademicYearId(schoolId);
  const currentEnrollment =
    activeAcademicYearId
      ? await prisma.studentEnrollment.findFirst({
          where: { studentId: student.id, academicYearId: activeAcademicYearId },
          select: {
            academicYearId: true,
            class: { select: { id: true, className: true, classOrder: true } },
            section: { select: { id: true, sectionName: true } },
          },
        })
      : null;
  const latestEnrollment =
    currentEnrollment ??
    (await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: {
        academicYearId: true,
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true } },
      },
    }));

  const promotionRecord = await prisma.promotionRecord.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: {
      academicYearId: true,
      status: true,
      attendancePercent: true,
      passedSubjects: true,
      totalSubjects: true,
      isManuallyPromoted: true,
      class: { select: { id: true, className: true, classOrder: true } },
      section: { select: { id: true, sectionName: true } },
      promotedClass: { select: { id: true, className: true } },
      promotedSection: { select: { id: true, sectionName: true } },
      isFinalClass: true,
      academicYear: { select: { id: true, isLocked: true, isActive: true, startDate: true } },
    },
  });
  const validPromotion = Boolean(
    promotionRecord?.academicYear?.isLocked || promotionRecord?.academicYear?.isActive
  );

  const reportCard = promotionRecord?.academicYearId
    ? await prisma.reportCard.findFirst({
        where: {
          studentId: student.id,
          exam: {
            schoolId,
            academicYearId: promotionRecord.academicYearId,
            isFinalExam: true,
            isPublished: true,
          },
        },
        orderBy: { createdAt: "desc" },
        select: { percentage: true, classRank: true, sectionRank: true },
      })
    : null;

  const criteria = promotionRecord?.academicYearId
    ? await prisma.promotionCriteria.findUnique({
        where: { schoolId_academicYearId: { schoolId, academicYearId: promotionRecord.academicYearId } },
        select: { minAttendancePercent: true, minSubjectPassCount: true },
      })
    : null;

  const failedSubjectsComputed =
    promotionRecord && promotionRecord.totalSubjects != null
      ? Math.max(0, promotionRecord.totalSubjects - promotionRecord.passedSubjects)
      : null;

  const isAttendanceOk =
    typeof promotionRecord?.attendancePercent === "number" &&
    typeof criteria?.minAttendancePercent === "number"
      ? promotionRecord.attendancePercent >= criteria.minAttendancePercent
      : false;

  const allowedFailed =
    typeof promotionRecord?.totalSubjects === "number" &&
    typeof criteria?.minSubjectPassCount === "number"
      ? Math.max(0, promotionRecord.totalSubjects - criteria.minSubjectPassCount)
      : null;

  const isSubjectOk =
    typeof failedSubjectsComputed === "number" && typeof allowedFailed === "number"
      ? failedSubjectsComputed <= allowedFailed
      : false;

  const isFinalized = Boolean(promotionRecord?.academicYear?.isLocked);
  const finalStatus =
    promotionRecord?.isFinalClass || promotionRecord?.status === "PROMOTED"
      ? "PROMOTED"
      : "FAILED";
  const computedStatus = isFinalized
    ? finalStatus
    : promotionRecord?.isManuallyPromoted
      ? "UNDER_CONSIDERATION"
      : promotionRecord?.isFinalClass
        ? "PROMOTED"
        : promotionRecord?.status === "PROMOTED"
          ? "PROMOTED"
          : isAttendanceOk && isSubjectOk
            ? "ELIGIBLE"
            : "FAILED";

  const hasAdvancedEnrollment =
    Boolean(currentEnrollment?.academicYearId) &&
    Boolean(promotionRecord?.academicYearId) &&
    currentEnrollment?.academicYearId !== promotionRecord?.academicYearId;

  let fallbackNextClass: { id: string; className: string } | null = null;
  let fallbackNextSection: { id: string; sectionName: string } | null = null;
  if (
    !hasAdvancedEnrollment &&
    promotionRecord?.status &&
    ["PROMOTED", "ELIGIBLE"].includes(promotionRecord.status) &&
    promotionRecord.class?.classOrder != null &&
    promotionRecord.academicYear?.startDate
  ) {
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    });
    const nextYear =
      activeYear && activeYear.id !== promotionRecord.academicYearId
        ? activeYear
        : await prisma.academicYear.findFirst({
            where: {
              schoolId,
              startDate: { gt: promotionRecord.academicYear.startDate },
            },
            orderBy: { startDate: "asc" },
            select: { id: true },
          });
    if (nextYear) {
      fallbackNextClass = await prisma.class.findFirst({
        where: {
          schoolId,
          academicYearId: nextYear.id,
          classOrder: promotionRecord.class.classOrder + 1,
          deletedAt: null,
        },
        select: { id: true, className: true },
      });
      if (fallbackNextClass) {
        fallbackNextSection = await prisma.section.findFirst({
          where: { classId: fallbackNextClass.id, deletedAt: null },
          orderBy: { sectionName: "asc" },
          select: { id: true, sectionName: true },
        });
      }
    }
  }

  const nextClassResolved = hasAdvancedEnrollment
    ? currentEnrollment?.class ?? null
    : promotionRecord?.promotedClass ?? fallbackNextClass ?? null;
  const nextSectionResolved = hasAdvancedEnrollment
    ? currentEnrollment?.section ?? null
    : promotionRecord?.promotedSection ?? fallbackNextSection ?? null;
  const hasNextPlacement = Boolean(nextClassResolved && nextSectionResolved);

  return {
    studentId: student.id,
    studentName: student.fullName,
    status:
      validPromotion &&
      computedStatus === "PROMOTED" &&
      !hasNextPlacement &&
      !promotionRecord?.isFinalClass
        ? "PENDING_APPLY"
        : validPromotion
          ? computedStatus ?? null
          : null,
    attendancePercent: validPromotion ? promotionRecord?.attendancePercent ?? null : null,
    passedSubjects: validPromotion ? promotionRecord?.passedSubjects ?? null : null,
    totalSubjects: validPromotion ? promotionRecord?.totalSubjects ?? null : null,
    failedSubjects:
      validPromotion && failedSubjectsComputed != null
        ? failedSubjectsComputed
        : null,
    percentage: validPromotion ? reportCard?.percentage ?? null : null,
    rank: validPromotion ? reportCard?.classRank ?? reportCard?.sectionRank ?? null : null,
    currentClass: currentEnrollment?.class ?? promotionRecord?.class ?? latestEnrollment?.class ?? null,
    nextClass: nextClassResolved,
    currentSection: currentEnrollment?.section ?? promotionRecord?.section ?? latestEnrollment?.section ?? null,
    nextSection: nextSectionResolved,
    isFinalClass: Boolean(promotionRecord?.isFinalClass),
    message: promotionRecord?.isFinalClass
      ? "You have successfully completed your class"
      : undefined,
  };
}

export async function getParentPromotionStatus(
  schoolId: string,
  actor: ActorContext
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "PARENT") {
    throw new ApiError(403, "Forbidden");
  }
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const studentId = await resolveStudentIdForParent(schoolId, userId);
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const activeAcademicYearId = await getActiveAcademicYearId(schoolId);
  const currentEnrollment =
    activeAcademicYearId
      ? await prisma.studentEnrollment.findFirst({
          where: { studentId: student.id, academicYearId: activeAcademicYearId },
          select: {
            academicYearId: true,
            class: { select: { id: true, className: true, classOrder: true } },
            section: { select: { id: true, sectionName: true } },
          },
        })
      : null;
  const latestEnrollment =
    currentEnrollment ??
    (await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: {
        academicYearId: true,
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true } },
      },
    }));

  const promotionRecord = await prisma.promotionRecord.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: {
      academicYearId: true,
      status: true,
      attendancePercent: true,
      passedSubjects: true,
      totalSubjects: true,
      isManuallyPromoted: true,
      class: { select: { id: true, className: true, classOrder: true } },
      section: { select: { id: true, sectionName: true } },
      promotedClass: { select: { id: true, className: true } },
      promotedSection: { select: { id: true, sectionName: true } },
      isFinalClass: true,
      academicYear: { select: { id: true, isLocked: true, isActive: true, startDate: true } },
    },
  });
  const validPromotion = Boolean(
    promotionRecord?.academicYear?.isLocked || promotionRecord?.academicYear?.isActive
  );

  const reportCard = promotionRecord?.academicYearId
    ? await prisma.reportCard.findFirst({
        where: {
          studentId: student.id,
          exam: {
            schoolId,
            academicYearId: promotionRecord.academicYearId,
            isFinalExam: true,
            isPublished: true,
          },
        },
        orderBy: { createdAt: "desc" },
        select: { percentage: true, classRank: true, sectionRank: true },
      })
    : null;

  const criteria = promotionRecord?.academicYearId
    ? await prisma.promotionCriteria.findUnique({
        where: { schoolId_academicYearId: { schoolId, academicYearId: promotionRecord.academicYearId } },
        select: { minAttendancePercent: true, minSubjectPassCount: true },
      })
    : null;

  const failedSubjectsComputed =
    promotionRecord && promotionRecord.totalSubjects != null
      ? Math.max(0, promotionRecord.totalSubjects - promotionRecord.passedSubjects)
      : null;

  const isAttendanceOk =
    typeof promotionRecord?.attendancePercent === "number" &&
    typeof criteria?.minAttendancePercent === "number"
      ? promotionRecord.attendancePercent >= criteria.minAttendancePercent
      : false;

  const allowedFailed =
    typeof promotionRecord?.totalSubjects === "number" &&
    typeof criteria?.minSubjectPassCount === "number"
      ? Math.max(0, promotionRecord.totalSubjects - criteria.minSubjectPassCount)
      : null;

  const isSubjectOk =
    typeof failedSubjectsComputed === "number" && typeof allowedFailed === "number"
      ? failedSubjectsComputed <= allowedFailed
      : false;

  const isFinalized = Boolean(promotionRecord?.academicYear?.isLocked);
  const finalStatus =
    promotionRecord?.isFinalClass || promotionRecord?.status === "PROMOTED"
      ? "PROMOTED"
      : "FAILED";
  const computedStatus = isFinalized
    ? finalStatus
    : promotionRecord?.isManuallyPromoted
      ? "UNDER_CONSIDERATION"
      : promotionRecord?.isFinalClass
        ? "PROMOTED"
        : promotionRecord?.status === "PROMOTED"
          ? "PROMOTED"
          : isAttendanceOk && isSubjectOk
            ? "ELIGIBLE"
            : "FAILED";

  const hasAdvancedEnrollment =
    Boolean(currentEnrollment?.academicYearId) &&
    Boolean(promotionRecord?.academicYearId) &&
    currentEnrollment?.academicYearId !== promotionRecord?.academicYearId;

  let fallbackNextClass: { id: string; className: string } | null = null;
  let fallbackNextSection: { id: string; sectionName: string } | null = null;
  if (
    !hasAdvancedEnrollment &&
    promotionRecord?.status &&
    ["PROMOTED", "ELIGIBLE"].includes(promotionRecord.status) &&
    promotionRecord.class?.classOrder != null &&
    promotionRecord.academicYear?.startDate
  ) {
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    });
    const nextYear =
      activeYear && activeYear.id !== promotionRecord.academicYearId
        ? activeYear
        : await prisma.academicYear.findFirst({
            where: {
              schoolId,
              startDate: { gt: promotionRecord.academicYear.startDate },
            },
            orderBy: { startDate: "asc" },
            select: { id: true },
          });
    if (nextYear) {
      fallbackNextClass = await prisma.class.findFirst({
        where: {
          schoolId,
          academicYearId: nextYear.id,
          classOrder: promotionRecord.class.classOrder + 1,
          deletedAt: null,
        },
        select: { id: true, className: true },
      });
      if (fallbackNextClass) {
        fallbackNextSection = await prisma.section.findFirst({
          where: { classId: fallbackNextClass.id, deletedAt: null },
          orderBy: { sectionName: "asc" },
          select: { id: true, sectionName: true },
        });
      }
    }
  }

  const nextClassResolved = hasAdvancedEnrollment
    ? currentEnrollment?.class ?? null
    : promotionRecord?.promotedClass ?? fallbackNextClass ?? null;
  const nextSectionResolved = hasAdvancedEnrollment
    ? currentEnrollment?.section ?? null
    : promotionRecord?.promotedSection ?? fallbackNextSection ?? null;
  const hasNextPlacement = Boolean(nextClassResolved && nextSectionResolved);

  return {
    studentId: student.id,
    studentName: student.fullName,
    status:
      validPromotion &&
      computedStatus === "PROMOTED" &&
      !hasNextPlacement &&
      !promotionRecord?.isFinalClass
        ? "PENDING_APPLY"
        : validPromotion
          ? computedStatus ?? null
          : null,
    attendancePercent: validPromotion ? promotionRecord?.attendancePercent ?? null : null,
    passedSubjects: validPromotion ? promotionRecord?.passedSubjects ?? null : null,
    totalSubjects: validPromotion ? promotionRecord?.totalSubjects ?? null : null,
    failedSubjects:
      validPromotion && failedSubjectsComputed != null
        ? failedSubjectsComputed
        : null,
    percentage: validPromotion ? reportCard?.percentage ?? null : null,
    rank: validPromotion ? reportCard?.classRank ?? reportCard?.sectionRank ?? null : null,
    currentClass: currentEnrollment?.class ?? promotionRecord?.class ?? latestEnrollment?.class ?? null,
    nextClass: nextClassResolved,
    currentSection: currentEnrollment?.section ?? promotionRecord?.section ?? latestEnrollment?.section ?? null,
    nextSection: nextSectionResolved,
    isFinalClass: Boolean(promotionRecord?.isFinalClass),
    message: promotionRecord?.isFinalClass
      ? "You have successfully completed your class"
      : undefined,
  };
}

export async function overridePromotion(
  schoolId: string,
  actor: ActorContext,
  params: OverridePromotionInput
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" && roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const record = await prisma.promotionRecord.findFirst({
    where: {
      id: params.promotionRecordId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      classId: true,
      sectionId: true,
      studentId: true,
      academicYearId: true,
      student: { select: { fullName: true } },
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
    },
  });

  if (!record) {
    throw new ApiError(404, "Promotion record not found");
  }
  if (record.status !== "FAILED") {
    throw new ApiError(400, "Only FAILED students can be overridden");
  }

  const criteria = await prisma.promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId: record.academicYearId } },
    select: { allowUnderConsideration: true },
  });
  if (criteria && criteria.allowUnderConsideration === false) {
    throw new ApiError(400, "Promotion under consideration is disabled");
  }
  if (roleType === "TEACHER") {
    const teacherId = await resolveTeacherId(schoolId, actor);
    const teacherClass = await prisma.class.findFirst({
      where: { id: record.classId, classTeacherId: teacherId, deletedAt: null },
      select: { id: true },
    });
    if (!teacherClass) {
      throw new ApiError(403, "Only class teacher can override");
    }
  }

  const updated = await prisma.promotionRecord.update({
    where: { id: record.id },
    data: { isManuallyPromoted: true, status: "UNDER_CONSIDERATION" },
  });

  try {
    await triggerNotification("PROMOTION_UNDER_CONSIDERATION", {
      schoolId,
      studentId: record.studentId,
      studentName: record.student?.fullName ?? undefined,
      classId: record.classId,
      className: record.class?.className ?? undefined,
      sectionId: record.sectionId,
      sectionName: record.section?.sectionName ?? undefined,
      sentById: actor.userId ?? undefined,
      metadata: {
        promotionRecordId: record.id,
        status: "UNDER_CONSIDERATION",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] promotion under consideration failed", error);
    }
  }

  return updated;
}

export async function reviewPromotionOverride(
  schoolId: string,
  actor: ActorContext,
  params: { promotionRecordId: string; action: "APPROVE" | "REJECT" | "REVERT" }
) {
  const { roleType, userId } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const record = await prisma.promotionRecord.findFirst({
    where: {
      id: params.promotionRecordId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      studentId: true,
      classId: true,
      sectionId: true,
    },
  });

  if (!record) {
    throw new ApiError(404, "Promotion record not found");
  }
  if (record.status !== "UNDER_CONSIDERATION") {
    throw new ApiError(400, "Only UNDER_CONSIDERATION records can be reviewed");
  }

  let nextStatus: "ELIGIBLE" | "FAILED" = "FAILED";
  let isManuallyPromoted = false;

  switch (params.action) {
    case "APPROVE":
      nextStatus = "ELIGIBLE";
      isManuallyPromoted = true;
      break;
    case "REJECT":
    case "REVERT":
      nextStatus = "FAILED";
      isManuallyPromoted = false;
      break;
    default:
      throw new ApiError(400, "Invalid action");
  }

  const updated = await prisma.promotionRecord.update({
    where: { id: record.id },
    data: { status: nextStatus, isManuallyPromoted },
  });

  await logAudit({
    userId,
    action: "PROMOTION_OVERRIDE_REVIEW",
    entity: "PromotionRecord",
    entityId: record.id,
    metadata: {
      action: params.action,
      status: nextStatus,
      studentId: record.studentId,
      classId: record.classId,
      sectionId: record.sectionId,
    },
  });

  return updated;
}

export async function publishPromotion(
  schoolId: string,
  actor: ActorContext,
  payload: PublishPromotionInput
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const [fromYear, toYear] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { id: payload.fromAcademicYearId, schoolId },
      select: { id: true, isLocked: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: payload.toAcademicYearId, schoolId },
      select: { id: true, isLocked: true },
    }),
  ]);
  if (!fromYear) {
    throw new ApiError(404, "Source academic year not found");
  }
  if (!toYear) {
    throw new ApiError(404, "Target academic year not found");
  }
  if (payload.fromAcademicYearId === payload.toAcademicYearId) {
    throw new ApiError(400, "Source and target academic year cannot be the same");
  }
  if (fromYear.isLocked) {
    throw new ApiError(400, "Promotion already completed for this academic year");
  }
  if (toYear.isLocked) {
    throw new ApiError(400, "Target academic year is locked");
  }

  const finalExams = await prisma.exam.findMany({
    where: { schoolId, academicYearId: payload.fromAcademicYearId, isFinalExam: true },
    select: {
      id: true,
      examSubjects: {
        select: {
          id: true,
          passMarks: true,
          classSubject: { select: { classId: true } },
        },
      },
    },
  });

  const classToExamId = new Map<string, string>();
  const duplicateExamClasses = new Set<string>();
  for (const exam of finalExams) {
    for (const subject of exam.examSubjects) {
      const classId = subject.classSubject.classId;
      if (classToExamId.has(classId) && classToExamId.get(classId) !== exam.id) {
        duplicateExamClasses.add(classId);
      }
      classToExamId.set(classId, exam.id);
    }
  }
  const fromClasses = await prisma.class.findMany({
    where: { academicYearId: payload.fromAcademicYearId, schoolId, deletedAt: null },
    select: { id: true, classOrder: true },
  });
  if (fromClasses.length === 0) {
    throw new ApiError(400, "No classes found for source academic year");
  }
  if (duplicateExamClasses.size > 0) {
    throw new ApiError(400, "Multiple final exams found for a class");
  }
  for (const fromClass of fromClasses) {
    const examId = classToExamId.get(fromClass.id);
    if (!examId) {
      throw new ApiError(400, `Final exam not found for class ${fromClass.id}`);
    }
  }

  const finalExamIds = Array.from(new Set(classToExamId.values()));
  const finalExamsStatus = await prisma.exam.findMany({
    where: { id: { in: finalExamIds }, schoolId, isFinalExam: true },
    select: { id: true, isPublished: true, isLocked: true },
  });
  const statusById = new Map(finalExamsStatus.map((e) => [e.id, e]));
  for (const examId of finalExamIds) {
    const status = statusById.get(examId);
    if (!status || !status.isPublished || !status.isLocked) {
      throw new ApiError(400, "Final exam and result must be completed before promotion");
    }
    const hasPublishedResult = await prisma.reportCard.findFirst({
      where: { examId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
      select: { id: true },
    });
    if (!hasPublishedResult) {
      throw new ApiError(400, "Final exam and result must be completed before promotion");
    }
  }

  const promotionCriteria = (prisma as typeof prisma & { promotionCriteria?: typeof prisma.promotionCriteria })
    .promotionCriteria;
  if (!promotionCriteria) {
    throw new ApiError(500, "Promotion criteria model unavailable. Run prisma generate.");
  }
  const criteria = await promotionCriteria.findUnique({
    where: { schoolId_academicYearId: { schoolId, academicYearId: payload.fromAcademicYearId } },
  });
  if (!criteria) {
    throw new ApiError(400, "Promotion criteria not configured");
  }

  const computedRecords: Array<{
    studentId: string;
    classId: string;
    sectionId: string;
    academicYearId: string;
    attendancePercent: number;
    passedSubjects: number;
    totalSubjects: number;
    status: string;
  }> = [];

  for (const exam of finalExams) {
    const records = await buildPromotionRecordsForExam({
      schoolId,
      academicYearId: payload.fromAcademicYearId,
      exam,
      criteria,
    });
    computedRecords.push(...records);
  }

  if (computedRecords.length === 0) {
    throw new ApiError(400, "No students available for promotion");
  }

  for (const record of computedRecords) {
    const examId = classToExamId.get(record.classId);
    if (!examId) {
      throw new ApiError(
        400,
        `Final exam mapping missing for class ${record.classId}`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.promotionRecord.deleteMany({
      where: {
        academicYearId: payload.fromAcademicYearId,
        student: { schoolId },
      },
    });
    await tx.promotionRecord.createMany({
      data: computedRecords.map((record) => ({
        ...record,
        isManuallyPromoted: false,
      })),
    });
  });

  return {
    total: computedRecords.length,
    eligible: computedRecords.filter((r) => r.status === "ELIGIBLE").length,
    failed: computedRecords.filter((r) => r.status === "FAILED").length,
    overridden: 0,
  };
}

export async function applyFinalPromotion(
  schoolId: string,
  actor: ActorContext,
  payload: ApplyFinalPromotionInput
) {
  const { roleType, userId } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const [fromYear, toYear] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { id: payload.fromAcademicYearId, schoolId },
      select: { id: true, isLocked: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: payload.toAcademicYearId, schoolId },
      select: { id: true, isLocked: true },
    }),
  ]);
  if (!fromYear) {
    throw new ApiError(404, "Source academic year not found");
  }
  if (!toYear) {
    throw new ApiError(404, "Target academic year not found");
  }
  if (payload.fromAcademicYearId === payload.toAcademicYearId) {
    throw new ApiError(400, "Source and target academic year cannot be the same");
  }
  if (fromYear.isLocked) {
    throw new ApiError(400, "Promotion already completed for this academic year");
  }
  if (toYear.isLocked) {
    throw new ApiError(400, "Target academic year is locked");
  }

  const finalExams = await prisma.exam.findMany({
    where: { schoolId, academicYearId: payload.fromAcademicYearId, isFinalExam: true },
    select: {
      id: true,
      isPublished: true,
      isLocked: true,
      examSubjects: { select: { classSubject: { select: { classId: true } } } },
    },
  });

  const classToExamId = new Map<string, string>();
  const duplicateExamClasses = new Set<string>();
  for (const exam of finalExams) {
    for (const subject of exam.examSubjects) {
      const classId = subject.classSubject.classId;
      if (classToExamId.has(classId) && classToExamId.get(classId) !== exam.id) {
        duplicateExamClasses.add(classId);
      }
      classToExamId.set(classId, exam.id);
    }
  }

  const fromClasses = await prisma.class.findMany({
    where: { academicYearId: payload.fromAcademicYearId, schoolId, deletedAt: null },
    select: { id: true, classOrder: true },
  });
  if (fromClasses.length === 0) {
    throw new ApiError(400, "No classes found for source academic year");
  }
  if (duplicateExamClasses.size > 0) {
    throw new ApiError(400, "Multiple final exams found for a class");
  }
  for (const fromClass of fromClasses) {
    const examId = classToExamId.get(fromClass.id);
    if (!examId) {
      throw new ApiError(400, `Final exam not found for class ${fromClass.id}`);
    }
  }

  const finalExamIds = Array.from(new Set(classToExamId.values()));
  const statusById = new Map(finalExams.map((e) => [e.id, e]));
  for (const examId of finalExamIds) {
    const status = statusById.get(examId);
    if (!status || !status.isPublished || !status.isLocked) {
      throw new ApiError(400, "Final exam and result must be completed before promotion");
    }
    const hasPublishedResult = await prisma.reportCard.findFirst({
      where: { examId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
      select: { id: true },
    });
    if (!hasPublishedResult) {
      throw new ApiError(400, "Final exam and result must be completed before promotion");
    }
  }

  const promotionRecords = await prisma.promotionRecord.findMany({
    where: {
      academicYearId: payload.fromAcademicYearId,
      student: { schoolId, deletedAt: null },
    },
    include: {
      student: { select: { id: true, fullName: true } },
      class: { select: { id: true, classOrder: true } },
      section: { select: { id: true, sectionName: true } },
    },
  });
  if (promotionRecords.length === 0) {
    throw new ApiError(400, "No students available for promotion");
  }
  const recordById = new Map(promotionRecords.map((record) => [record.id, record]));

  const toClasses = await prisma.class.findMany({
    where: { academicYearId: payload.toAcademicYearId, schoolId, deletedAt: null },
    select: { id: true, classOrder: true },
  });
  if (toClasses.length === 0) {
    throw new ApiError(400, "No classes found for target academic year");
  }

  const toClassByOrder = new Map(toClasses.map((c) => [c.classOrder, c.id]));

  const targetClassIds = Array.from(new Set(toClasses.map((c) => c.id)));
  const targetSections = await prisma.section.findMany({
    where: { classId: { in: targetClassIds }, deletedAt: null },
    orderBy: [{ classId: "asc" }, { sectionName: "asc" }],
    select: { id: true, classId: true, sectionName: true },
  });
  const sectionsByClass = new Map<string, Array<{ id: string; sectionName: string }>>();
  const sectionIdSetByClass = new Map<string, Set<string>>();
  for (const section of targetSections) {
    const list = sectionsByClass.get(section.classId) ?? [];
    list.push({ id: section.id, sectionName: section.sectionName });
    sectionsByClass.set(section.classId, list);
    const set = sectionIdSetByClass.get(section.classId) ?? new Set<string>();
    set.add(section.id);
    sectionIdSetByClass.set(section.classId, set);
  }

  const studentIds = promotionRecords.map((record) => record.studentId);
  const existingEnrollments = await prisma.studentEnrollment.findMany({
    where: {
      academicYearId: payload.toAcademicYearId,
      studentId: { in: studentIds },
    },
    select: { studentId: true, classId: true, sectionId: true },
  });
  const existingByStudent = new Map(
    existingEnrollments.map((entry) => [
      entry.studentId,
      { classId: entry.classId, sectionId: entry.sectionId },
    ])
  );

  const reportCards = await prisma.reportCard.findMany({
    where: {
      examId: { in: finalExamIds },
      studentId: { in: studentIds },
      OR: [{ isPublished: true }, { publishedAt: { not: null } }],
    },
    select: {
      examId: true,
      studentId: true,
      percentage: true,
      classRank: true,
      sectionRank: true,
    },
  });
  const reportCardByKey = new Map(
    reportCards.map((card) => [
      `${card.examId}:${card.studentId}`,
      {
        classRank: card.classRank ?? null,
        sectionRank: card.sectionRank ?? null,
        percentage: card.percentage ?? null,
      },
    ])
  );

  const shouldActivate = payload.activateNewYear ?? true;
  const shouldReset = payload.resetOperationalData ?? true;
  const promoteBy = payload.promoteBy ?? "RANK";

  const enrollmentsToCreate: Array<{
    studentId: string;
    academicYearId: string;
    classId: string;
    sectionId: string;
    rollNumber: number | null;
  }> = [];
  const promotionUpdates: Array<{
    id: string;
    status: string;
    promotedClassId: string | null;
    promotedSectionId: string | null;
    isFinalClass: boolean;
  }> = [];
  const promotedStudents = new Set<string>();
  let finalCount = 0;

  const candidatesByClass = new Map<
    string,
    Array<{
      record: typeof promotionRecords[number];
      targetClassId: string;
      finalStatus: string;
      isEligible: boolean;
      rankValue: number | null;
      percentage: number | null;
    }>
  >();
  for (const record of promotionRecords) {
    const isEligible = record.status === "ELIGIBLE" || record.isManuallyPromoted;
    const finalStatus = isEligible ? "PROMOTED" : "FAILED";
    const classOrder = record.class?.classOrder ?? null;
    if (classOrder == null) {
      throw new ApiError(400, "Promotion record class order missing");
    }

    const targetOrder = isEligible ? classOrder + 1 : classOrder;
    const targetClassId = toClassByOrder.get(targetOrder);
    if (!targetClassId) {
      if (isEligible) {
        promotionUpdates.push({
          id: record.id,
          status: finalStatus,
          promotedClassId: null,
          promotedSectionId: null,
          isFinalClass: true,
        });
        finalCount += 1;
        promotedStudents.add(record.studentId);
        continue;
      }
      throw new ApiError(400, `Target class not found for class order ${targetOrder}`);
    }

    const existing = existingByStudent.get(record.studentId);
    if (existing) {
      if (existing.classId !== targetClassId) {
        throw new ApiError(
          400,
          `Existing enrollment mismatch for student ${record.studentId}`
        );
      }
      const allowedSections = sectionIdSetByClass.get(targetClassId);
      if (!allowedSections || !allowedSections.has(existing.sectionId)) {
        throw new ApiError(
          400,
          `Existing enrollment section invalid for student ${record.studentId}`
        );
      }

      promotionUpdates.push({
        id: record.id,
        status: finalStatus,
        promotedClassId: existing.classId,
        promotedSectionId: existing.sectionId,
        isFinalClass: false,
      });
    } else {
      const examId = classToExamId.get(record.classId);
      const key = examId ? `${examId}:${record.studentId}` : "";
      const snapshot = key ? reportCardByKey.get(key) : null;
      const rankValue = snapshot?.classRank ?? snapshot?.sectionRank ?? null;
      const percentage = snapshot?.percentage
        ? Number(snapshot.percentage)
        : snapshot?.percentage === null
          ? null
          : null;

      const list = candidatesByClass.get(targetClassId) ?? [];
      list.push({
        record,
        targetClassId,
        finalStatus,
        isEligible,
        rankValue,
        percentage,
      });
      candidatesByClass.set(targetClassId, list);
    }

    if (isEligible) {
      promotedStudents.add(record.studentId);
    }
  }

  for (const [targetClassId, candidates] of candidatesByClass.entries()) {
    const sections = sectionsByClass.get(targetClassId) ?? [];
    if (sections.length === 0) {
      throw new ApiError(400, `No sections found for class ${targetClassId}`);
    }

    candidates.sort((a, b) => {
      const rankA = a.rankValue ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.rankValue ?? Number.MAX_SAFE_INTEGER;
      const pctA = a.percentage ?? -1;
      const pctB = b.percentage ?? -1;

      if (promoteBy === "PERCENTAGE") {
        if (pctA !== pctB) return pctB - pctA;
        if (rankA !== rankB) return rankA - rankB;
      } else {
        if (rankA !== rankB) return rankA - rankB;
        if (pctA !== pctB) return pctB - pctA;
      }
      const nameA = a.record.student?.fullName ?? "";
      const nameB = b.record.student?.fullName ?? "";
      const nameCmp = nameA.localeCompare(nameB);
      if (nameCmp !== 0) return nameCmp;
      return a.record.studentId.localeCompare(b.record.studentId);
    });

    candidates.forEach((candidate, index) => {
      const section = sections[index % sections.length];
      const mappedSectionId = section.id;

      enrollmentsToCreate.push({
        studentId: candidate.record.studentId,
        academicYearId: payload.toAcademicYearId,
        classId: targetClassId,
        sectionId: mappedSectionId,
        rollNumber: null,
      });

      promotionUpdates.push({
        id: candidate.record.id,
        status: candidate.finalStatus,
        promotedClassId: targetClassId,
        promotedSectionId: mappedSectionId,
        isFinalClass: false,
      });
    });
  }

  await prisma.$transaction(async (tx) => {
    const existingEnrollments = await tx.studentEnrollment.findMany({
      where: {
        academicYearId: payload.toAcademicYearId,
        studentId: { in: promotionRecords.map((r) => r.studentId) },
      },
      select: { studentId: true },
    });
    const existingIds = new Set(existingEnrollments.map((e) => e.studentId));
    const filteredEnrollments = enrollmentsToCreate.filter(
      (enrollment) => !existingIds.has(enrollment.studentId)
    );

    if (filteredEnrollments.length > 0) {
      await tx.studentEnrollment.createMany({ data: filteredEnrollments });
    }

    for (const update of promotionUpdates) {
      await tx.promotionRecord.update({
        where: { id: update.id },
        data: {
          status: update.status,
          promotedClassId: update.promotedClassId,
          promotedSectionId: update.promotedSectionId,
          isFinalClass: update.isFinalClass,
        },
      });
    }

    const remainingPreview = await tx.promotionRecord.count({
      where: {
        academicYearId: payload.fromAcademicYearId,
        status: { in: ["ELIGIBLE", "UNDER_CONSIDERATION", "NOT_PROMOTED"] },
        student: { schoolId, deletedAt: null },
      },
    });
    if (remainingPreview > 0) {
      throw new ApiError(
        500,
        "Promotion finalization did not normalize all promotion statuses"
      );
    }

    await tx.academicYear.update({
      where: { id: payload.fromAcademicYearId },
      data: { isLocked: true },
    });
  });

  if (shouldActivate) {
    await switchAcademicYear(
      schoolId,
      {
        fromAcademicYearId: payload.fromAcademicYearId,
        toAcademicYearId: payload.toAcademicYearId,
        resetOperationalData: shouldReset,
      },
      userId
    );
  }

  try {
    await triggerNotification("PROMOTION_PUBLISHED", {
      schoolId,
      studentIds: promotionRecords.map((record) => record.studentId),
      sentById: userId ?? undefined,
      metadata: {
        fromAcademicYearId: payload.fromAcademicYearId,
        toAcademicYearId: payload.toAcademicYearId,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] promotion publish failed", error);
    }
  }

  for (const update of promotionUpdates) {
    if (update.status !== "PROMOTED" || update.isFinalClass) continue;
    const record = recordById.get(update.id);
    if (!record) continue;
    await triggerNotification("STUDENT_PROMOTED", {
      schoolId,
      studentId: record.studentId,
      title: "Promotion Update",
      body: "You have been promoted to the next class.",
      entityType: "PROMOTION",
      linkUrl: "/student/promotion",
      metadata: {
        studentId: record.studentId,
        oldClass: record.classId,
        newClass: update.promotedClassId,
        newSection: update.promotedSectionId,
        routes: {
          STUDENT: "/student/promotion",
          PARENT: "/parent/promotion",
        },
      },
    });
  }

  return {
    promoted: promotedStudents.size,
    finalClassCompleted: finalCount,
    total: promotionRecords.length,
    activatedNewYear: shouldActivate,
  };
}

export async function listPromotionTransitions(
  schoolId: string,
  actor: ActorContext,
  params: PromotionTransitionInput
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const records = await prisma.promotionRecord.findMany({
    where: {
      academicYearId: params.fromAcademicYearId,
      student: { schoolId, deletedAt: null },
    },
    include: {
      student: { select: { id: true, fullName: true } },
      class: { select: { id: true, className: true } },
      section: { select: { id: true, sectionName: true } },
      promotedClass: { select: { id: true, className: true } },
      promotedSection: { select: { id: true, sectionName: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (records.length === 0) {
    return [];
  }

  const studentIds = Array.from(new Set(records.map((r) => r.studentId)));
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { academicYearId: params.toAcademicYearId, studentId: { in: studentIds } },
    select: {
      studentId: true,
      class: { select: { id: true, className: true } },
      section: { select: { id: true, sectionName: true } },
    },
  });
  const enrollmentByStudent = new Map(
    enrollments.map((e) => [
      e.studentId,
      { class: e.class ?? null, section: e.section ?? null },
    ])
  );

  const targetClassIds = new Set<string>();
  for (const record of records) {
    if (record.promotedClass?.id) targetClassIds.add(record.promotedClass.id);
  }
  for (const enrollment of enrollments) {
    if (enrollment.class?.id) targetClassIds.add(enrollment.class.id);
  }
  const targetSections =
    targetClassIds.size === 0
      ? []
      : await prisma.section.findMany({
          where: { classId: { in: Array.from(targetClassIds) }, deletedAt: null },
          select: { id: true, classId: true, sectionName: true },
          orderBy: [{ classId: "asc" }, { sectionName: "asc" }],
        });
  const sectionsByClass = new Map<string, Array<{ id: string; sectionName: string }>>();
  for (const section of targetSections) {
    const list = sectionsByClass.get(section.classId) ?? [];
    list.push({ id: section.id, sectionName: section.sectionName });
    sectionsByClass.set(section.classId, list);
  }

  return records.map((record) => {
    const enrollment = enrollmentByStudent.get(record.studentId) ?? null;
    const nextClass = record.promotedClass ?? enrollment?.class ?? null;
    const nextSection = record.promotedSection ?? enrollment?.section ?? null;
    const fromSectionName = record.section?.sectionName ?? null;
    const toSectionName = nextSection?.sectionName ?? null;
    const targetSectionsForClass = nextClass?.id
      ? sectionsByClass.get(nextClass.id) ?? []
      : [];
    const hasNameMatch = Boolean(
      fromSectionName &&
        targetSectionsForClass.some(
          (s) => s.sectionName.toLowerCase() === fromSectionName.toLowerCase()
        )
    );
    let sectionMapping: "NAME_MATCH" | "FALLBACK" | "NONE" = "NONE";
    let sectionMappingReason:
      | "NO_SOURCE_SECTION"
      | "NO_TARGET_SECTION"
      | "SECTION_NAME_MATCH"
      | "SECTION_NAME_MISMATCH"
      | "NO_SECTION_NAME_MATCH" = "NO_TARGET_SECTION";
    if (!fromSectionName) {
      sectionMapping = "NONE";
      sectionMappingReason = "NO_SOURCE_SECTION";
    } else if (!toSectionName) {
      sectionMapping = "NONE";
      sectionMappingReason = "NO_TARGET_SECTION";
    } else if (fromSectionName.toLowerCase() === toSectionName.toLowerCase()) {
      sectionMapping = "NAME_MATCH";
      sectionMappingReason = "SECTION_NAME_MATCH";
    } else if (hasNameMatch) {
      sectionMapping = "FALLBACK";
      sectionMappingReason = "SECTION_NAME_MISMATCH";
    } else {
      sectionMapping = "FALLBACK";
      sectionMappingReason = "NO_SECTION_NAME_MATCH";
    }

    let promotionType: "AUTO" | "MANUAL" | "FAILED" | "FINAL" = "FAILED";
    if (record.isFinalClass) {
      promotionType = "FINAL";
    } else if (record.isManuallyPromoted) {
      promotionType = "MANUAL";
    } else if (record.status === "ELIGIBLE" || record.status === "PROMOTED") {
      promotionType = "AUTO";
    }

    return {
      studentId: record.studentId,
      studentName: record.student.fullName,
      fromClass: record.class,
      fromSection: record.section,
      toClass: nextClass,
      toSection: nextSection,
      sectionMapping: {
        strategy: sectionMapping,
        reason: sectionMappingReason,
        fromSectionName,
        toSectionName,
      },
      promotionType,
      status: record.status,
    };
  });
}

export async function getRollNumberAssignmentStatus(
  schoolId: string,
  actor: ActorContext,
  academicYearId: string
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true, startDate: true },
  });
  if (!academicYear) {
    throw new ApiError(404, "Academic year not found");
  }

  const [totalEnrollments, pendingCount] = await Promise.all([
    prisma.studentEnrollment.count({
      where: { academicYearId, student: { schoolId, deletedAt: null } },
    }),
    prisma.studentEnrollment.count({
      where: { academicYearId, rollNumber: null, student: { schoolId, deletedAt: null } },
    }),
  ]);

  return {
    totalEnrollments,
    pendingCount,
    hasStudents: totalEnrollments > 0,
    hasPending: pendingCount > 0,
  };
}

export async function assignRollNumbers(
  schoolId: string,
  actor: ActorContext,
  academicYearId: string
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN" && roleType !== "SUPER_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true, startDate: true },
  });
  if (!academicYear) {
    throw new ApiError(404, "Academic year not found");
  }

  const totalEnrollments = await prisma.studentEnrollment.count({
    where: { academicYearId, student: { schoolId, deletedAt: null } },
  });
  if (totalEnrollments === 0) {
    throw new ApiError(400, "No students found for roll number assignment");
  }

  const classes = await prisma.class.findMany({
    where: { academicYearId, schoolId, deletedAt: null },
    select: { id: true, classOrder: true, className: true },
  });
  if (classes.length === 0) {
    throw new ApiError(400, "No classes found for roll number assignment");
  }

  const previousYear = await prisma.academicYear.findFirst({
    where: { schoolId, startDate: { lt: academicYear.startDate } },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  const finalClassNames = new Set<string>();
  if (previousYear) {
    const finalRecords = await prisma.promotionRecord.findMany({
      where: { academicYearId: previousYear.id, isFinalClass: true, student: { schoolId } },
      include: { class: { select: { classOrder: true, className: true } } },
    });
    for (const record of finalRecords) {
      if (record.class?.className) {
        finalClassNames.add(record.class.className.toLowerCase());
      }
    }
  }

  let updatedCount = 0;
  let skippedClasses = 0;

  await prisma.$transaction(async (tx) => {
    for (const cls of classes) {
      if (finalClassNames.has(cls.className.toLowerCase())) {
        skippedClasses += 1;
        continue;
      }
      const enrollments = await tx.studentEnrollment.findMany({
        where: {
          academicYearId,
          classId: cls.id,
          student: { schoolId, deletedAt: null },
        },
        select: {
          id: true,
          studentId: true,
          rollNumber: true,
          sectionId: true,
          student: { select: { fullName: true } },
          section: { select: { sectionName: true } },
        },
      });

      if (enrollments.length === 0) {
        skippedClasses += 1;
        continue;
      }

      const promotedIds = await tx.promotionRecord.findMany({
        where: {
          promotedClassId: cls.id,
          status: "PROMOTED",
          student: { schoolId, deletedAt: null },
        },
        select: { studentId: true },
      });
      const promotedSet = new Set(promotedIds.map((p) => p.studentId));

      const sections = new Map<string, typeof enrollments>();
      for (const enrollment of enrollments) {
        const list = sections.get(enrollment.sectionId) ?? [];
        list.push(enrollment);
        sections.set(enrollment.sectionId, list);
      }

      const orderedSectionIds = Array.from(sections.keys()).sort((a, b) => {
        const aName = sections.get(a)?.[0]?.section?.sectionName ?? "";
        const bName = sections.get(b)?.[0]?.section?.sectionName ?? "";
        return aName.localeCompare(bName);
      });

      for (const sectionId of orderedSectionIds) {
        const sectionEnrollments = sections.get(sectionId) ?? [];
        const ordered = sectionEnrollments.slice().sort((a, b) => {
          const aPromoted = promotedSet.has(a.studentId) ? 0 : 1;
          const bPromoted = promotedSet.has(b.studentId) ? 0 : 1;
          if (aPromoted !== bPromoted) return aPromoted - bPromoted;
          const nameCompare = a.student.fullName.localeCompare(b.student.fullName);
          if (nameCompare !== 0) return nameCompare;
          return a.studentId.localeCompare(b.studentId);
        });

        let roll = 1;
        for (const enrollment of ordered) {
          await tx.studentEnrollment.update({
            where: { id: enrollment.id },
            data: { rollNumber: roll },
          });
          roll += 1;
          updatedCount += 1;
        }
      }
    }
  });

  return {
    totalEnrollments,
    updatedCount,
    skippedClasses,
  };
}
