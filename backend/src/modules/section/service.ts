import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";
import { ApiError } from "@/core/errors/apiError";
import type { CreateSectionInput, UpdateSectionInput } from "@/modules/section/validation";

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

async function getActiveAcademicYearId(schoolId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  return academicYear.id;
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

  if (payload.classTeacherId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: payload.classId, schoolId, deletedAt: null },
      select: { academicYearId: true },
    });

    if (!classRecord) {
      throw new ApiError(400, "Class not found for this school");
    }

    const existingTeacherAssignment = await prisma.section.findFirst({
      where: {
        classTeacherId: payload.classTeacherId,
        deletedAt: null,
        class: {
          academicYearId: classRecord.academicYearId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (existingTeacherAssignment) {
      throw new ApiError(400, "Teacher already assigned as class teacher for this academic year");
    }
  }

  const existing = await prisma.section.findFirst({
    where: { classId: payload.classId, sectionName: payload.sectionName },
    select: { id: true, deletedAt: true },
  });

  if (existing && !existing.deletedAt) {
    throw new ApiError(409, "Section already exists for this class");
  }

  try {
    if (existing?.deletedAt) {
      const restored = await prisma.section.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
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

      if (payload.classTeacherId) {
        await notifySectionClassTeacherAssigned(schoolId, restored.id, payload.classTeacherId);
      }

      return restored;
    }

    const created = await prisma.section.create({
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

    if (payload.classTeacherId) {
      await notifySectionClassTeacherAssigned(schoolId, created.id, payload.classTeacherId);
    }

    return created;
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listSections(
  schoolId: string,
  filters?: { academicYearId?: string; classId?: string },
  pagination?: { skip: number; take: number }
) {
  const resolvedAcademicYearId =
    filters?.academicYearId ?? (await getActiveAcademicYearId(schoolId));
  const where = {
    deletedAt: null,
    ...(filters?.classId ? { classId: filters.classId } : {}),
    class: {
      schoolId,
      academicYearId: resolvedAcademicYearId,
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
  const existingSection = await getSectionById(schoolId, id);

  if (payload.classId) {
    await ensureClassBelongsToSchool(schoolId, payload.classId);
  }

  if (payload.classTeacherId) {
    const targetClassId = payload.classId ?? existingSection.classId;
    const classRecord = await prisma.class.findFirst({
      where: { id: targetClassId, schoolId, deletedAt: null },
      select: { academicYearId: true },
    });

    if (!classRecord) {
      throw new ApiError(400, "Class not found for this school");
    }

    const existingTeacherAssignment = await prisma.section.findFirst({
      where: {
        classTeacherId: payload.classTeacherId,
        deletedAt: null,
        id: { not: id },
        class: {
          academicYearId: classRecord.academicYearId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (existingTeacherAssignment) {
      throw new ApiError(400, "Teacher already assigned as class teacher for this academic year");
    }
  }

  try {
    const updated = await prisma.section.update({
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

    if (
      payload.classTeacherId !== undefined &&
      payload.classTeacherId &&
      payload.classTeacherId !== existingSection.classTeacherId
    ) {
      await notifySectionClassTeacherAssigned(schoolId, updated.id, payload.classTeacherId);
    }

    return updated;
  } catch (error) {
    mapPrismaError(error);
  }
}

async function notifySectionClassTeacherAssigned(
  schoolId: string,
  sectionId: string,
  teacherId: string
) {
  try {
    const [section, teacher] = await Promise.all([
      prisma.section.findFirst({
        where: { id: sectionId, deletedAt: null, class: { schoolId, deletedAt: null } },
        select: { id: true, sectionName: true, class: { select: { id: true, className: true } } },
      }),
      prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, deletedAt: null },
        select: { id: true, fullName: true, userId: true },
      }),
    ]);

    if (!section || !teacher) return;

    const recipients = new Set<string>();
    const classRecipients = await collectClassRecipients({
      schoolId,
      classId: section.class.id,
      sectionId: section.id,
    });
    classRecipients.forEach((id) => recipients.add(id));
    if (teacher.userId) recipients.add(teacher.userId);

    if (recipients.size) {
      await trigger("CLASS_TEACHER_ASSIGNED", {
        schoolId,
        classId: section.class.id,
        className: section.class.className,
        sectionId: section.id,
        sectionName: section.sectionName,
        userIds: Array.from(recipients),
        metadata: {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
        },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] section class teacher assignment failed", error);
    }
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
