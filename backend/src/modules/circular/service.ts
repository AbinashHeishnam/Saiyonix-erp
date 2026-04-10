import { Prisma } from "@prisma/client";
import type { Circular, UserRole } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logAudit } from "@/utils/audit";
import type { CreateCircularInput, UpdateCircularInput } from "@/modules/circular/validation";

type CircularFilters = {
  classId?: string;
  sectionId?: string;
  roleType?: UserRole;
};

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "P2002") {
    throw new ApiError(409, "Duplicate circular record");
  }

  throw error;
}

async function ensureCircularExists(schoolId: string, id: string) {
  const circular = await prisma.circular.findFirst({
    where: { id, schoolId },
  });

  if (!circular) {
    throw new ApiError(404, "Circular not found");
  }

  return circular;
}

export async function createCircular(
  schoolId: string,
  payload: CreateCircularInput,
  createdById?: string
): Promise<Circular> {
  try {
    const circular = await prisma.circular.create({
      data: {
        schoolId,
        title: payload.title,
        body: payload.body,
        attachments: payload.attachments ?? Prisma.JsonNull,
        targetType: payload.targetType,
        targetClassId: payload.targetClassId ?? null,
        targetSectionId: payload.targetSectionId ?? null,
        targetRole: payload.targetRole ?? null,
        publishedAt: payload.publishedAt ?? new Date(),
        expiresAt: payload.expiresAt ?? null,
        createdById: createdById ?? null,
      },
    });

    if (createdById) {
      await logAudit({
        userId: createdById,
        action: "CREATE",
        entity: "Circular",
        entityId: circular.id,
        metadata: {
          schoolId,
          title: circular.title,
        },
      });
    }

    return circular;
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function listCirculars(
  schoolId: string,
  filters: CircularFilters,
  pagination?: { skip: number; take: number }
) {
  const now = new Date();
  const targetFilters: Prisma.CircularWhereInput[] = [];

  if (filters.classId) {
    targetFilters.push({
      targetType: "CLASS",
      targetClassId: filters.classId,
    });
  }

  if (filters.sectionId) {
    targetFilters.push({
      targetType: "SECTION",
      targetSectionId: filters.sectionId,
    });
  }

  if (filters.roleType) {
    targetFilters.push({
      targetType: "ROLE",
      targetRole: filters.roleType,
    });
  }

  const where: Prisma.CircularWhereInput = {
    schoolId,
    AND: [
      {
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    ],
    ...(targetFilters.length > 0
      ? { OR: [{ targetType: "ALL" }, ...targetFilters] }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.circular.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        body: true,
        targetType: true,
        targetClassId: true,
        targetSectionId: true,
        targetRole: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.circular.count({ where }),
  ]);

  return { items, total };
}

export async function getCircularById(schoolId: string, id: string) {
  const circular = await prisma.circular.findFirst({
    where: { id, schoolId },
  });

  if (!circular) {
    throw new ApiError(404, "Circular not found");
  }

  return circular;
}

export async function updateCircular(
  schoolId: string,
  id: string,
  payload: UpdateCircularInput,
  updatedById?: string
): Promise<Circular> {
  await ensureCircularExists(schoolId, id);

  try {
    const circular = await prisma.circular.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.body !== undefined ? { body: payload.body } : {}),
        ...(payload.attachments !== undefined
          ? { attachments: payload.attachments ?? Prisma.JsonNull }
          : {}),
        ...(payload.targetType !== undefined ? { targetType: payload.targetType } : {}),
        ...(payload.targetClassId !== undefined
          ? { targetClassId: payload.targetClassId }
          : {}),
        ...(payload.targetSectionId !== undefined
          ? { targetSectionId: payload.targetSectionId }
          : {}),
        ...(payload.targetRole !== undefined ? { targetRole: payload.targetRole } : {}),
        ...(payload.publishedAt !== undefined
          ? { publishedAt: payload.publishedAt }
          : {}),
        ...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
      },
    });

    if (updatedById) {
      await logAudit({
        userId: updatedById,
        action: "UPDATE",
        entity: "Circular",
        entityId: circular.id,
        metadata: {
          schoolId,
          title: circular.title,
        },
      });
    }

    return circular;
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function deleteCircular(
  schoolId: string,
  id: string,
  deletedById?: string
) {
  const circular = await ensureCircularExists(schoolId, id);

  try {
    await prisma.circular.delete({
      where: { id },
    });

    if (deletedById) {
      await logAudit({
        userId: deletedById,
        action: "DELETE",
        entity: "Circular",
        entityId: circular.id,
        metadata: {
          schoolId,
          title: circular.title,
        },
      });
    }
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }

  return { id };
}
