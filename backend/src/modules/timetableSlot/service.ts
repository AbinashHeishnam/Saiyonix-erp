import { Prisma } from "@prisma/client";

import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import type { CreateTimetableSlotInput, UpdateTimetableSlotInput } from "./validation";

type ClassSubjectLookup = {
  classId: string;
  academicYearId: string;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : undefined;

  if (code === "P2002") {
    throw new ApiError(409, "Timetable slot conflict detected");
  }

  if (code === "P2003") {
    throw new ApiError(400, "Invalid relation reference");
  }

  throw error;
}

async function ensureAcademicYearBelongsToSchool(
  client: DbClient,
  schoolId: string,
  academicYearId: string
) {
  const academicYear = await client.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function ensureTeacherBelongsToSchool(
  client: DbClient,
  schoolId: string,
  teacherId: string
) {
  const teacher = await client.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(400, "Teacher not found for this school");
  }
}

async function ensurePeriodBelongsToSchool(
  client: DbClient,
  schoolId: string,
  periodId: string
) {
  const period = await client.period.findFirst({
    where: { id: periodId, schoolId },
    select: { id: true },
  });

  if (!period) {
    throw new ApiError(400, "Period not found for this school");
  }
}

async function ensureSectionBelongsToSchool(
  client: DbClient,
  schoolId: string,
  sectionId: string
) {
  const section = await client.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true, classId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function ensureClassSubjectBelongsToSchool(
  client: DbClient,
  schoolId: string,
  classSubjectId: string
): Promise<ClassSubjectLookup> {
  const classSubject = await client.classSubject.findFirst({
    where: {
      id: classSubjectId,
      class: { schoolId, deletedAt: null },
      subject: { schoolId },
    },
    select: {
      id: true,
      classId: true,
      class: { select: { academicYearId: true } },
    },
  });

  if (!classSubject) {
    throw new ApiError(400, "Class subject mapping not found for this school");
  }

  return {
    classId: classSubject.classId,
    academicYearId: classSubject.class.academicYearId,
  };
}

async function ensureTeacherAssignmentExists(
  client: DbClient,
  params: {
  schoolId: string;
  teacherId: string;
  classSubjectId: string;
  sectionId: string;
  academicYearId: string;
}) {
  const assignment = await client.teacherSubjectClass.findFirst({
    where: {
      teacherId: params.teacherId,
      classSubjectId: params.classSubjectId,
      academicYearId: params.academicYearId,
      OR: [{ sectionId: params.sectionId }, { sectionId: null }],
      classSubject: {
        class: { schoolId: params.schoolId, deletedAt: null },
        subject: { schoolId: params.schoolId },
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new ApiError(
      400,
      "Teacher is not assigned to this subject/class/section for this academic year"
    );
  }
}

async function ensureSectionMatchesClass(
  client: DbClient,
  sectionId: string,
  classId: string
) {
  const section = await client.section.findFirst({
    where: { id: sectionId, deletedAt: null, classId },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(400, "Section does not belong to the selected class");
  }
}

async function ensureNoSectionConflict(
  client: DbClient,
  params: {
  sectionId: string;
  dayOfWeek: number;
  periodId: string;
  excludeId?: string;
}) {
  const existing = await client.timetableSlot.findFirst({
    where: {
      sectionId: params.sectionId,
      dayOfWeek: params.dayOfWeek,
      periodId: params.periodId,
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Section already has a timetable slot for this period");
  }
}

async function ensureNoTeacherConflict(
  client: DbClient,
  params: {
  teacherId: string;
  academicYearId: string;
  dayOfWeek: number;
  periodId: string;
  excludeId?: string;
}) {
  const existing = await client.timetableSlot.findFirst({
    where: {
      teacherId: params.teacherId,
      academicYearId: params.academicYearId,
      dayOfWeek: params.dayOfWeek,
      periodId: params.periodId,
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Teacher is already assigned for this period");
  }
}

async function getTimetableSlotByIdWithClient(
  client: DbClient,
  schoolId: string,
  id: string
) {
  const record = await client.timetableSlot.findFirst({
    where: {
      id,
      section: {
        class: { schoolId, deletedAt: null },
        deletedAt: null,
      },
      classSubject: {
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
    },
    include: {
      section: true,
      classSubject: { include: { class: true, subject: true } },
      teacher: true,
      academicYear: true,
      period: true,
    },
  });

  if (!record) {
    throw new ApiError(404, "Timetable slot not found");
  }

  return record;
}

export async function createTimetableSlot(
  schoolId: string,
  payload: CreateTimetableSlotInput
) {
  try {
    return await prisma.$transaction(async (tx) => {
      await ensureSectionBelongsToSchool(tx, schoolId, payload.sectionId);
      const classSubject = await ensureClassSubjectBelongsToSchool(
        tx,
        schoolId,
        payload.classSubjectId
      );
      await ensureAcademicYearBelongsToSchool(tx, schoolId, payload.academicYearId);
      await ensurePeriodBelongsToSchool(tx, schoolId, payload.periodId);

      await ensureSectionMatchesClass(tx, payload.sectionId, classSubject.classId);

      if (classSubject.academicYearId !== payload.academicYearId) {
        throw new ApiError(400, "Class subject does not belong to this academic year");
      }

      if (payload.teacherId) {
        await ensureTeacherBelongsToSchool(tx, schoolId, payload.teacherId);
        await ensureTeacherAssignmentExists(tx, {
          schoolId,
          teacherId: payload.teacherId,
          classSubjectId: payload.classSubjectId,
          sectionId: payload.sectionId,
          academicYearId: payload.academicYearId,
        });
      }

      await ensureNoSectionConflict(tx, {
        sectionId: payload.sectionId,
        dayOfWeek: payload.dayOfWeek,
        periodId: payload.periodId,
      });

      if (payload.teacherId) {
        await ensureNoTeacherConflict(tx, {
          teacherId: payload.teacherId,
          academicYearId: payload.academicYearId,
          dayOfWeek: payload.dayOfWeek,
          periodId: payload.periodId,
        });
      }

      return tx.timetableSlot.create({
        data: {
          sectionId: payload.sectionId,
          classSubjectId: payload.classSubjectId,
          teacherId: payload.teacherId ?? null,
          academicYearId: payload.academicYearId,
          dayOfWeek: payload.dayOfWeek,
          periodId: payload.periodId,
          roomNo: payload.roomNo,
        },
        include: {
          section: true,
          classSubject: { include: { class: true, subject: true } },
          teacher: true,
          academicYear: true,
          period: true,
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listTimetableSlots(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = {
    section: {
      class: { schoolId, deletedAt: null },
      deletedAt: null,
    },
    classSubject: {
      class: { schoolId, deletedAt: null },
      subject: { schoolId },
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.timetableSlot.findMany({
      where,
      include: {
        section: true,
        classSubject: { include: { class: true, subject: true } },
        teacher: true,
        academicYear: true,
        period: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.timetableSlot.count({ where }),
  ]);

  return { items, total };
}

export async function getTimetableSlotById(schoolId: string, id: string) {
  return getTimetableSlotByIdWithClient(prisma, schoolId, id);
}

export async function updateTimetableSlot(
  schoolId: string,
  id: string,
  payload: UpdateTimetableSlotInput
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await getTimetableSlotByIdWithClient(tx, schoolId, id);

      const sectionId = payload.sectionId ?? existing.sectionId;
      const classSubjectId = payload.classSubjectId ?? existing.classSubjectId;
      const teacherId = payload.teacherId ?? existing.teacherId ?? undefined;
      const academicYearId = payload.academicYearId ?? existing.academicYearId;
      const dayOfWeek = payload.dayOfWeek ?? existing.dayOfWeek;
      const periodId = payload.periodId ?? existing.periodId;

      await ensureSectionBelongsToSchool(tx, schoolId, sectionId);
      const classSubject = await ensureClassSubjectBelongsToSchool(
        tx,
        schoolId,
        classSubjectId
      );
      await ensureAcademicYearBelongsToSchool(tx, schoolId, academicYearId);
      await ensurePeriodBelongsToSchool(tx, schoolId, periodId);

      await ensureSectionMatchesClass(tx, sectionId, classSubject.classId);

      if (classSubject.academicYearId !== academicYearId) {
        throw new ApiError(400, "Class subject does not belong to this academic year");
      }

      if (teacherId) {
        await ensureTeacherBelongsToSchool(tx, schoolId, teacherId);
        await ensureTeacherAssignmentExists(tx, {
          schoolId,
          teacherId,
          classSubjectId,
          sectionId,
          academicYearId,
        });
      }

      await ensureNoSectionConflict(tx, {
        sectionId,
        dayOfWeek,
        periodId,
        excludeId: id,
      });

      if (teacherId) {
        await ensureNoTeacherConflict(tx, {
          teacherId,
          academicYearId,
          dayOfWeek,
          periodId,
          excludeId: id,
        });
      }

      return tx.timetableSlot.update({
        where: { id },
        data: {
          ...(payload.sectionId !== undefined ? { sectionId: payload.sectionId } : {}),
          ...(payload.classSubjectId !== undefined
            ? { classSubjectId: payload.classSubjectId }
            : {}),
          ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
          ...(payload.academicYearId !== undefined
            ? { academicYearId: payload.academicYearId }
            : {}),
          ...(payload.dayOfWeek !== undefined ? { dayOfWeek: payload.dayOfWeek } : {}),
          ...(payload.periodId !== undefined ? { periodId: payload.periodId } : {}),
          ...(payload.roomNo !== undefined ? { roomNo: payload.roomNo } : {}),
        },
        include: {
          section: true,
          classSubject: { include: { class: true, subject: true } },
          teacher: true,
          academicYear: true,
          period: true,
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteTimetableSlot(schoolId: string, id: string) {
  await getTimetableSlotById(schoolId, id);

  try {
    await prisma.timetableSlot.delete({
      where: { id },
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return { id };
}
