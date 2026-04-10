import { Prisma, ExamShift } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logAudit } from "@/utils/audit";
import { chunkArray } from "@/core/utils/perf";
import { logger } from "@/utils/logger";
import { cacheInvalidateByPrefix } from "@/core/cacheService";
import { resolveStudentEnrollmentForPortal } from "@/modules/student/enrollmentUtils";
import type {
  AddExamSubjectInput,
  AddExamTimetableInput,
  CreateExamInput,
  ListExamQueryInput,
} from "@/modules/exams/validation";

type DbClient = typeof prisma;

type ActorContext = {
  userId?: string;
  roleType?: string;
};

let supportsTimetablePublishedAt: boolean | null = null;

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

async function resolveStudentForActor(
  schoolId: string,
  actor: ActorContext,
  studentIdFromPayload?: string | null
) {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    return student.id;
  }

  if (roleType === "PARENT") {
    if (!studentIdFromPayload) {
      throw new ApiError(400, "studentId is required for parent registration");
    }
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        studentId: studentIdFromPayload,
        parent: { is: { userId, schoolId } },
        student: { schoolId, deletedAt: null },
      },
      select: { studentId: true },
    });
    if (!link) {
      throw new ApiError(403, "Parent is not linked to this student");
    }
    return link.studentId;
  }

  if (!studentIdFromPayload) {
    throw new ApiError(400, "studentId is required");
  }

  if (!isAdminRole(roleType) && roleType !== "FINANCE_SUB_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  return studentIdFromPayload;
}

async function getClassIdsForExam(client: DbClient, schoolId: string, examId: string) {
  const examSubjects = await client.examSubject.findMany({
    where: {
      examId,
      exam: { schoolId },
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: { classSubject: { select: { classId: true } } },
  });

  const classIds = new Set<string>();
  for (const subject of examSubjects) {
    classIds.add(subject.classSubject.classId);
  }

  return Array.from(classIds);
}

async function ensureStudentInExamClass(
  client: DbClient,
  schoolId: string,
  examId: string,
  academicYearId: string,
  studentId: string
) {
  const classIds = await getClassIdsForExam(client, schoolId, examId);
  if (classIds.length === 0) {
    throw new ApiError(404, "Exam has no subjects");
  }

  const enrollment = await client.studentEnrollment.findFirst({
    where: {
      studentId,
      academicYearId,
      student: { schoolId, deletedAt: null },
      class: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { classId: true },
  });

  if (!enrollment || !classIds.includes(enrollment.classId)) {
    throw new ApiError(404, "Student not eligible for this exam");
  }

  return enrollment.classId;
}

function toTimeDate(time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`1970-01-01T${normalized}.000Z`);
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Duplicate record");
    }

    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }

  throw error;
}

async function ensureAcademicYearBelongsToSchool(
  client: DbClient,
  schoolId: string,
  academicYearId: string
) {
  const record = await client.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });

  if (!record) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function ensureClassSubjectBelongsToSchool(
  client: DbClient,
  schoolId: string,
  classSubjectId: string
) {
  const classSubject = await client.classSubject.findFirst({
    where: {
      id: classSubjectId,
      class: { schoolId, deletedAt: null },
      subject: { schoolId },
    },
    select: { id: true, classId: true },
  });

  if (!classSubject) {
    throw new ApiError(400, "Class subject mapping not found for this school");
  }

  return classSubject;
}

async function resolveStudentContextForActor(
  schoolId: string,
  actor: ActorContext
): Promise<{ classId: string; sectionId: string; academicYearId: string }> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: student.id,
      allowPreviousYear: true,
    });

    return {
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
    };
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { studentId: true },
    });

    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: link.studentId,
      allowPreviousYear: true,
    });

    return {
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
    };
  }

  throw new ApiError(403, "Forbidden");
}

async function ensureExamExists(schoolId: string, id: string) {
  const exam = await prisma.exam.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      isPublished: true,
      isLocked: true,
      isFinalExam: true,
      academicYearId: true,
      timetablePublishedAt: true,
    },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  return exam;
}

async function getExamDetailsOrThrow(schoolId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: {
      id: true,
      schoolId: true,
      academicYearId: true,
      termNo: true,
      title: true,
      type: true,
      startsOn: true,
      endsOn: true,
      isPublished: true,
      isLocked: true,
      isFinalExam: true,
      timetablePublishedAt: true,
      createdAt: true,
      updatedAt: true,
      examSubjects: {
        select: {
          id: true,
          classSubjectId: true,
          maxMarks: true,
          passMarks: true,
          classSubject: {
            select: {
              id: true,
              classId: true,
              class: { select: { className: true } },
              subject: { select: { name: true } },
            },
          },
          timetable: {
            orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
            select: {
              id: true,
              examDate: true,
              startTime: true,
              endTime: true,
              venue: true,
            },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  return exam;
}

export async function createExam(
  schoolId: string,
  payload: CreateExamInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const db = tx as DbClient;
      await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);

      return tx.exam.create({
        data: {
          schoolId,
          academicYearId: payload.academicYearId,
          termNo: payload.termNo,
          title: payload.title,
          isPublished: false,
          isLocked: false,
          isFinalExam: Boolean(payload.isFinalExam),
        },
        select: {
          id: true,
          schoolId: true,
          academicYearId: true,
          termNo: true,
          title: true,
          isPublished: true,
          isLocked: true,
          isFinalExam: true,
          timetablePublishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function addExamSubject(
  schoolId: string,
  examId: string,
  payload: AddExamSubjectInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (exam.isLocked) {
    throw new ApiError(400, "Exam is locked");
  }

  const existing = await prisma.examSubject.findFirst({
    where: { examId, classSubjectId: payload.classSubjectId },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Subject already added to this exam");
  }
  await ensureClassSubjectBelongsToSchool(prisma, schoolId, payload.classSubjectId);
  if (exam.isFinalExam) {
    const classSubject = await prisma.classSubject.findFirst({
      where: { id: payload.classSubjectId, class: { schoolId, deletedAt: null } },
      select: { classId: true },
    });
    if (!classSubject) {
      throw new ApiError(404, "Class subject not found");
    }
    const existingFinal = await prisma.examSubject.findFirst({
      where: {
        classSubject: { classId: classSubject.classId },
        exam: {
          schoolId,
          academicYearId: exam.academicYearId,
          isFinalExam: true,
          id: { not: exam.id },
        },
      },
      select: { id: true },
    });
    if (existingFinal) {
      throw new ApiError(409, "Final exam already set for this class");
    }
  }

  try {
    return await prisma.examSubject.create({
      data: {
        examId,
        classSubjectId: payload.classSubjectId,
        maxMarks: new Prisma.Decimal(payload.maxMarks),
        passMarks: new Prisma.Decimal(payload.passMarks),
      },
      select: {
        id: true,
        examId: true,
        classSubjectId: true,
        maxMarks: true,
        passMarks: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function addExamTimetable(
  schoolId: string,
  examId: string,
  payload: AddExamTimetableInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (exam.isLocked) {
    throw new ApiError(400, "Exam is locked");
  }
  if (!payload.items || payload.items.length === 0) {
    throw new ApiError(400, "Timetable payload cannot be empty");
  }

  return prisma.$transaction(async (tx) => {
    const examSubjects = await tx.examSubject.findMany({
      where: {
        examId,
        classSubject: { class: { schoolId, deletedAt: null } },
      },
      select: {
        id: true,
        classSubjectId: true,
        classSubject: { select: { classId: true } },
      },
    });
    const allowedIds = new Set(examSubjects.map((item) => item.id));
    const subjectClassMap = new Map(
      examSubjects.map((item) => [item.id, item.classSubject.classId])
    );
    const subjectIdMap = new Map(
      examSubjects.map((item) => [item.id, item.classSubjectId])
    );

    const invalid = payload.items.find((item) => !allowedIds.has(item.examSubjectId));
    if (invalid) {
      throw new ApiError(400, "Invalid exam subject for this exam");
    }

    const classSubjectIdsInPayload = payload.items.map((item) => {
      const classSubjectId = subjectIdMap.get(item.examSubjectId);
      if (!classSubjectId) {
        throw new ApiError(400, "Invalid exam subject for this exam");
      }
      return classSubjectId;
    });
    const uniqueClassSubjectIds = new Set(classSubjectIdsInPayload);
    if (uniqueClassSubjectIds.size !== classSubjectIdsInPayload.length) {
      throw new ApiError(400, "Duplicate class subject in timetable payload");
    }

    const conflicts: Array<{ index: number; reason: string }> = [];
    const payloadSlots = payload.items.map((item, index) => {
      const classId = subjectClassMap.get(item.examSubjectId);
      if (!classId) {
        throw new ApiError(400, "Invalid exam subject for this exam");
      }

      const dayKey = item.examDate.toISOString().split("T")[0];
      return {
        index,
        examSubjectId: item.examSubjectId,
        classId,
        examDate: item.examDate,
        dayKey,
        startTime: toTimeDate(item.startTime),
        endTime: toTimeDate(item.endTime),
      };
    });

    for (let i = 0; i < payloadSlots.length; i += 1) {
      for (let j = i + 1; j < payloadSlots.length; j += 1) {
        const a = payloadSlots[i];
        const b = payloadSlots[j];
        if (a.classId !== b.classId) continue;
        if (a.dayKey !== b.dayKey) continue;
        const overlap = a.startTime < b.endTime && b.startTime < a.endTime;
        if (overlap) {
          conflicts.push({ index: j, reason: "Overlapping timetable entry in request" });
        }
      }
    }

    if (conflicts.length > 0) {
      throw new ApiError(409, "Overlapping timetable entry detected", { conflicts });
    }

    const classIds = Array.from(new Set(payloadSlots.map((slot) => slot.classId)));

    const existingSlots = await tx.examTimetable.findMany({
      where: {
        examSubject: {
          examId,
          classSubject: { classId: { in: classIds } },
        },
      },
      select: {
        examDate: true,
        startTime: true,
        endTime: true,
        examSubject: { select: { classSubject: { select: { classId: true } } } },
      },
    });

    for (const slot of payloadSlots) {
      for (const existing of existingSlots) {
        if (existing.examSubject.classSubject.classId !== slot.classId) continue;
        const existingDayKey = existing.examDate.toISOString().split("T")[0];
        if (existingDayKey !== slot.dayKey) continue;
        const overlap = slot.startTime < existing.endTime && existing.startTime < slot.endTime;
        if (overlap) {
          throw new ApiError(409, "Overlapping timetable entry detected");
        }
      }
    }

    try {
      const created: Array<{
        id: string;
        examSubjectId: string;
        examDate: Date;
        startTime: Date;
        endTime: Date;
        venue: string | null;
        shift: ExamShift;
        createdAt: Date;
        updatedAt: Date;
      }> = [];
      const chunks = chunkArray(payloadSlots, 100);
      for (const chunk of chunks) {
        const createdChunk = await Promise.all(
          chunk.map((item) =>
            tx.examTimetable.create({
              data: {
                examSubjectId: item.examSubjectId,
                examDate: item.examDate,
                startTime: item.startTime,
                endTime: item.endTime,
                venue: payload.items[item.index].venue ?? null,
              },
              select: {
                id: true,
                examSubjectId: true,
                examDate: true,
                startTime: true,
                endTime: true,
                venue: true,
                shift: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          )
        );
        created.push(...createdChunk);
      }

      return created;
    } catch (error) {
      mapPrismaError(error);
      throw error;
    }
  });
}

export async function getExamById(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const enrollment = await resolveStudentContextForActor(schoolId, actor);

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        schoolId,
        isPublished: true,
        examSubjects: {
          some: {
            classSubject: {
              classId: enrollment.classId,
              class: { schoolId, deletedAt: null },
            },
          },
        },
      },
      select: {
        id: true,
        schoolId: true,
        academicYearId: true,
        termNo: true,
        title: true,
        isPublished: true,
        isLocked: true,
        timetablePublishedAt: true,
        createdAt: true,
        updatedAt: true,
        examSubjects: {
          select: {
            id: true,
            classSubjectId: true,
            maxMarks: true,
            passMarks: true,
            timetable: {
              orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
              select: {
                id: true,
                examDate: true,
                startTime: true,
                endTime: true,
                venue: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }

    if (!exam.timetablePublishedAt) {
      return {
        ...exam,
        examSubjects: exam.examSubjects.map((subject) => ({
          ...subject,
          timetable: [],
        })),
      };
    }

    return exam;
  }

  if (roleType === "TEACHER" || isAdminRole(roleType)) {
    return getExamDetailsOrThrow(schoolId, examId);
  }

  throw new ApiError(403, "Forbidden");
}

export async function listExams(
  schoolId: string,
  filters: ListExamQueryInput,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
) {
  const { roleType } = ensureActor(actor);

  let where: Prisma.ExamWhereInput = { schoolId };

  if (filters.academicYearId) {
    where = { ...where, academicYearId: filters.academicYearId };
  }

  if (filters.classId) {
    where = {
      ...where,
      examSubjects: {
        some: {
          classSubject: {
            classId: filters.classId,
            class: { schoolId, deletedAt: null },
          },
        },
      },
    };
  }

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const enrollment = await resolveStudentContextForActor(schoolId, actor);
    where = {
      ...where,
      isPublished: true,
      examSubjects: {
        some: {
          classSubject: {
            classId: enrollment.classId,
            class: { schoolId, deletedAt: null },
          },
        },
      },
    };
  } else if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const useTimetablePublishedAt = supportsTimetablePublishedAt !== false;

  const [items, total] = await prisma
    .$transaction([
      prisma.exam.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          schoolId: true,
          academicYearId: true,
          termNo: true,
          title: true,
          type: true,
          isFinalExam: true,
          startsOn: true,
          endsOn: true,
          isPublished: true,
          isLocked: true,
          ...(useTimetablePublishedAt ? { timetablePublishedAt: true } : {}),
          createdAt: true,
          updatedAt: true,
        },
        ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
      }),
      prisma.exam.count({ where }),
    ])
    .then((result) => {
      supportsTimetablePublishedAt = true;
      return result;
    })
    .catch(async (error) => {
      supportsTimetablePublishedAt = false;
      logger.warn(
        `[exams] listExams fallback: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      const [fallbackItems, fallbackTotal] = await prisma.$transaction([
        prisma.exam.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            schoolId: true,
            academicYearId: true,
            termNo: true,
            title: true,
            type: true,
            startsOn: true,
            endsOn: true,
            isPublished: true,
            isLocked: true,
            createdAt: true,
            updatedAt: true,
          },
          ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.exam.count({ where }),
      ]);

      return [
        fallbackItems.map((item) => ({
          ...item,
          timetablePublishedAt: null,
        })),
        fallbackTotal,
      ] as const;
    });

  return { items, total };
}

export async function publishExam(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (exam.isPublished) {
    return getExamDetailsOrThrow(schoolId, examId);
  }
  if (exam.isLocked) {
    throw new ApiError(400, "Exam is locked");
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { isPublished: true },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function lockExam(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (exam.isLocked) {
    return getExamDetailsOrThrow(schoolId, examId);
  }
  if (!exam.isPublished) {
    throw new ApiError(400, "Exam must be published before locking");
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { isLocked: true },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function unlockExam(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (!exam.isLocked) {
    return getExamDetailsOrThrow(schoolId, examId);
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { isLocked: false },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function lockExamMarks(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType, userId } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (exam.isLocked) {
    return getExamDetailsOrThrow(schoolId, examId);
  }
  if (!exam.isPublished) {
    throw new ApiError(400, "Exam must be published before locking marks");
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { isLocked: true },
  });

  await logAudit({
    userId,
    action: "MARKS_LOCKED",
    entity: "Exam",
    entityId: examId,
    metadata: { examId },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function unlockExamMarks(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType, userId } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  if (!exam.isLocked) {
    return getExamDetailsOrThrow(schoolId, examId);
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { isLocked: false },
  });

  await logAudit({
    userId,
    action: "MARKS_UNLOCKED",
    entity: "Exam",
    entityId: examId,
    metadata: { examId },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function publishExamTimetable(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await ensureExamExists(schoolId, examId);
  const hasTimetable = await prisma.examTimetable.findFirst({
    where: {
      examSubject: { examId },
    },
    select: { id: true },
  });

  if (!hasTimetable) {
    throw new ApiError(400, "Exam timetable not found");
  }

  if (exam.timetablePublishedAt) {
    return getExamDetailsOrThrow(schoolId, examId);
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { timetablePublishedAt: new Date() },
  });

  return getExamDetailsOrThrow(schoolId, examId);
}

export async function registerForExam(
  schoolId: string,
  examId: string,
  actor: ActorContext,
  studentIdFromPayload?: string | null
) {
  const studentId = await resolveStudentForActor(schoolId, actor, studentIdFromPayload);

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, academicYearId: true, isPublished: true },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (!exam.isPublished) {
    throw new ApiError(400, "Exam is not published");
  }

  const classId = await ensureStudentInExamClass(
    prisma,
    schoolId,
    examId,
    exam.academicYearId,
    studentId
  );

  const fee = await prisma.feeRecord.findFirst({
    where: { studentId, academicYearId: exam.academicYearId, isActive: true },
    select: { status: true },
  });
  console.log("ROLE:", actor.roleType);
  console.log("FEE STATUS:", fee?.status ?? "MISSING");
  if (!fee || fee.status !== "PAID") {
    throw new ApiError(403, "Fee not paid");
  }

  // fee status enforced above via active fee record

  const existing = await prisma.examRegistration.findUnique({
    where: { studentId_examId: { studentId, examId } },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(400, "Already registered for this exam");
  }

  const created = await prisma.examRegistration.create({
    data: { examId, studentId, status: "REGISTERED" },
  });

  const response = {
    id: created.id,
    examId: created.examId,
    studentId: created.studentId,
    status: created.status,
    createdAt: created.createdAt,
  };
  await cacheInvalidateByPrefix(`admitEligibility:${studentId}:${examId}`);
  return response;
}

export async function listExamRegistrations(
  schoolId: string,
  actor: ActorContext,
  studentIdFromPayload?: string | null
) {
  const studentId = await resolveStudentForActor(schoolId, actor, studentIdFromPayload);

  const registrations = await prisma.examRegistration.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: {
      examId: true,
      status: true,
      createdAt: true,
      exam: { select: { title: true, termNo: true, type: true } },
    },
  });

  return registrations.map((row) => ({
    examId: row.examId,
    status: row.status,
    createdAt: row.createdAt,
    title: row.exam?.title ?? null,
    termNo: row.exam?.termNo ?? null,
    type: row.exam?.type ?? null,
  }));
}

export async function listExamRegistrationsAdmin(
  schoolId: string,
  actor: ActorContext,
  examId: string
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType) && roleType !== "ACADEMIC_SUB_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, academicYearId: true, title: true, termNo: true },
  });
  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const registrations = await prisma.examRegistration.findMany({
    where: { examId, status: "REGISTERED" },
    select: { studentId: true, createdAt: true, status: true },
  });

  const studentIds = registrations.map((row) => row.studentId);
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      studentId: { in: studentIds },
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      studentId: true,
      class: { select: { className: true } },
      section: { select: { sectionName: true } },
      rollNumber: true,
    },
  });

  const enrollmentByStudent = new Map(
    enrollments.map((row) => [row.studentId, row])
  );

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId, deletedAt: null },
    select: { id: true, fullName: true, registrationNumber: true },
  });

  const studentById = new Map(students.map((row) => [row.id, row]));

  return registrations.map((row) => {
    const student = studentById.get(row.studentId);
    const enrollment = enrollmentByStudent.get(row.studentId);
    return {
      examId,
      examTitle: exam.title,
      termNo: exam.termNo,
      studentId: row.studentId,
      studentName: student?.fullName ?? null,
      registrationNumber: student?.registrationNumber ?? null,
      className: enrollment?.class?.className ?? null,
      sectionName: enrollment?.section?.sectionName ?? null,
      rollNumber: enrollment?.rollNumber ?? null,
      status: row.status,
      registeredAt: row.createdAt,
    };
  });
}
