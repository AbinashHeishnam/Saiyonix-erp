import { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import type { CreateClassInput, UpdateClassInput } from "./validation";

async function ensureAcademicYearBelongsToSchool(schoolId: string, academicYearId: string) {
  const academicYear = await prisma.academicYear.findFirst({
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

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Class already exists for this academic year");
    }

    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }

  throw error;
}

export async function createClass(schoolId: string, payload: CreateClassInput) {
  await ensureAcademicYearBelongsToSchool(schoolId, payload.academicYearId);

  try {
    return await prisma.class.create({
      data: {
        schoolId,
        academicYearId: payload.academicYearId,
        className: payload.className,
        classOrder: payload.classOrder,
        isHalfDay: payload.isHalfDay ?? false,
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listClasses(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = {
    schoolId,
    deletedAt: null,
  };

  const [items, total] = await prisma.$transaction([
    prisma.class.findMany({
      where,
      include: {
        academicYear: {
          select: {
            id: true,
            label: true,
          },
        },
      },
      orderBy: [{ classOrder: "asc" }, { className: "asc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.class.count({ where }),
  ]);

  return { items, total };
}

export async function getClassById(schoolId: string, id: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id,
      schoolId,
      deletedAt: null,
    },
    include: {
      academicYear: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  });

  if (!classRecord) {
    throw new ApiError(404, "Class not found");
  }

  return classRecord;
}

export async function updateClass(schoolId: string, id: string, payload: UpdateClassInput) {
  await getClassById(schoolId, id);

  if (payload.academicYearId) {
    await ensureAcademicYearBelongsToSchool(schoolId, payload.academicYearId);
  }

  try {
    return await prisma.class.update({
      where: { id },
      data: {
        ...(payload.className !== undefined ? { className: payload.className } : {}),
        ...(payload.classOrder !== undefined ? { classOrder: payload.classOrder } : {}),
        ...(payload.academicYearId !== undefined
          ? { academicYearId: payload.academicYearId }
          : {}),
        ...(payload.isHalfDay !== undefined ? { isHalfDay: payload.isHalfDay } : {}),
      },
      include: {
        academicYear: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteClass(schoolId: string, id: string) {
  await getClassById(schoolId, id);

  const classRecord = await prisma.class.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
    select: { id: true },
  });

  return classRecord;
}
