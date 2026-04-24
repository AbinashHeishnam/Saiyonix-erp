import type { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { bumpVersion } from "@/core/cache/cacheVersion";
import { createAndDispatchNotification } from "@/services/notificationEngine";
import { resolveStudentEnrollmentForPortal } from "@/modules/student/enrollmentUtils";
import type {
  CreateAssignmentInput,
  AddAttachmentInput,
  GradeSubmissionInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from "@/modules/assignments/validation";

type DbClient = typeof prisma;

type AssignmentFilters = {
  classSubjectId?: string;
  sectionId?: string;
};

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type AssignmentWithTeacher = Prisma.AssignmentGetPayload<{
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

type AssignmentAttachment = {
  fileName: string;
  fileUrl: string;
  fileKey?: string;
  uploadedAt: string;
};

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "P2002") {
    throw new ApiError(409, "Submission already exists");
  }

  throw error;
}

async function resolveTeacherIdForActor(
  schoolId: string,
  actor: ActorContext
): Promise<string> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can manage assignments");
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
  actor: ActorContext,
  preferredStudentId?: string
): Promise<{ studentId: string; classId: string; sectionId: string }> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: student.id,
      allowPreviousYear: true,
    });

    return { studentId: student.id, classId: enrollment.classId, sectionId: enrollment.sectionId };
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const link = preferredStudentId
      ? await prisma.parentStudentLink.findFirst({
          where: {
            parentId: parent.id,
            studentId: preferredStudentId,
            student: { schoolId, deletedAt: null, status: "ACTIVE" },
          },
          select: { studentId: true },
        })
      : await prisma.parentStudentLink.findFirst({
          where: {
            parentId: parent.id,
            student: { schoolId, deletedAt: null, status: "ACTIVE" },
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          select: { studentId: true },
        });

    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: link.studentId,
      allowPreviousYear: true,
    });

    return { studentId: link.studentId, classId: enrollment.classId, sectionId: enrollment.sectionId };
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
      class: { select: { academicYearId: true } },
    },
  });

  if (!classSubject) {
    throw new ApiError(400, "Class subject mapping not found for this school");
  }

  return {
    id: classSubject.id,
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

async function ensureAssignmentExists(
  schoolId: string,
  id: string
): Promise<AssignmentWithTeacher> {
  const assignment = await prisma.assignment.findFirst({
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

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  return assignment;
}

export async function createAssignment(
  schoolId: string,
  payload: CreateAssignmentInput,
  actor: ActorContext
): Promise<AssignmentWithTeacher> {
  const { userId } = ensureActor(actor);
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  const { assignment, classId, academicYearId } = await prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    const classSubject = await ensureClassSubjectBelongsToSchool(
      db,
      schoolId,
      payload.classSubjectId
    );

    if (payload.sectionId) {
      const section = await ensureSectionBelongsToSchool(db, schoolId, payload.sectionId);

      if (section.classId !== classSubject.classId) {
        throw new ApiError(400, "Section does not belong to the selected class");
      }
    }

    const created = await tx.assignment.create({
      data: {
        teacherId,
        classSubjectId: payload.classSubjectId,
        sectionId: payload.sectionId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        dueAt: payload.dueAt,
        maxMarks: payload.maxMarks ?? null,
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
    return { assignment: created, classId: classSubject.classId, academicYearId: classSubject.academicYearId };
  });

  const versionKey = `classroom:${schoolId}:${teacherId}:${classId}:${payload.sectionId ?? "all"}`;
  await bumpVersion(versionKey);

  try {
    await createAndDispatchNotification({
      type: "ASSIGNMENT_CREATED",
      title: "New Assignment Posted",
      message: payload.title,
      senderId: userId,
      targetType: "CLASS",
      classId,
      meta: {
        entityType: "ASSIGNMENT",
        entityId: assignment.id,
        assignmentId: assignment.id,
        classId,
        sectionId: payload.sectionId ?? null,
        academicYearId,
        includeParents: true,
        linkUrl: "/classroom",
      },
    });
  } catch {
    // ignore notification failure
  }

  return assignment;
}

export async function listAssignments(
  schoolId: string,
  filters: AssignmentFilters,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
) {
  const { roleType } = ensureActor(actor);

  let where: Prisma.AssignmentWhereInput;
  let submissionsStudentId: string | null = null;

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const studentContext = await resolveStudentContextForActor(schoolId, actor);
    submissionsStudentId = studentContext.studentId;

    const classSubjectIds = await prisma.classSubject.findMany({
      where: {
        classId: studentContext.classId,
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
      select: { id: true },
    });

    const allowedClassSubjectIds = classSubjectIds.map((item) => item.id);
    if (allowedClassSubjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    let classSubjectCondition: Prisma.AssignmentWhereInput["classSubjectId"];
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
      OR: [{ sectionId: studentContext.sectionId }, { sectionId: null }],
    };
  } else if (roleType === "TEACHER") {
    const teacherId = await resolveTeacherIdForActor(schoolId, actor);

    where = {
      teacherId,
      classSubject: { class: { schoolId, deletedAt: null } },
      ...(filters.classSubjectId ? { classSubjectId: filters.classSubjectId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    };
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const [items, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        teacherId: true,
        classSubjectId: true,
        sectionId: true,
        title: true,
        description: true,
        dueAt: true,
        maxMarks: true,
        attachments: true,
        createdAt: true,
        updatedAt: true,
        classSubject: {
          select: {
            id: true,
            class: { select: { id: true, className: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        teacher: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
        ...(submissionsStudentId
          ? {
              submissions: {
                where: { studentId: submissionsStudentId },
                select: { submittedAt: true, isLate: true },
              },
            }
          : {}),
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.assignment.count({ where }),
  ]);

  if (!submissionsStudentId) {
    return { items, total };
  }

  const mappedItems = items.map((item) => {
    const submissions = item.submissions ?? [];
    const submission = submissions[0];
    const submissionStatus = submission
      ? submission.isLate
        ? "LATE"
        : "SUBMITTED"
      : "NOT_SUBMITTED";

    const { submissions: _submissions, ...rest } = item;
    return { ...rest, submissionStatus };
  });

  return { items: mappedItems, total };
}

export async function getAssignmentById(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<AssignmentWithTeacher> {
  const { roleType } = ensureActor(actor);

  if (roleType === "STUDENT" || roleType === "PARENT") {
    const studentContext = await resolveStudentContextForActor(schoolId, actor);

    const assignment = await prisma.assignment.findFirst({
      where: {
        id,
        classSubject: {
          classId: studentContext.classId,
          class: { schoolId, deletedAt: null },
        },
        OR: [{ sectionId: studentContext.sectionId }, { sectionId: null }],
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

    if (!assignment) {
      throw new ApiError(404, "Assignment not found");
    }

    return assignment;
  }

  if (roleType === "TEACHER") {
    const teacherId = await resolveTeacherIdForActor(schoolId, actor);
    const assignment = await prisma.assignment.findFirst({
      where: {
        id,
        teacherId,
        classSubject: { class: { schoolId, deletedAt: null } },
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

    if (!assignment) {
      throw new ApiError(404, "Assignment not found");
    }

    return assignment;
  }

  throw new ApiError(403, "Forbidden");
}

export async function updateAssignment(
  schoolId: string,
  id: string,
  payload: UpdateAssignmentInput,
  actor: ActorContext
): Promise<AssignmentWithTeacher> {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);
  const assignment = await ensureAssignmentExists(schoolId, id);

  if (assignment.teacherId !== teacherId) {
    throw new ApiError(403, "Forbidden");
  }

  return prisma.assignment.update({
    where: { id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.dueAt !== undefined ? { dueAt: payload.dueAt } : {}),
      ...(payload.maxMarks !== undefined ? { maxMarks: payload.maxMarks } : {}),
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

export async function deleteAssignment(
  schoolId: string,
  id: string,
  actor: ActorContext
) {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);
  const assignment = await ensureAssignmentExists(schoolId, id);

  if (assignment.teacherId !== teacherId) {
    throw new ApiError(403, "Forbidden");
  }

  await prisma.assignment.delete({ where: { id } });

  return { id };
}

export async function addAssignmentAttachment(
  schoolId: string,
  assignmentId: string,
  payload: AddAttachmentInput,
  actor: ActorContext
) {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);
  const assignment = await ensureAssignmentExists(schoolId, assignmentId);

  if (assignment.teacherId !== teacherId) {
    throw new ApiError(403, "Only assignment owner can upload attachments");
  }

  const existing = Array.isArray(assignment.attachments)
    ? (assignment.attachments as AssignmentAttachment[])
    : [];

  const updatedAttachments: AssignmentAttachment[] = [
    ...existing,
    {
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      fileKey: payload.fileKey,
      uploadedAt: new Date().toISOString(),
    },
  ];

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: { attachments: updatedAttachments },
    select: { id: true, attachments: true },
  });

  return { assignmentId: updated.id, attachments: updated.attachments ?? [] };
}

export async function submitAssignment(
  schoolId: string,
  assignmentId: string,
  payload: SubmitAssignmentInput,
  actor: ActorContext,
  preferredStudentId?: string
) {
  const studentContext = await resolveStudentContextForActor(
    schoolId,
    actor,
    preferredStudentId
  );

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      classSubject: {
        classId: studentContext.classId,
        class: { schoolId, deletedAt: null },
      },
      OR: [{ sectionId: studentContext.sectionId }, { sectionId: null }],
    },
    select: {
      id: true,
      dueAt: true,
      teacherId: true,
      sectionId: true,
      classSubject: { select: { classId: true } },
    },
  });

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const submittedAt = new Date();
  if (assignment.dueAt && submittedAt > assignment.dueAt) {
    throw new ApiError(400, "Deadline crossed");
  }
  const isLate = assignment.dueAt ? submittedAt > assignment.dueAt : false;

  try {
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        studentId: studentContext.studentId,
        submissionUrl: payload.submissionUrl,
        submittedAt,
        isLate,
      },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        submissionUrl: true,
        submittedAt: true,
        isLate: true,
        marksAwarded: true,
        teacherRemarks: true,
      },
    });
    if (assignment.teacherId) {
      const versionKey = `classroom:${schoolId}:${assignment.teacherId}:${assignment.classSubject.classId}:${assignment.sectionId ?? "all"}`;
      await bumpVersion(versionKey);
    }
    return submission;
  } catch (error) {
    mapPrismaError(error);
    throw error;
  }
}

export async function getSubmissionsForAssignment(
  schoolId: string,
  assignmentId: string,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
) {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId,
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const [items, total] = await prisma.$transaction([
    prisma.assignmentSubmission.findMany({
      where: { assignmentId: assignment.id },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentId: true,
        submissionUrl: true,
        submittedAt: true,
        isLate: true,
        marksAwarded: true,
        teacherRemarks: true,
        student: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true,
            admissionNumber: true,
          },
        },
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.assignmentSubmission.count({ where: { assignmentId: assignment.id } }),
  ]);

  return { items, total };
}

export async function checkAndSendAssignmentReminders(schoolId: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const assignments = await prisma.assignment.findMany({
    where: {
      dueAt: { gte: now, lte: cutoff },
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      sectionId: true,
      classSubject: { select: { classId: true } },
    },
  });

  if (assignments.length === 0) {
    return { assignments: 0, notifications: 0 };
  }

  const systemSender = await prisma.user.findFirst({
    where: {
      schoolId,
      isActive: true,
      role: { roleType: { in: ["SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"] } },
    },
    select: { id: true },
  });

  if (!systemSender?.id) {
    return { assignments: assignments.length, notifications: 0 };
  }

  const classIds = Array.from(
    new Set(assignments.map((assignment) => assignment.classSubject.classId))
  );

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId: { in: classIds },
      student: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      studentId: true,
      classId: true,
      sectionId: true,
      createdAt: true,
      student: { select: { userId: true } },
    },
  });

  const latestEnrollmentByStudent = new Map<
    string,
    { studentId: string; classId: string; sectionId: string; userId: string | null }
  >();
  for (const enrollment of enrollments) {
    if (!latestEnrollmentByStudent.has(enrollment.studentId)) {
      latestEnrollmentByStudent.set(enrollment.studentId, {
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        userId: enrollment.student.userId ?? null,
      });
    }
  }

  const studentIds = Array.from(latestEnrollmentByStudent.keys());
  if (studentIds.length === 0) {
    return { assignments: assignments.length, notifications: 0 };
  }

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignmentId: { in: assignmentIds },
      studentId: { in: studentIds },
    },
    select: { assignmentId: true, studentId: true },
  });

  const submittedByAssignment = new Map<string, Set<string>>();
  for (const submission of submissions) {
    const set = submittedByAssignment.get(submission.assignmentId) ?? new Set();
    set.add(submission.studentId);
    submittedByAssignment.set(submission.assignmentId, set);
  }

  const enrollmentsByClass = new Map<string, string[]>();
  const enrollmentsByClassSection = new Map<string, string[]>();
  for (const enrollment of latestEnrollmentByStudent.values()) {
    if (!enrollment.userId) continue;
    const classKey = enrollment.classId;
    const classList = enrollmentsByClass.get(classKey) ?? [];
    classList.push(enrollment.studentId);
    enrollmentsByClass.set(classKey, classList);

    const sectionKey = `${enrollment.classId}:${enrollment.sectionId}`;
    const sectionList = enrollmentsByClassSection.get(sectionKey) ?? [];
    sectionList.push(enrollment.studentId);
    enrollmentsByClassSection.set(sectionKey, sectionList);
  }

  let notificationCount = 0;

  for (const assignment of assignments) {
    const classId = assignment.classSubject.classId;
    const candidateIds =
      assignment.sectionId === null || assignment.sectionId === undefined
        ? enrollmentsByClass.get(classId) ?? []
        : enrollmentsByClassSection.get(`${classId}:${assignment.sectionId}`) ?? [];

    if (candidateIds.length === 0) {
      continue;
    }

    const submittedSet = submittedByAssignment.get(assignment.id) ?? new Set<string>();
    const pendingStudentIds = candidateIds.filter((id) => !submittedSet.has(id));
    if (pendingStudentIds.length === 0) {
      continue;
    }

    const userIds = pendingStudentIds
      .map((studentId) => latestEnrollmentByStudent.get(studentId)?.userId ?? null)
      .filter((id): id is string => Boolean(id));

    if (userIds.length === 0) {
      continue;
    }

    await createAndDispatchNotification({
      type: "CLASS_ANNOUNCEMENT",
      title: "Assignment due soon",
      message: `Assignment "${assignment.title}" is due within 24 hours.`,
      senderId: systemSender.id,
      targetType: "USER",
      userIds,
      meta: {
        entityType: "ASSIGNMENT",
        entityId: assignment.id,
        assignmentId: assignment.id,
        classId: assignment.classSubject.classId,
        sectionId: assignment.sectionId ?? null,
        linkUrl: "/classroom",
      },
    });

    notificationCount += userIds.length;
  }

  return { assignments: assignments.length, notifications: notificationCount };
}

export async function gradeSubmission(
  schoolId: string,
  submissionId: string,
  payload: GradeSubmissionInput,
  actor: ActorContext
) {
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  const submission = await prisma.assignmentSubmission.findFirst({
    where: {
      id: submissionId,
      assignment: {
        teacherId,
        classSubject: { class: { schoolId, deletedAt: null } },
      },
    },
    select: {
      id: true,
      assignment: {
        select: {
          maxMarks: true,
        },
      },
    },
  });

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  if (payload.marksAwarded !== undefined && payload.marksAwarded !== null) {
    const maxMarks =
      submission.assignment.maxMarks && "toNumber" in submission.assignment.maxMarks
        ? submission.assignment.maxMarks.toNumber()
        : submission.assignment.maxMarks != null
        ? Number(submission.assignment.maxMarks)
        : null;
    if (maxMarks !== null && payload.marksAwarded > maxMarks) {
      throw new ApiError(400, "Marks awarded cannot exceed max marks");
    }
  }

  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      ...(payload.marksAwarded !== undefined
        ? { marksAwarded: payload.marksAwarded }
        : {}),
      ...(payload.teacherRemarks !== undefined
        ? { teacherRemarks: payload.teacherRemarks }
        : {}),
    },
    select: {
      id: true,
      assignmentId: true,
      studentId: true,
      submissionUrl: true,
      submittedAt: true,
      isLate: true,
      marksAwarded: true,
      teacherRemarks: true,
    },
  });
}

export async function getSubmissionStatus(
  schoolId: string,
  assignmentId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (roleType !== "STUDENT" && roleType !== "PARENT") {
    throw new ApiError(403, "Forbidden");
  }

  const studentContext = await resolveStudentContextForActor(schoolId, actor);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      classSubject: {
        classId: studentContext.classId,
        class: { schoolId, deletedAt: null },
      },
      OR: [{ sectionId: studentContext.sectionId }, { sectionId: null }],
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const submission = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId: assignment.id, studentId: studentContext.studentId },
    select: { isLate: true },
  });

  if (!submission) {
    return { status: "NOT_SUBMITTED" as const };
  }

  if (submission.isLate) {
    return { status: "LATE" as const };
  }

  return { status: "SUBMITTED" as const };
}
