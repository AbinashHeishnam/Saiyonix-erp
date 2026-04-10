import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import {
  canClassTeacherInteractWithPreviousYear,
  canStudentInteractWithPreviousYear,
  getPreviousAcademicYear,
} from "@/modules/academicYear/service";
import { trigger as triggerNotification } from "@/modules/notification/service";
import type { SendMessageInput } from "@/modules/messages/validation";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type MessageContact = {
  userId: string;
  name: string;
  roleType: "STUDENT" | "PARENT";
  studentId?: string;
  parentId?: string;
};

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

async function getStudentIdsForActor(schoolId: string, actor: ActorContext) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (actor.roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    return [student.id];
  }

  if (actor.roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId: actor.userId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parent.id },
      select: { studentId: true },
    });
    if (links.length === 0) {
      throw new ApiError(404, "No linked students found");
    }
    return links.map((link) => link.studentId);
  }

  throw new ApiError(403, "Forbidden");
}

async function hasPreviousYearRelation(
  schoolId: string,
  actor: ActorContext,
  otherUserId: string
) {
  const previousYear = await getPreviousAcademicYear(schoolId);
  if (!previousYear) return false;

  if (actor.roleType === "STUDENT" || actor.roleType === "PARENT") {
    const studentIds = await getStudentIdsForActor(schoolId, actor);
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId: otherUserId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return false;

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { academicYearId: previousYear.id, studentId: { in: studentIds } },
      select: { classId: true, sectionId: true },
    });
    if (!enrollments.length) return false;

    const classIds = enrollments.map((e) => e.classId);
    const sectionIds = enrollments.map((e) => e.sectionId);
    const [classMatch, sectionMatch] = await Promise.all([
      prisma.class.findFirst({
        where: { id: { in: classIds }, classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.section.findFirst({
        where: { id: { in: sectionIds }, classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      }),
    ]);
    return Boolean(classMatch || sectionMatch);
  }

  if (actor.roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId: actor.userId ?? "", deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return false;

    const student = await prisma.student.findFirst({
      where: { schoolId, userId: otherUserId, deletedAt: null },
      select: { id: true },
    });
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId: otherUserId },
      select: { id: true },
    });
    const studentIds = new Set<string>();
    if (student?.id) studentIds.add(student.id);
    if (parent?.id) {
      const links = await prisma.parentStudentLink.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      links.forEach((link) => studentIds.add(link.studentId));
    }
    if (studentIds.size === 0) return false;

    const classIds = await prisma.class.findMany({
      where: { classTeacherId: teacher.id, deletedAt: null },
      select: { id: true },
    });
    const sectionIds = await prisma.section.findMany({
      where: { classTeacherId: teacher.id, deletedAt: null },
      select: { id: true },
    });
    if (!classIds.length && !sectionIds.length) return false;

    const match = await prisma.studentEnrollment.findFirst({
      where: {
        academicYearId: previousYear.id,
        studentId: { in: Array.from(studentIds) },
        OR: [
          ...(classIds.length ? [{ classId: { in: classIds.map((c) => c.id) } }] : []),
          ...(sectionIds.length ? [{ sectionId: { in: sectionIds.map((s) => s.id) } }] : []),
        ],
      },
      select: { id: true },
    });
    return Boolean(match);
  }

  return false;
}

async function getAllowedClassTeacherUserIds(
  schoolId: string,
  actor: ActorContext
) {
  const studentIds = await getStudentIdsForActor(schoolId, actor);
  const academicYearId = await getActiveAcademicYearId(schoolId);
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId: { in: studentIds }, academicYearId },
    select: { sectionId: true },
  });

  const sectionIds = enrollments.map((enrollment) => enrollment.sectionId);
  if (sectionIds.length === 0) {
    return [];
  }

  const sections = await prisma.section.findMany({
    where: {
      id: { in: sectionIds },
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: {
      classTeacher: {
        select: { userId: true },
      },
    },
  });

  const subjectTeachers = await prisma.teacherSubjectClass.findMany({
    where: { sectionId: { in: sectionIds } },
    select: { teacher: { select: { userId: true } } },
  });

  const timetableTeachers = await prisma.timetableSlot.findMany({
    where: {
      sectionId: { in: sectionIds },
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
    },
    select: { teacher: { select: { userId: true } } },
  });

  const ids = new Set<string>();

  sections.forEach((section) => {
    if (section.classTeacher?.userId) ids.add(section.classTeacher.userId);
  });
  subjectTeachers.forEach((link) => {
    if (link.teacher?.userId) ids.add(link.teacher.userId);
  });
  timetableTeachers.forEach((slot) => {
    if (slot.teacher?.userId) ids.add(slot.teacher.userId);
  });

  if (await canStudentInteractWithPreviousYear(schoolId)) {
    const previousYear = await getPreviousAcademicYear(schoolId);
    if (previousYear) {
      const previousEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          studentId: { in: studentIds },
          academicYearId: previousYear.id,
        },
        select: { sectionId: true, classId: true },
      });
      const prevSectionIds = previousEnrollments.map((e) => e.sectionId);
      const prevClassIds = previousEnrollments.map((e) => e.classId);
      const [prevSections, prevClasses] = await Promise.all([
        prevSectionIds.length
          ? prisma.section.findMany({
              where: { id: { in: prevSectionIds }, deletedAt: null },
              select: { classTeacher: { select: { userId: true } } },
            })
          : [],
        prevClassIds.length
          ? prisma.class.findMany({
              where: { id: { in: prevClassIds }, deletedAt: null },
              select: { classTeacher: { select: { userId: true } } },
            })
          : [],
      ]);
      prevSections.forEach((section) => {
        if (section.classTeacher?.userId) ids.add(section.classTeacher.userId);
      });
      prevClasses.forEach((cls) => {
        if (cls.classTeacher?.userId) ids.add(cls.classTeacher.userId);
      });
    }
  }

  return [...ids];
}

async function getTeacherAllowedUserIds(schoolId: string, actor: ActorContext) {
  if (!actor.userId || actor.roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId: actor.userId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const academicYearId = await getActiveAcademicYearId(schoolId);
  const sections = await prisma.section.findMany({
    where: {
      deletedAt: null,
      class: { schoolId, deletedAt: null },
      OR: [
        { classTeacherId: teacher.id },
        { teacherSubjects: { some: { teacherId: teacher.id } } },
        { timetableSlots: { some: { teacherId: teacher.id } } },
      ],
    },
    select: { id: true },
  });

  if (sections.length === 0) {
    return [];
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: { in: sections.map((section) => section.id) },
      academicYearId,
    },
    select: { studentId: true },
  });

  if (enrollments.length === 0) {
    return [];
  }

  const studentIds = enrollments.map((enrollment) => enrollment.studentId);

  const [students, parentLinks] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId, deletedAt: null },
      select: { userId: true },
    }),
    prisma.parentStudentLink.findMany({
      where: { studentId: { in: studentIds } },
      select: { parent: { select: { userId: true } } },
    }),
  ]);

  const ids = new Set<string>();
  students.forEach((student) => {
    if (student.userId) ids.add(student.userId);
  });
  parentLinks.forEach((link) => {
    if (link.parent?.userId) ids.add(link.parent.userId);
  });

  if (await canClassTeacherInteractWithPreviousYear(schoolId)) {
    const previousYear = await getPreviousAcademicYear(schoolId);
    if (previousYear) {
      const previousSections = await prisma.section.findMany({
        where: { classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      });
      const previousClasses = await prisma.class.findMany({
        where: { classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      });
      const previousSectionIds = previousSections.map((s) => s.id);
      const previousClassIds = previousClasses.map((c) => c.id);
      const previousEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          academicYearId: previousYear.id,
          OR: [
            ...(previousSectionIds.length
              ? [{ sectionId: { in: previousSectionIds } }]
              : []),
            ...(previousClassIds.length
              ? [{ classId: { in: previousClassIds } }]
              : []),
          ],
        },
        select: { studentId: true },
      });
      const prevStudentIds = previousEnrollments.map((e) => e.studentId);
      if (prevStudentIds.length) {
        const [prevStudents, prevParents] = await Promise.all([
          prisma.student.findMany({
            where: { id: { in: prevStudentIds }, schoolId, deletedAt: null },
            select: { userId: true },
          }),
          prisma.parentStudentLink.findMany({
            where: { studentId: { in: prevStudentIds } },
            select: { parent: { select: { userId: true } } },
          }),
        ]);
        prevStudents.forEach((student) => {
          if (student.userId) ids.add(student.userId);
        });
        prevParents.forEach((link) => {
          if (link.parent?.userId) ids.add(link.parent.userId);
        });
      }
    }
  }

  return [...ids];
}

function buildThreadSubject(userA: string, userB: string) {
  const [first, second] = [userA, userB].sort();
  return `chat:${first}:${second}`;
}

async function getOrCreateThread(schoolId: string, userA: string, userB: string) {
  const subject = buildThreadSubject(userA, userB);
  let thread = await prisma.messageThread.findFirst({
    where: { schoolId, subject },
    select: { id: true },
  });

  if (!thread) {
    thread = await prisma.messageThread.create({
      data: {
        schoolId,
        subject,
        createdById: userA,
      },
      select: { id: true },
    });
  }

  return thread.id;
}

export async function startChatThread(
  schoolId: string,
  actor: ActorContext,
  receiverId: string
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (actor.roleType === "STUDENT" || actor.roleType === "PARENT") {
    const allowed = await getAllowedClassTeacherUserIds(schoolId, actor);
    if (!allowed.includes(receiverId)) {
      throw new ApiError(403, "Messaging allowed only with class teacher");
    }
  } else if (actor.roleType === "TEACHER") {
    const allowed = await getTeacherAllowedUserIds(schoolId, actor);
    if (!allowed.includes(receiverId)) {
      throw new ApiError(403, "Messaging allowed only with your class students/parents");
    }
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const threadId = await getOrCreateThread(schoolId, actor.userId, receiverId);
  return { threadId, receiverId };
}

export async function sendMessage(
  schoolId: string,
  actor: ActorContext,
  payload: SendMessageInput
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (actor.roleType === "STUDENT" || actor.roleType === "PARENT") {
    const allowed = await getAllowedClassTeacherUserIds(schoolId, actor);
    if (!allowed.includes(payload.receiverId)) {
      throw new ApiError(403, "Messaging allowed only with class teacher");
    }
  } else if (actor.roleType === "TEACHER") {
    const allowed = await getTeacherAllowedUserIds(schoolId, actor);
    if (!allowed.includes(payload.receiverId)) {
      throw new ApiError(403, "Messaging allowed only with your class students/parents");
    }
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const threadId = await getOrCreateThread(schoolId, actor.userId, payload.receiverId);

  const message = await prisma.message.create({
    data: {
      threadId,
      senderUserId: actor.userId,
      recipientUserId: payload.receiverId,
      messageText: payload.message,
    },
    select: {
      id: true,
      senderUserId: true,
      recipientUserId: true,
      messageText: true,
      sentAt: true,
    },
  });

  try {
    const recipient = await prisma.user.findFirst({
      where: { id: payload.receiverId, schoolId },
      select: { role: { select: { roleType: true } } },
    });
    const roleType = recipient?.role?.roleType ?? null;
    const routes: Record<string, string> = {
      TEACHER: "/teacher/messages",
      STUDENT: "/class-teacher",
      PARENT: "/class-teacher",
    };

    await triggerNotification("USER_MESSAGE", {
      schoolId,
      userIds: [payload.receiverId],
      title: "New Message",
      body: payload.message,
      sentById: actor.userId,
      entityType: "MESSAGE",
      entityId: message.id,
      linkUrl: routes[roleType ?? ""] ?? "/notifications",
      metadata: {
        threadId,
        senderUserId: actor.userId,
        recipientUserId: payload.receiverId,
        routes,
      },
    });
  } catch {
    // ignore notification failure
  }

  return message;
}

export async function getConversation(
  schoolId: string,
  actor: ActorContext,
  otherUserId: string,
  pagination?: { skip?: number; take?: number }
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (actor.roleType === "STUDENT" || actor.roleType === "PARENT") {
    const allowed = await getAllowedClassTeacherUserIds(schoolId, actor);
    if (!allowed.includes(otherUserId)) {
      const allowedByHistory = await hasPreviousYearRelation(schoolId, actor, otherUserId);
      if (!allowedByHistory) {
        throw new ApiError(403, "Messaging allowed only with class teacher");
      }
    }
  } else if (actor.roleType === "TEACHER") {
    const allowed = await getTeacherAllowedUserIds(schoolId, actor);
    if (!allowed.includes(otherUserId)) {
      const allowedByHistory = await hasPreviousYearRelation(schoolId, actor, otherUserId);
      if (!allowedByHistory) {
        throw new ApiError(403, "Messaging allowed only with your class students/parents");
      }
    }
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const thread = await prisma.messageThread.findFirst({
    where: { schoolId, subject: buildThreadSubject(actor.userId, otherUserId) },
    select: { id: true },
  });

  if (!thread) {
    return [];
  }

  const messages = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { sentAt: "asc" },
    ...(pagination?.take ? { take: pagination.take } : {}),
    ...(pagination?.skip ? { skip: pagination.skip } : {}),
    select: {
      id: true,
      senderUserId: true,
      recipientUserId: true,
      messageText: true,
      sentAt: true,
      readAt: true,
    },
  });

  await prisma.message.updateMany({
    where: {
      threadId: thread.id,
      recipientUserId: actor.userId,
      senderUserId: otherUserId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return messages;
}

export async function getUnreadCount(
  schoolId: string,
  actor: ActorContext
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (
    actor.roleType !== "PARENT" &&
    actor.roleType !== "STUDENT" &&
    actor.roleType !== "TEACHER"
  ) {
    throw new ApiError(403, "Forbidden");
  }

  return prisma.message.count({
    where: {
      recipientUserId: actor.userId,
      readAt: null,
      thread: { schoolId },
    },
  });
}

export async function getTeacherContacts(
  schoolId: string,
  actor: ActorContext
): Promise<MessageContact[]> {
  if (!actor.userId || actor.roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId: actor.userId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const academicYearId = await getActiveAcademicYearId(schoolId);
  const sections = await prisma.section.findMany({
    where: {
      classTeacherId: teacher.id,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true },
  });

  if (sections.length === 0) {
    return [];
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: { in: sections.map((section) => section.id) },
      academicYearId,
    },
    select: { studentId: true },
  });

  if (enrollments.length === 0) {
    return [];
  }

  const studentIds = enrollments.map((enrollment) => enrollment.studentId);
  const previousYearStudentIds: string[] = [];

  if (await canClassTeacherInteractWithPreviousYear(schoolId)) {
    const previousYear = await getPreviousAcademicYear(schoolId);
    if (previousYear) {
      const previousSections = await prisma.section.findMany({
        where: { classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      });
      const previousClasses = await prisma.class.findMany({
        where: { classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      });
      const previousSectionIds = previousSections.map((s) => s.id);
      const previousClassIds = previousClasses.map((c) => c.id);
      const previousEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          academicYearId: previousYear.id,
          OR: [
            ...(previousSectionIds.length
              ? [{ sectionId: { in: previousSectionIds } }]
              : []),
            ...(previousClassIds.length
              ? [{ classId: { in: previousClassIds } }]
              : []),
          ],
        },
        select: { studentId: true },
      });
      previousYearStudentIds.push(
        ...previousEnrollments.map((enrollment) => enrollment.studentId)
      );
    }
  }

  const allStudentIds = Array.from(new Set([...studentIds, ...previousYearStudentIds]));
  const [students, links] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: allStudentIds }, schoolId, deletedAt: null },
      select: { id: true, fullName: true, userId: true },
    }),
    prisma.parentStudentLink.findMany({
      where: { studentId: { in: allStudentIds } },
      select: {
        parent: { select: { id: true, fullName: true, userId: true } },
      },
    }),
  ]);

  const contacts: MessageContact[] = [];

  students.forEach((student) => {
    if (!student.userId) return;
    contacts.push({
      userId: student.userId,
      name: student.fullName ?? "Student",
      roleType: "STUDENT",
      studentId: student.id,
    });
  });

  links.forEach((link) => {
    if (!link.parent?.userId) return;
    contacts.push({
      userId: link.parent.userId,
      name: link.parent.fullName ?? "Parent",
      roleType: "PARENT",
      parentId: link.parent.id,
    });
  });

  const unique = new Map<string, MessageContact>();
  contacts.forEach((contact) => {
    if (!unique.has(contact.userId)) {
      unique.set(contact.userId, contact);
    }
  });

  return [...unique.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function getTeacherUnreadMessages(
  schoolId: string,
  actor: ActorContext
) {
  if (!actor.userId || actor.roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId: actor.userId, deletedAt: null },
    select: { id: true, userId: true },
  });

  if (!teacher?.userId) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const allowedIds = await getTeacherAllowedUserIds(schoolId, actor);
  if (allowedIds.length === 0) {
    return [];
  }

  const messages = await prisma.message.findMany({
    where: {
      recipientUserId: teacher.userId,
      readAt: null,
      senderUserId: { in: allowedIds },
      thread: { schoolId },
    },
    orderBy: { sentAt: "desc" },
    take: 20,
    select: {
      id: true,
      senderUserId: true,
      messageText: true,
      sentAt: true,
    },
  });

  const senderIds = [...new Set(messages.map((msg) => msg.senderUserId))];
  if (senderIds.length === 0) {
    return [];
  }

  const [students, parents] = await Promise.all([
    prisma.student.findMany({
      where: { userId: { in: senderIds }, schoolId, deletedAt: null },
      select: { userId: true, fullName: true },
    }),
    prisma.parent.findMany({
      where: { userId: { in: senderIds }, schoolId },
      select: { userId: true, fullName: true },
    }),
  ]);

  const nameByUserId = new Map<string, { name: string; roleType: "STUDENT" | "PARENT" }>();
  students.forEach((student) => {
    if (student.userId) {
      nameByUserId.set(student.userId, {
        name: student.fullName ?? "Student",
        roleType: "STUDENT",
      });
    }
  });
  parents.forEach((parent) => {
    if (parent.userId) {
      nameByUserId.set(parent.userId, {
        name: parent.fullName ?? "Parent",
        roleType: "PARENT",
      });
    }
  });

  return messages.map((msg) => ({
    id: msg.id,
    senderUserId: msg.senderUserId,
    senderName: nameByUserId.get(msg.senderUserId)?.name ?? "Unknown",
    senderRole: nameByUserId.get(msg.senderUserId)?.roleType ?? "STUDENT",
    messageText: msg.messageText,
    sentAt: msg.sentAt,
  }));
}

export async function getTeacherUnreadSummary(
  schoolId: string,
  actor: ActorContext
) {
  const unread = await getTeacherUnreadMessages(schoolId, actor);
  const bySender = new Map<
    string,
    {
      senderUserId: string;
      senderName: string;
      senderRole: "STUDENT" | "PARENT";
      count: number;
      lastMessage: string;
      lastSentAt: Date;
    }
  >();

  for (const msg of unread) {
    const existing = bySender.get(msg.senderUserId);
    if (!existing) {
      bySender.set(msg.senderUserId, {
        senderUserId: msg.senderUserId,
        senderName: msg.senderName,
        senderRole: msg.senderRole,
        count: 1,
        lastMessage: msg.messageText,
        lastSentAt: msg.sentAt,
      });
    } else {
      existing.count += 1;
      if (msg.sentAt > existing.lastSentAt) {
        existing.lastSentAt = msg.sentAt;
        existing.lastMessage = msg.messageText;
      }
    }
  }

  return [...bySender.values()].sort(
    (a, b) => b.lastSentAt.getTime() - a.lastSentAt.getTime()
  );
}
