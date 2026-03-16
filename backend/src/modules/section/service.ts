import { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import type { CreateSectionInput, UpdateSectionInput } from "./validation";

async function ensureClassBelongsToSchool(schoolId: string, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!classRecord) {
    throw new ApiError(400, "Class not found for this school");
  }
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Section already exists for this class");
    }

    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }

  throw error;
}

export async function createSection(schoolId: string, payload: CreateSectionInput) {
  await ensureClassBelongsToSchool(schoolId, payload.classId);

  try {
    return await prisma.section.create({
      data: {
        classId: payload.classId,
        sectionName: payload.sectionName,
        capacity: payload.capacity,
        classTeacherId: payload.classTeacherId,
      },
      include: {
        class: {
          select: {
            id: true,
            className: true,
          },
        },
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listSections(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = {
    deletedAt: null,
    class: {
      schoolId,
      deletedAt: null,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.section.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            className: true,
          },
        },
      },
      orderBy: [{ class: { classOrder: "asc" } }, { sectionName: "asc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.section.count({ where }),
  ]);

  return { items, total };
}

export async function getSectionById(schoolId: string, id: string) {
  const section = await prisma.section.findFirst({
    where: {
      id,
      deletedAt: null,
      class: {
        schoolId,
        deletedAt: null,
      },
    },
    include: {
      class: {
        select: {
          id: true,
          className: true,
        },
      },
    },
  });

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  return section;
}

export async function updateSection(
  schoolId: string,
  id: string,
  payload: UpdateSectionInput
) {
  await getSectionById(schoolId, id);

  if (payload.classId) {
    await ensureClassBelongsToSchool(schoolId, payload.classId);
  }

  try {
    return await prisma.section.update({
      where: { id },
      data: {
        ...(payload.classId !== undefined ? { classId: payload.classId } : {}),
        ...(payload.sectionName !== undefined ? { sectionName: payload.sectionName } : {}),
        ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
        ...(payload.classTeacherId !== undefined
          ? { classTeacherId: payload.classTeacherId }
          : {}),
      },
      include: {
        class: {
          select: {
            id: true,
            className: true,
          },
        },
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteSection(schoolId: string, id: string) {
  await getSectionById(schoolId, id);

  const section = await prisma.section.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
    select: { id: true },
  });

  return section;
}
