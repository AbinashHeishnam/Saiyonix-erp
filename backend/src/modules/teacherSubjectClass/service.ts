import { Prisma } from "@prisma/client";

import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import type {
  CreateTeacherSubjectClassInput,
  TeacherSubjectClassFilters,
  UpdateTeacherSubjectClassInput,
} from "./validation";

type DbClient = Prisma.TransactionClient | typeof prisma;

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : undefined;

  if (code === "P2002") {
    throw new ApiError(409, "Teacher assignment already exists");
  }

  if (code === "P2003") {
    throw new ApiError(400, "Invalid relation reference");
  }

  throw error;
}

async function ensureTeacherBelongsToSchool(
  client: DbClient,
  schoolId: string,
  teacherId: string
) {
  const teacher = await client.teacher.findFirst({
    where: {
      id: teacherId,
      schoolId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(400, "Teacher not found for this school");
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
      class: {
        schoolId,
        deletedAt: null,
      },
      subject: {
        schoolId,
      },
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

async function ensureSectionBelongsToSchool(
  client: DbClient,
  schoolId: string,
  sectionId: string
) {
  const section = await client.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: {
        schoolId,
        deletedAt: null,
      },
    },
    select: { id: true, classId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function ensureAcademicYearBelongsToSchool(
  client: DbClient,
  schoolId: string,
  academicYearId: string
) {
  const academicYear = await client.academicYear.findFirst({
    where: {
      id: academicYearId,
      schoolId,
    },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function getTeacherSubjectClassByIdWithClient(
  client: DbClient,
  schoolId: string,
  id: string
) {
  const record = await client.teacherSubjectClass.findFirst({
    where: {
      id,
      classSubject: {
        class: {
          schoolId,
          deletedAt: null,
        },
        subject: {
          schoolId,
        },
      },
      teacher: {
        schoolId,
        deletedAt: null,
      },
    },
    include: {
      teacher: true,
      classSubject: {
        include: {
          class: true,
          subject: true,
        },
      },
      section: true,
      academicYear: true,
    },
  });

  if (!record) {
    throw new ApiError(404, "Teacher subject assignment not found");
  }

  return record;
}

export async function createTeacherSubjectClass(
  schoolId: string,
  payload: CreateTeacherSubjectClassInput
) {
  try {
    return await prisma.$transaction(async (tx) => {
      await ensureTeacherBelongsToSchool(tx, schoolId, payload.teacherId);
      const classSubject = await ensureClassSubjectBelongsToSchool(
        tx,
        schoolId,
        payload.classSubjectId
      );
      if (!classSubject) {
        throw new ApiError(400, "Class subject mapping not found for this school");
      }
      await ensureAcademicYearBelongsToSchool(tx, schoolId, payload.academicYearId);

      if (payload.sectionId) {
        const section = await ensureSectionBelongsToSchool(
          tx,
          schoolId,
          payload.sectionId
        );
        if (section.classId !== classSubject.classId) {
          throw new ApiError(400, "Section does not belong to the selected class");
        }
      }

      if (classSubject.academicYearId !== payload.academicYearId) {
        throw new ApiError(400, "Class subject does not belong to this academic year");
      }

      return tx.teacherSubjectClass.create({
        data: {
          teacherId: payload.teacherId,
          classSubjectId: payload.classSubjectId,
          sectionId: payload.sectionId ?? null,
          academicYearId: payload.academicYearId,
        },
        include: {
          teacher: true,
          classSubject: {
            include: {
              class: true,
              subject: true,
            },
          },
          section: true,
          academicYear: true,
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function getTeacherSubjectClasses(
  schoolId: string,
  filters: TeacherSubjectClassFilters,
  pagination?: { skip: number; take: number }
) {
  const whereClause: Prisma.TeacherSubjectClassWhereInput = {
    teacherId: filters.teacherId,
    sectionId: filters.sectionId,
    classSubject: filters.classId
      ? {
          classId: filters.classId,
          class: {
            schoolId,
            deletedAt: null,
          },
          subject: {
            schoolId,
          },
        }
      : {
          class: {
            schoolId,
            deletedAt: null,
          },
          subject: {
            schoolId,
          },
        },
    teacher: {
      schoolId,
      deletedAt: null,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.teacherSubjectClass.findMany({
      where: whereClause,
      include: {
        teacher: true,
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        section: true,
        academicYear: true,
      },
      orderBy: { createdAt: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.teacherSubjectClass.count({ where: whereClause }),
  ]);

  return { items, total };
}

export async function getTeacherSubjectClassById(schoolId: string, id: string) {
  return getTeacherSubjectClassByIdWithClient(prisma, schoolId, id);
}

export async function updateTeacherSubjectClass(
  schoolId: string,
  id: string,
  payload: UpdateTeacherSubjectClassInput
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await getTeacherSubjectClassByIdWithClient(tx, schoolId, id);

      if (payload.teacherId) {
        await ensureTeacherBelongsToSchool(tx, schoolId, payload.teacherId);
      }

      const classSubject = payload.classSubjectId
        ? await ensureClassSubjectBelongsToSchool(
            tx,
            schoolId,
            payload.classSubjectId
          )
        : {
            classId: existing.classSubject.classId,
            academicYearId: existing.classSubject.class.academicYearId,
          };

      if (payload.academicYearId) {
        await ensureAcademicYearBelongsToSchool(
          tx,
          schoolId,
          payload.academicYearId
        );
      }

      if (payload.sectionId !== undefined && payload.sectionId !== null) {
        const section = await ensureSectionBelongsToSchool(
          tx,
          schoolId,
          payload.sectionId
        );
        if (classSubject && section.classId !== classSubject.classId) {
          throw new ApiError(400, "Section does not belong to the selected class");
        }
      }

      if (classSubject) {
        const academicYearId = payload.academicYearId ?? existing.academicYearId;
        if (classSubject.academicYearId !== academicYearId) {
          throw new ApiError(400, "Class subject does not belong to this academic year");
        }
      }

      return tx.teacherSubjectClass.update({
        where: { id },
        data: {
          ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
          ...(payload.classSubjectId !== undefined
            ? { classSubjectId: payload.classSubjectId }
            : {}),
          ...(payload.sectionId !== undefined ? { sectionId: payload.sectionId } : {}),
          ...(payload.academicYearId !== undefined
            ? { academicYearId: payload.academicYearId }
            : {}),
        },
        include: {
          teacher: true,
          classSubject: {
            include: {
              class: true,
              subject: true,
            },
          },
          section: true,
          academicYear: true,
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteTeacherSubjectClass(schoolId: string, id: string) {
  await getTeacherSubjectClassById(schoolId, id);

  try {
    await prisma.teacherSubjectClass.delete({
      where: { id },
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return { id };
}
