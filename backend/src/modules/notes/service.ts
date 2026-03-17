import type { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import type { CreateNoteInput, UpdateNoteInput } from "./validation";

type DbClient = Prisma.TransactionClient | typeof prisma;

type NoteFilters = {
  classSubjectId?: string;
  sectionId?: string;
  studentId?: string;
};

type ActorContext = {
  userId?: string;
  roleType?: string;
};

// Recommended index: @@index([classSubjectId, sectionId, publishedAt, createdAt])
type NoteWithTeacher = Prisma.NoteGetPayload<{
  include: {
    teacher: {
      select: {
        id: true;
        fullName: true;
        employeeId: true;
      };
    };
  };
}>;

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

async function resolveEnrollmentForActor(
  schoolId: string,
  actor: ActorContext,
  studentId?: string
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

    let link: { studentId: string } | null = null;

    if (studentId) {
      link = await prisma.parentStudentLink.findFirst({
        where: {
          parentId: parent.id,
          studentId,
          student: { schoolId, deletedAt: null },
        },
        select: { studentId: true },
      });

      if (!link) {
        throw new ApiError(403, "Parent is not linked to the specified student");
      }
    } else {
      link = await prisma.parentStudentLink.findFirst({
        where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        select: { studentId: true },
      });
    }

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

async function resolveTeacherIdForActor(
  schoolId: string,
  actor: ActorContext
): Promise<string> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can create notes");
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

async function ensureNoteExists(schoolId: string, id: string): Promise<NoteWithTeacher> {
  const note = await prisma.note.findFirst({
    where: {
      id,
      classSubject: {
        class: {
          schoolId,
          deletedAt: null,
        },
      },
    },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          employeeId: true,
        },
      },
    },
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return note;
}

export async function createNote(
  schoolId: string,
  payload: CreateNoteInput,
  actor: ActorContext
): Promise<NoteWithTeacher> {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  return prisma.$transaction(async (tx) => {
    const classSubject = await ensureClassSubjectBelongsToSchool(
      tx,
      schoolId,
      payload.classSubjectId
    );

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

    return tx.note.create({
      data: {
        teacherId,
        classSubjectId: payload.classSubjectId,
        sectionId: payload.sectionId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        fileUrl: payload.fileUrl ?? null,
        fileType: payload.fileType ?? null,
        publishedAt: payload.publishedAt ?? null,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
      },
    });
  });
}

export async function listNotes(
  schoolId: string,
  filters: NoteFilters,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
) {
  const { roleType } = ensureActor(actor);
  const now = new Date();
  const publishedOnly = roleType === "STUDENT" || roleType === "PARENT";

  let where: Prisma.NoteWhereInput;

  if (publishedOnly) {
    const enrollment = await resolveEnrollmentForActor(
      schoolId,
      actor,
      filters.studentId
    );
    const classSubjectIds = await prisma.classSubject.findMany({
      where: {
        classId: enrollment.classId,
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
      select: { id: true },
    });

    const allowedClassSubjectIds = classSubjectIds.map((item) => item.id);
    if (allowedClassSubjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    let classSubjectCondition: Prisma.NoteWhereInput["classSubjectId"];
    if (filters.classSubjectId) {
      if (!allowedClassSubjectIds.includes(filters.classSubjectId)) {
        return { items: [], total: 0 };
      }
      classSubjectCondition = filters.classSubjectId;
    } else {
      classSubjectCondition = { in: allowedClassSubjectIds };
    }

    where = {
      classSubjectId: classSubjectCondition,
      publishedAt: { lte: now },
      OR: [{ sectionId: enrollment.sectionId }, { sectionId: null }],
    };
  } else {
    where = {
      classSubject: {
        class: {
          schoolId,
          deletedAt: null,
        },
      },
      ...(filters.classSubjectId ? { classSubjectId: filters.classSubjectId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.note.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        teacherId: true,
        classSubjectId: true,
        sectionId: true,
        title: true,
        description: true,
        fileUrl: true,
        fileType: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.note.count({ where }),
  ]);

  return { items, total };
}

export async function getNoteById(
  schoolId: string,
  id: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  const now = new Date();

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const enrollment = await resolveEnrollmentForActor(schoolId, actor);
    const note = await prisma.note.findFirst({
      where: {
        id,
        publishedAt: { lte: now },
        classSubject: {
          classId: enrollment.classId,
          class: { schoolId, deletedAt: null },
        },
        OR: [{ sectionId: enrollment.sectionId }, { sectionId: null }],
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
      },
    });

    if (!note) {
      throw new ApiError(404, "Note not found");
    }

    return note;
  }

  return ensureNoteExists(schoolId, id);
}

export async function updateNote(
  schoolId: string,
  id: string,
  payload: UpdateNoteInput,
  actor: ActorContext
): Promise<NoteWithTeacher> {
  const { userId, roleType } = ensureActor(actor);
  const note = await ensureNoteExists(schoolId, id);

  if (roleType === "TEACHER") {
    const teacherId = await prisma.teacher.findFirst({
      where: {
        userId,
        schoolId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!teacherId || teacherId.id !== note.teacherId) {
      throw new ApiError(403, "Forbidden");
    }
  } else if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  return prisma.note.update({
    where: { id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.fileUrl !== undefined ? { fileUrl: payload.fileUrl } : {}),
      ...(payload.fileType !== undefined ? { fileType: payload.fileType } : {}),
      ...(payload.publishedAt !== undefined
        ? { publishedAt: payload.publishedAt }
        : {}),
    },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          employeeId: true,
        },
      },
    },
  });
}

export async function deleteNote(
  schoolId: string,
  id: string,
  actor: ActorContext
) {
  const { userId, roleType } = ensureActor(actor);
  const note = await ensureNoteExists(schoolId, id);

  if (roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: {
        userId,
        schoolId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!teacher || teacher.id !== note.teacherId) {
      throw new ApiError(403, "Forbidden");
    }
  } else if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  await prisma.note.delete({
    where: { id },
  });

  return { id };
}
