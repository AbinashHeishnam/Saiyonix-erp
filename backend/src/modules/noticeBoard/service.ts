import { Prisma, type NoticeBoard } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logAudit } from "@/utils/audit";
import { createAndDispatchNotification } from "@/services/notificationEngine";
import type { CreateNoticeInput, UpdateNoticeInput } from "@/modules/noticeBoard/validation";

type NoticeFilters = {
  noticeType?: string;
  active?: boolean;
  classId?: string;
  sectionId?: string;
  roleType?: string;
};

type NoticeActor = {
  userId: string;
  roleType: string;
};

function toSecureFileUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/v1/files/secure")) return value;
  return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}

function mapNoticeAttachments(attachments: unknown) {
  if (!Array.isArray(attachments)) return attachments;
  return attachments.map((item) => (typeof item === "string" ? toSecureFileUrl(item) : item));
}

async function getActiveAcademicYearId(schoolId: string): Promise<string | null> {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  return academicYear?.id ?? null;
}

async function resolveStudentTargets(schoolId: string, userId: string) {
  const academicYearId = await getActiveAcademicYearId(schoolId);
  if (!academicYearId) {
    return { classIds: [], sectionIds: [] };
  }

  const student = await prisma.student.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!student) {
    return { classIds: [], sectionIds: [] };
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId: student.id, academicYearId },
    select: { classId: true, sectionId: true },
  });

  return {
    classIds: enrollment?.classId ? [enrollment.classId] : [],
    sectionIds: enrollment?.sectionId ? [enrollment.sectionId] : [],
  };
}

async function resolveParentTargets(schoolId: string, userId: string) {
  const academicYearId = await getActiveAcademicYearId(schoolId);
  if (!academicYearId) {
    return { classIds: [], sectionIds: [] };
  }

  const parent = await prisma.parent.findFirst({
    where: { schoolId, userId },
    select: { id: true },
  });

  if (!parent) {
    return { classIds: [], sectionIds: [] };
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  });

  const studentIds = links.map((link) => link.studentId);
  if (studentIds.length === 0) {
    return { classIds: [], sectionIds: [] };
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId: { in: studentIds }, academicYearId },
    select: { classId: true, sectionId: true },
  });

  const classIds = new Set<string>();
  const sectionIds = new Set<string>();
  enrollments.forEach((enrollment) => {
    if (enrollment.classId) classIds.add(enrollment.classId);
    if (enrollment.sectionId) sectionIds.add(enrollment.sectionId);
  });

  return {
    classIds: Array.from(classIds),
    sectionIds: Array.from(sectionIds),
  };
}

async function resolveTeacherTargets(schoolId: string, userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    return { classIds: [], sectionIds: [] };
  }

  const academicYearId = await getActiveAcademicYearId(schoolId);

  const [classTeacherSections, subjectLinks] = await Promise.all([
    prisma.section.findMany({
      where: { classTeacherId: teacher.id, deletedAt: null, class: { schoolId, deletedAt: null } },
      select: { id: true, classId: true },
    }),
    prisma.teacherSubjectClass.findMany({
      where: {
        teacherId: teacher.id,
        ...(academicYearId ? { academicYearId } : {}),
      },
      select: {
        sectionId: true,
        classSubject: { select: { classId: true } },
      },
    }),
  ]);

  const classIds = new Set<string>();
  const sectionIds = new Set<string>();

  classTeacherSections.forEach((section) => {
    classIds.add(section.classId);
    sectionIds.add(section.id);
  });

  subjectLinks.forEach((link) => {
    if (link.classSubject?.classId) classIds.add(link.classSubject.classId);
    if (link.sectionId) sectionIds.add(link.sectionId);
  });

  return {
    classIds: Array.from(classIds),
    sectionIds: Array.from(sectionIds),
  };
}

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
        attachments: payload.attachments ?? Prisma.JsonNull,
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

    try {
      const targetType = notice.targetType ?? "ALL";
      if (!createdById) {
        return notice;
      }

      if (targetType === "ALL") {
        await createAndDispatchNotification({
          type: "NOTICE",
          title: notice.title,
          message: notice.content,
          senderId: createdById,
          targetType: "ALL",
          meta: {
            entityType: "NOTICE",
            entityId: notice.id,
            noticeId: notice.id,
            linkUrl: `/notices/${notice.id}`,
          },
        });
      } else if (targetType === "ROLE" && notice.targetRole) {
        const role =
          notice.targetRole === "TEACHER"
            ? "TEACHER"
            : notice.targetRole === "STUDENT"
              ? "STUDENT"
              : notice.targetRole === "PARENT"
                ? "PARENT"
                : "ADMIN";

        await createAndDispatchNotification({
          type: "NOTICE",
          title: notice.title,
          message: notice.content,
          senderId: createdById,
          targetType: "ROLE",
          role,
          meta: {
            entityType: "NOTICE",
            entityId: notice.id,
            noticeId: notice.id,
            linkUrl: `/notices/${notice.id}`,
          },
        });
      } else if (targetType === "CLASS" && notice.targetClassId) {
        await createAndDispatchNotification({
          type: "NOTICE",
          title: notice.title,
          message: notice.content,
          senderId: createdById,
          targetType: "CLASS",
          classId: notice.targetClassId,
          meta: {
            entityType: "NOTICE",
            entityId: notice.id,
            noticeId: notice.id,
            linkUrl: `/notices/${notice.id}`,
            includeParents: true,
          },
        });
      } else if (targetType === "SECTION" && notice.targetSectionId) {
        const section = await prisma.section.findFirst({
          where: { id: notice.targetSectionId, deletedAt: null, class: { schoolId, deletedAt: null } },
          select: { classId: true },
        });

        if (section?.classId) {
          await createAndDispatchNotification({
            type: "NOTICE",
            title: notice.title,
            message: notice.content,
            senderId: createdById,
            targetType: "CLASS",
            classId: section.classId,
            meta: {
              entityType: "NOTICE",
              entityId: notice.id,
              noticeId: notice.id,
              linkUrl: `/notices/${notice.id}`,
              sectionId: notice.targetSectionId,
              includeParents: true,
            },
          });
        }
      }
    } catch (error) {
      console.warn("[notice] notification trigger failed", error);
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
          OR: [{ targetType: "ALL" }, ...targetFilters],
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
        content: true,
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
        attachments: true,
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.noticeBoard.count({ where }),
  ]);

  const mappedItems = items.map((item) => ({
    ...item,
    attachments: mapNoticeAttachments(item.attachments),
  }));

  return { items: mappedItems, total };
}

export async function listNoticesForActor(
  schoolId: string,
  actor: NoticeActor,
  pagination?: { skip: number; take: number },
  options?: { active?: boolean }
) {
  const roleType = actor.roleType;
  const isAdmin =
    roleType === "ADMIN" ||
    roleType === "SUPER_ADMIN" ||
    roleType === "ACADEMIC_SUB_ADMIN";

  if (isAdmin) {
    return listNotices(
      schoolId,
      { active: options?.active ?? false },
      pagination
    );
  }

  if (roleType === "TEACHER") {
    return listNotices(
      schoolId,
      { active: options?.active ?? true },
      pagination
    );
  }

  const now = new Date();
  const baseWhere: Prisma.NoticeBoardWhereInput = {
    schoolId,
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };

  const targetFilters: Prisma.NoticeBoardWhereInput[] = [{ targetType: "ALL" }];

  let classIds: string[] = [];
  let sectionIds: string[] = [];

  if (roleType === "STUDENT") {
    const targets = await resolveStudentTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "STUDENT" });
  } else if (roleType === "PARENT") {
    const targets = await resolveParentTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "PARENT" });
  } else if (roleType === "TEACHER") {
    const targets = await resolveTeacherTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "TEACHER" });
  }

  classIds.forEach((classId) => {
    targetFilters.push({ targetType: "CLASS", targetClassId: classId });
  });

  sectionIds.forEach((sectionId) => {
    targetFilters.push({ targetType: "SECTION", targetSectionId: sectionId });
  });

  const where: Prisma.NoticeBoardWhereInput = {
    ...baseWhere,
    OR: targetFilters,
  };

  const [items, total] = await prisma.$transaction([
    prisma.noticeBoard.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
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
        attachments: true,
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.noticeBoard.count({ where }),
  ]);

  const mappedItems = items.map((item) => ({
    ...item,
    attachments: mapNoticeAttachments(item.attachments),
  }));

  return { items: mappedItems, total };
}

export async function getNoticeById(schoolId: string, id: string) {
  const notice = await prisma.noticeBoard.findFirst({
    where: { id, schoolId },
  });

  if (!notice) {
    throw new ApiError(404, "Notice not found");
  }

  return { ...notice, attachments: mapNoticeAttachments(notice.attachments) };
}

export async function getNoticeForActor(
  schoolId: string,
  id: string,
  actor: NoticeActor
) {
  const roleType = actor.roleType;
  const isAdmin =
    roleType === "ADMIN" ||
    roleType === "SUPER_ADMIN" ||
    roleType === "ACADEMIC_SUB_ADMIN";

  if (isAdmin) {
    return getNoticeById(schoolId, id);
  }

  if (roleType === "TEACHER") {
    const now = new Date();
    const notice = await prisma.noticeBoard.findFirst({
      where: {
        id,
        schoolId,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    });

    if (!notice) {
      throw new ApiError(404, "Notice not found");
    }

    return { ...notice, attachments: mapNoticeAttachments(notice.attachments) };
  }

  const now = new Date();
  const targetFilters: Prisma.NoticeBoardWhereInput[] = [{ targetType: "ALL" }];

  let classIds: string[] = [];
  let sectionIds: string[] = [];

  if (roleType === "STUDENT") {
    const targets = await resolveStudentTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "STUDENT" });
  } else if (roleType === "PARENT") {
    const targets = await resolveParentTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "PARENT" });
  } else if (roleType === "TEACHER") {
    const targets = await resolveTeacherTargets(schoolId, actor.userId);
    classIds = targets.classIds;
    sectionIds = targets.sectionIds;
    targetFilters.push({ targetType: "ROLE", targetRole: "TEACHER" });
  }

  classIds.forEach((classId) => {
    targetFilters.push({ targetType: "CLASS", targetClassId: classId });
  });

  sectionIds.forEach((sectionId) => {
    targetFilters.push({ targetType: "SECTION", targetSectionId: sectionId });
  });

  const notice = await prisma.noticeBoard.findFirst({
    where: {
      id,
      schoolId,
      publishedAt: { lte: now },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        { OR: targetFilters },
      ],
    },
  });

  if (!notice) {
    throw new ApiError(404, "Notice not found");
  }

  return { ...notice, attachments: mapNoticeAttachments(notice.attachments) };
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
        ...(payload.attachments !== undefined ? { attachments: payload.attachments } : {}),
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
