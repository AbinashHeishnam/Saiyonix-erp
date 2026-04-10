import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type { CreateSyllabusInput, CreateTopicInput, UpdateTopicInput } from "@/modules/syllabus/validation";

type DbClient = typeof prisma;

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type SyllabusFilters = {
  classSubjectId: string;
};

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "P2002") {
    throw new ApiError(409, "Duplicate record");
  }

  throw error;
}

async function resolveTeacherIdForActor(
  schoolId: string,
  actor: ActorContext
): Promise<string> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can perform this action");
  }

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId,
      schoolId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  return teacher.id;
}

async function resolveStudentContextForActor(
  schoolId: string,
  actor: ActorContext
): Promise<{ classId: string; sectionId: string }> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        student: { schoolId, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      select: { classId: true, sectionId: true },
    });

    if (!enrollment) {
      throw new ApiError(404, "Student enrollment not found");
    }

    return enrollment;
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

    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: link.studentId,
        student: { schoolId, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      select: { classId: true, sectionId: true },
    });

    if (!enrollment) {
      throw new ApiError(404, "Student enrollment not found");
    }

    return enrollment;
  }

  throw new ApiError(403, "Forbidden");
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
    },
  });

  if (!classSubject) {
    throw new ApiError(400, "Class subject mapping not found for this school");
  }

  return classSubject;
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

async function ensureSyllabusExists(schoolId: string, id: string) {
  const syllabus = await prisma.syllabus.findFirst({
    where: {
      id,
      classSubject: {
        class: { schoolId, deletedAt: null },
      },
    },
    select: {
      id: true,
      classSubjectId: true,
      academicYearId: true,
      isPublished: true,
    },
  });

  if (!syllabus) {
    throw new ApiError(404, "Syllabus not found");
  }

  return syllabus;
}

export async function createSyllabus(
  schoolId: string,
  payload: CreateSyllabusInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  const isTeacher = roleType === "TEACHER";
  const isAdmin = isAdminRole(roleType);

  if (!isTeacher && !isAdmin) {
    throw new ApiError(403, "Forbidden");
  }

  // publishedById is used as the creator reference for syllabus records.
  const publishedById = isTeacher ? await resolveTeacherIdForActor(schoolId, actor) : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const db = tx as DbClient;
      await ensureClassSubjectBelongsToSchool(db, schoolId, payload.classSubjectId);
      await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);

      return tx.syllabus.create({
        data: {
          classSubjectId: payload.classSubjectId,
          academicYearId: payload.academicYearId,
          title: payload.title,
          description: payload.description ?? null,
          publishedById,
          isPublished: false,
        },
        select: {
          id: true,
          classSubjectId: true,
          academicYearId: true,
          title: true,
          description: true,
          publishedById: true,
          isPublished: true,
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

export async function addTopic(
  schoolId: string,
  syllabusId: string,
  payload: CreateTopicInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  await ensureSyllabusExists(schoolId, syllabusId);

  try {
    return await prisma.syllabusTopic.create({
      data: {
        syllabusId,
        topicName: payload.title,
        sequenceNo: payload.sequenceNo,
      },
      select: {
        id: true,
        syllabusId: true,
        topicName: true,
        sequenceNo: true,
        isCovered: true,
        coveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function updateTopic(
  schoolId: string,
  topicId: string,
  payload: UpdateTopicInput,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const topic = await prisma.syllabusTopic.findFirst({
    where: {
      id: topicId,
      syllabus: {
        classSubject: {
          class: { schoolId, deletedAt: null },
        },
      },
    },
    select: { id: true, syllabusId: true },
  });

  if (!topic) {
    throw new ApiError(404, "Syllabus topic not found");
  }

  if (payload.sequenceNo !== undefined) {
    const duplicate = await prisma.syllabusTopic.findFirst({
      where: {
        syllabusId: topic.syllabusId,
        sequenceNo: payload.sequenceNo,
        id: { not: topicId },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ApiError(409, "Sequence number already exists for this syllabus");
    }
  }

  return prisma.syllabusTopic.update({
    where: { id: topicId },
    data: {
      ...(payload.title !== undefined ? { topicName: payload.title } : {}),
      ...(payload.sequenceNo !== undefined ? { sequenceNo: payload.sequenceNo } : {}),
    },
    select: {
      id: true,
      syllabusId: true,
      topicName: true,
      sequenceNo: true,
      isCovered: true,
      coveredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteTopic(
  schoolId: string,
  topicId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const topic = await prisma.syllabusTopic.findFirst({
    where: {
      id: topicId,
      syllabus: {
        classSubject: {
          class: { schoolId, deletedAt: null },
        },
      },
    },
    select: { id: true },
  });

  if (!topic) {
    throw new ApiError(404, "Syllabus topic not found");
  }

  const progressExists = await prisma.syllabusProgressLog.findFirst({
    where: { syllabusTopicId: topicId },
    select: { id: true },
  });

  if (progressExists) {
    throw new ApiError(400, "Cannot delete topic with progress");
  }

  await prisma.syllabusTopic.delete({
    where: { id: topicId },
  });

  return { id: topicId };
}

export async function listSyllabus(
  schoolId: string,
  filters: SyllabusFilters,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const enrollment = await resolveStudentContextForActor(schoolId, actor);

    const classSubject = await prisma.classSubject.findFirst({
      where: {
        id: filters.classSubjectId,
        classId: enrollment.classId,
        class: { schoolId, deletedAt: null },
      },
      select: { id: true },
    });

    if (!classSubject) {
      throw new ApiError(404, "Syllabus not found");
    }
  } else if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  return prisma.syllabus.findMany({
    where: {
      classSubjectId: filters.classSubjectId,
      classSubject: {
        class: { schoolId, deletedAt: null },
      },
      ...(roleType === "STUDENT" || roleType === "PARENT" ? { isPublished: true } : {}),
    },
    select: {
      id: true,
      classSubjectId: true,
      academicYearId: true,
      title: true,
      description: true,
      publishedById: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
      classSubject: {
        select: {
          id: true,
          class: { select: { id: true, className: true } },
          subject: { select: { id: true, name: true } },
        },
      },
      topics: {
        orderBy: { sequenceNo: "asc" },
        select: {
          id: true,
          syllabusId: true,
          topicName: true,
          sequenceNo: true,
          isCovered: true,
          coveredAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function completeTopic(
  schoolId: string,
  topicId: string,
  actor: ActorContext
) {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  const topic = await prisma.syllabusTopic.findFirst({
    where: {
      id: topicId,
      syllabus: {
        classSubject: {
          class: { schoolId, deletedAt: null },
        },
      },
    },
    select: { id: true },
  });

  if (!topic) {
    throw new ApiError(404, "Syllabus topic not found");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existingLog = await tx.syllabusProgressLog.findFirst({
          where: {
            syllabusTopicId: topicId,
            teacherId,
          },
          select: {
            id: true,
            syllabusTopicId: true,
            teacherId: true,
            action: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (existingLog) {
          return existingLog;
        }

        return tx.syllabusProgressLog.create({
          data: {
            syllabusTopicId: topicId,
            teacherId,
            action: "COMPLETED",
          },
          select: {
            id: true,
            syllabusTopicId: true,
            teacherId: true,
            action: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";

    if (code === "P2034") {
      const existingLog = await prisma.syllabusProgressLog.findFirst({
        where: { syllabusTopicId: topicId, teacherId },
        select: {
          id: true,
          syllabusTopicId: true,
          teacherId: true,
          action: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (existingLog) {
        return existingLog;
      }
    }

    throw error;
  }
}

export async function getSyllabusProgress(
  schoolId: string,
  syllabusId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  const teacherId = roleType === "TEACHER" ? await resolveTeacherIdForActor(schoolId, actor) : null;

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const enrollment = await resolveStudentContextForActor(schoolId, actor);
    const syllabus = await prisma.syllabus.findFirst({
      where: {
        id: syllabusId,
        classSubject: {
          classId: enrollment.classId,
          class: { schoolId, deletedAt: null },
        },
        isPublished: true,
      },
      select: { id: true },
    });

    if (!syllabus) {
      throw new ApiError(404, "Syllabus not found");
    }
  } else if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const totalTopics = await prisma.syllabusTopic.count({
    where: {
      syllabusId,
      syllabus: {
        classSubject: { class: { schoolId, deletedAt: null } },
      },
    },
  });

  const completedTopics = await prisma.syllabusProgressLog.findMany({
    where: {
      action: "COMPLETED",
      ...(teacherId ? { teacherId } : {}),
      syllabusTopic: {
        syllabusId,
        syllabus: {
          classSubject: { class: { schoolId, deletedAt: null } },
        },
      },
    },
    distinct: ["syllabusTopicId"],
    select: { syllabusTopicId: true },
  });
  const completedTopicsCount = completedTopics.length;

  const percentage =
    totalTopics === 0
      ? 0
      : Number(((completedTopicsCount / totalTopics) * 100).toFixed(2));

  return { totalTopics, completedTopics: completedTopicsCount, percentage };
}

export async function publishSyllabus(
  schoolId: string,
  syllabusId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" && !isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const syllabus = await ensureSyllabusExists(schoolId, syllabusId);
  if (syllabus.isPublished) {
    return { id: syllabus.id, isPublished: true };
  }

  const updated = await prisma.syllabus.update({
    where: { id: syllabus.id },
    data: { isPublished: true },
    select: { id: true, isPublished: true },
  });

  return updated;
}
