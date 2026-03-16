import type { NoticeBoard, Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { logAudit } from "../../utils/audit";
import type { CreateNoticeInput, UpdateNoticeInput } from "./validation";

type NoticeFilters = {
  noticeType?: string;
  active?: boolean;
  classId?: string;
  sectionId?: string;
  roleType?: string;
};

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "P2002") {
    throw new ApiError(409, "Duplicate notice record");
  }

  throw error;
}

async function ensureNoticeExists(schoolId: string, id: string) {
  const notice = await prisma.noticeBoard.findFirst({
    where: { id, schoolId },
  });

  if (!notice) {
    throw new ApiError(404, "Notice not found");
  }

  return notice;
}

export async function createNotice(
  schoolId: string,
  payload: CreateNoticeInput,
  createdById?: string
): Promise<NoticeBoard> {
  try {
    const notice = await prisma.noticeBoard.create({
      data: {
        schoolId,
        title: payload.title,
        content: payload.content,
        noticeType: payload.noticeType,
        isPublic: payload.isPublic ?? false,
        targetType: payload.targetType ?? "ALL",
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
        entity: "NoticeBoard",
        entityId: notice.id,
        metadata: {
          schoolId,
          title: notice.title,
        },
      });
    }

    return notice;
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function listNotices(
  schoolId: string,
  filters: NoticeFilters,
  pagination?: { skip: number; take: number }
) {
  const now = new Date();
  const targetFilters: Prisma.NoticeBoardWhereInput[] = [];

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
      targetRole: filters.roleType as never,
    });
  }

  const where: Prisma.NoticeBoardWhereInput = {
    schoolId,
    ...(filters.noticeType ? { noticeType: filters.noticeType } : {}),
    ...(filters.active
      ? {
          publishedAt: { lte: now },
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: now } },
          ],
        }
      : {}),
    ...(targetFilters.length > 0
      ? {
          OR: [
            { targetType: "ALL" },
            { targetType: null as never },
            ...targetFilters,
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.noticeBoard.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        noticeType: true,
        isPublic: true,
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
    prisma.noticeBoard.count({ where }),
  ]);

  return { items, total };
}

export async function getNoticeById(schoolId: string, id: string) {
  const notice = await prisma.noticeBoard.findFirst({
    where: { id, schoolId },
  });

  if (!notice) {
    throw new ApiError(404, "Notice not found");
  }

  return notice;
}

export async function updateNotice(
  schoolId: string,
  id: string,
  payload: UpdateNoticeInput,
  updatedById?: string
): Promise<NoticeBoard> {
  await ensureNoticeExists(schoolId, id);

  try {
    const notice = await prisma.noticeBoard.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.content !== undefined ? { content: payload.content } : {}),
        ...(payload.noticeType !== undefined ? { noticeType: payload.noticeType } : {}),
        ...(payload.isPublic !== undefined ? { isPublic: payload.isPublic } : {}),
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
        entity: "NoticeBoard",
        entityId: notice.id,
        metadata: {
          schoolId,
          title: notice.title,
        },
      });
    }

    return notice;
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function deleteNotice(
  schoolId: string,
  id: string,
  deletedById?: string
) {
  const notice = await ensureNoticeExists(schoolId, id);

  try {
    await prisma.noticeBoard.delete({
      where: { id },
    });

    if (deletedById) {
      await logAudit({
        userId: deletedById,
        action: "DELETE",
        entity: "NoticeBoard",
        entityId: notice.id,
        metadata: {
          schoolId,
          title: notice.title,
        },
      });
    }
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }

  return { id };
}
