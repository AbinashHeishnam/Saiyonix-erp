import type { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { getCache, setCache } from "@/core/cache/cache";
import { getVersion, bumpVersion } from "@/core/cache/cacheVersion";
import { queueSeen } from "@/modules/classroom/seenQueue";
import { createAssignment, addAssignmentAttachment, submitAssignment } from "@/modules/assignments/service";
import { createNote } from "@/modules/notes/service";

type ActorContext = { userId?: string; roleType?: string };

function toSecureUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/v1/files/secure")) return value;
  return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}

function toPublicUrl(value?: string | null) {
  return toSecureUrl(value);
}

type AttachmentItem = { fileUrl?: string | null } & Record<string, unknown>;

function coerceAttachments(
  value: Prisma.JsonValue | null | undefined
): AttachmentItem[] | null | undefined {
  return Array.isArray(value) ? (value as AttachmentItem[]) : null;
}

function mapAttachments(attachments: AttachmentItem[] | null | undefined) {
  if (!attachments) return attachments;
  return attachments.map((item) => ({
    ...item,
    fileUrl: toSecureUrl(item.fileUrl ?? null),
  }));
}

type ClassroomAssignmentCreateInput = {
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  title: string;
  description?: string | null;
  deadline: Date;
  maxMarks?: number | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileKey?: string | null;
};

type ClassroomNoteCreateInput = {
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
};

type ClassroomAnnouncementCreateInput = {
  classId: string;
  sectionId?: string | null;
  title: string;
  content: string;
};

type ClassroomAssignmentSubmitInput = {
  assignmentId: string;
  submissionUrl: string;
  studentId?: string;
};

type ChatRoomAccess = {
  roomId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
};

async function getSenderNameForRoom(
  schoolId: string,
  senderId: string,
  senderRole: string,
  sectionId: string | null
) {
  if (senderRole === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId: senderId, deletedAt: null },
      select: { fullName: true },
    });
    return teacher?.fullName ?? "Teacher";
  }

  if (senderRole === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId: senderId, deletedAt: null },
      select: { fullName: true },
    });
    return student?.fullName ?? "Student";
  }

  if (senderRole === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId: senderId },
      select: { id: true, fullName: true },
    });
    if (!parent) return "Parent";

    const academicYearId = await getActiveAcademicYearId(schoolId);
    if (!academicYearId) {
      return parent.fullName ?? "Parent";
    }
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentId: parent.id,
        student: {
          schoolId,
          deletedAt: null,
          enrollments: {
            some: {
              academicYearId,
              ...(sectionId ? { sectionId } : {}),
            },
          },
        },
      },
      select: { student: { select: { fullName: true } } },
    });

    return link?.student?.fullName ?? parent.fullName ?? "Parent";
  }

  return "User";
}

async function resolveClassSubjectId(
  schoolId: string,
  classId: string,
  subjectId: string
) {
  const classSubject = await prisma.classSubject.findFirst({
    where: {
      classId,
      subjectId,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true },
  });

  if (!classSubject) {
    throw new ApiError(404, "Class subject not found");
  }

  return classSubject.id;
}

async function listClassroomAnnouncements(schoolId: string, classId: string, sectionId?: string | null) {
  return prisma.noticeBoard.findMany({
    where: {
      schoolId,
      ...(sectionId
        ? { targetType: "SECTION", targetSectionId: sectionId }
        : { targetType: "CLASS", targetClassId: classId }),
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      createdById: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getActiveAcademicYearId(schoolId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  return academicYear?.id ?? null;
}

export async function getTeacherClassroom(
  schoolId: string,
  userId: string,
  teacherId?: string
) {
  let resolvedTeacherId = teacherId ?? null;

  if (resolvedTeacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: resolvedTeacherId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
  } else {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
    resolvedTeacherId = teacher.id;
  }

  const classKey = "all";
  const sectionKey = "all";
  const versionKey = `classroom:${schoolId}:${resolvedTeacherId}:${classKey}:${sectionKey}`;
  const version = await getVersion(versionKey);
  const cacheKey = `${versionKey}:v${version}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const academicYearId = await getActiveAcademicYearId(schoolId);
  if (!academicYearId) {
    throw new ApiError(400, "Active academic year not found");
  }

  const assignments = await prisma.teacherSubjectClass.findMany({
    where: {
      teacherId: resolvedTeacherId,
      academicYearId,
    },
    include: {
      classSubject: {
        include: {
          class: true,
          subject: true,
        },
      },
      section: true,
    },
    orderBy: [{ classSubject: { class: { classOrder: "asc" } } }],
  });
  const timetableSlots = await prisma.timetableSlot.findMany({
    where: {
      teacherId: resolvedTeacherId,
      academicYearId,
      section: {
        deletedAt: null,
        class: { schoolId, deletedAt: null },
      },
      classSubject: {
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
    },
    select: {
      classSubjectId: true,
      classSubject: {
        select: {
          classId: true,
          class: { select: { className: true } },
          subjectId: true,
          subject: { select: { name: true } },
        },
      },
      sectionId: true,
      section: { select: { sectionName: true } },
    },
  });

  const combined = new Map<
    string,
    {
      classId: string;
      className: string | null;
      sectionId: string | null;
      sectionName: string | null;
      subjectName: string | null;
      subjectId: string | null;
      classSubjectId: string;
    }
  >();

  assignments.forEach((item) => {
    const key = `${item.classSubjectId}-${item.sectionId ?? "all"}`;
    combined.set(key, {
      classId: item.classSubject.classId,
      className: item.classSubject.class?.className ?? null,
      sectionId: item.sectionId ?? null,
      sectionName: item.section?.sectionName ?? null,
      subjectName: item.classSubject.subject?.name ?? null,
      subjectId: item.classSubject.subjectId ?? null,
      classSubjectId: item.classSubjectId,
    });
  });

  timetableSlots.forEach((slot) => {
    const key = `${slot.classSubjectId}-${slot.sectionId ?? "all"}`;
    if (!combined.has(key)) {
      combined.set(key, {
        classId: slot.classSubject.classId,
        className: slot.classSubject.class?.className ?? null,
        sectionId: slot.sectionId ?? null,
        sectionName: slot.section?.sectionName ?? null,
        subjectName: slot.classSubject.subject?.name ?? null,
        subjectId: slot.classSubject.subjectId ?? null,
        classSubjectId: slot.classSubjectId,
      });
    }
  });

  const result = Array.from(combined.values());
  await setCache(cacheKey, result, 60);
  return result;
}

async function resolveStudentEnrollment(schoolId: string, studentId: string) {
  const academicYearId = await getActiveAcademicYearId(schoolId);
  if (!academicYearId) {
    throw new ApiError(400, "Active academic year not found");
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, academicYearId },
    select: { studentId: true, classId: true, sectionId: true },
  });

  if (!enrollment) {
    throw new ApiError(404, "Student enrollment not found");
  }

  return { ...enrollment, academicYearId };
}

async function getStudentIdForParent(schoolId: string, userId: string, studentId?: string) {
  const parent = await prisma.parent.findFirst({
    where: { schoolId, userId },
    select: { id: true },
  });

  if (!parent) {
    throw new ApiError(403, "Parent account not linked");
  }

  if (studentId) {
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentId: parent.id,
        studentId,
        student: { schoolId, deletedAt: null, status: "ACTIVE" },
      },
      select: { studentId: true },
    });
    if (!link) {
      throw new ApiError(403, "Student not linked");
    }
    return studentId;
  }

  const firstLink = await prisma.parentStudentLink.findFirst({
    where: { parentId: parent.id, student: { schoolId, deletedAt: null, status: "ACTIVE" } },
    select: { studentId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!firstLink) {
    throw new ApiError(404, "No active linked students found");
  }

  return firstLink.studentId;
}

async function upsertChatRoom(
  classId: string,
  sectionId: string,
  subjectId: string
) {
  const room = await prisma.chatRoom.upsert({
    where: {
      classId_sectionId_subjectId: { classId, sectionId, subjectId },
    },
    create: { classId, sectionId, subjectId },
    update: {},
  });

  return room;
}

async function ensureChatRoomAccess(
  schoolId: string,
  actor: ActorContext,
  room: ChatRoomAccess
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (actor.roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }

    const link = await prisma.teacherSubjectClass.findFirst({
      where: {
        teacherId: teacher.id,
        sectionId: room.sectionId,
        classSubject: {
          classId: room.classId,
          subjectId: room.subjectId,
        },
      },
      select: { id: true },
    });

    if (!link) {
      const timetable = await prisma.timetableSlot.findFirst({
        where: {
          teacherId: teacher.id,
          sectionId: room.sectionId,
          classSubject: {
            classId: room.classId,
            subjectId: room.subjectId,
          },
          section: { class: { schoolId, deletedAt: null }, deletedAt: null },
        },
        select: { id: true },
      });
      if (!timetable) {
        throw new ApiError(403, "Forbidden");
      }
    }
    return;
  }

  if (actor.roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    const enrollment = await resolveStudentEnrollment(schoolId, student.id);
    if (enrollment.sectionId !== room.sectionId) {
      throw new ApiError(403, "Forbidden");
    }
    return;
  }

  if (actor.roleType === "PARENT") {
    const studentId = await getStudentIdForParent(schoolId, actor.userId);
    const enrollment = await resolveStudentEnrollment(schoolId, studentId);
    if (enrollment.sectionId !== room.sectionId) {
      throw new ApiError(403, "Forbidden");
    }
    return;
  }

  throw new ApiError(403, "Forbidden");
}

export async function canJoinChatRoomSafe(
  schoolId: string,
  actor: ActorContext,
  room: ChatRoomAccess
) {
  try {
    await ensureChatRoomAccess(schoolId, actor, room);
    return true;
  } catch (err) {
    console.error("[SECURITY] Access validation failed:", err);
    return false;
  }
}


export async function getStudentClassroom(
  schoolId: string,
  userId: string,
  roleType: string,
  studentId?: string
) {
  let resolvedStudentId: string | null = null;

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    resolvedStudentId = student.id;
  } else if (roleType === "PARENT") {
    resolvedStudentId = await getStudentIdForParent(schoolId, userId, studentId);
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const enrollment = await resolveStudentEnrollment(schoolId, resolvedStudentId);

  const classSubjects = await prisma.classSubject.findMany({
    where: { classId: enrollment.classId },
    select: {
      id: true,
      subject: { select: { name: true } },
      class: { select: { className: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });

  const teacherLinks = await prisma.teacherSubjectClass.findMany({
    where: {
      classSubjectId: { in: classSubjects.map((item) => item.id) },
      ...(enrollment.sectionId
        ? { OR: [{ sectionId: enrollment.sectionId }, { sectionId: null }] }
        : {}),
    },
    select: {
      classSubjectId: true,
      teacher: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  const teacherBySubject = new Map<string, Array<{ id: string; fullName: string; photoUrl: string | null }>>();
  teacherLinks.forEach((item) => {
    const list = teacherBySubject.get(item.classSubjectId) ?? [];
    list.push(item.teacher);
    teacherBySubject.set(item.classSubjectId, list);
  });

  const timetableTeachers = await prisma.timetableSlot.findMany({
    where: {
      classSubjectId: { in: classSubjects.map((item) => item.id) },
      ...(enrollment.sectionId ? { sectionId: enrollment.sectionId } : {}),
      teacher: { deletedAt: null },
    },
    select: {
      classSubjectId: true,
      teacher: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  timetableTeachers.forEach((slot) => {
    const list = teacherBySubject.get(slot.classSubjectId) ?? [];
    const slotTeacher = slot.teacher;
    if (!slotTeacher) {
      return;
    }
    if (!list.some((t) => t.id === slotTeacher.id)) {
      list.push(slotTeacher);
      teacherBySubject.set(slot.classSubjectId, list);
    }
  });

  const assignmentWhere = {
    classSubjectId: { in: classSubjects.map((item) => item.id) },
    OR: enrollment.sectionId
      ? [{ sectionId: enrollment.sectionId }, { sectionId: null }]
      : [{ sectionId: null }],
  } as const;

  const assignmentList = await prisma.assignment.findMany({
    where: assignmentWhere,
    select: {
      id: true,
      classSubjectId: true,
      teacher: { select: { id: true, fullName: true, photoUrl: true } },
    },
  });

  const submissionList = assignmentList.length
    ? await prisma.assignmentSubmission.findMany({
        where: {
          assignmentId: { in: assignmentList.map((item) => item.id) },
          studentId: enrollment.studentId,
        },
        select: { assignmentId: true },
      })
    : [];

  const submittedSet = new Set(submissionList.map((item) => item.assignmentId));
  const totalBySubject = new Map<string, number>();
  const submittedBySubject = new Map<string, number>();

  assignmentList.forEach((assignment) => {
    totalBySubject.set(
      assignment.classSubjectId,
      (totalBySubject.get(assignment.classSubjectId) ?? 0) + 1
    );
    if (submittedSet.has(assignment.id)) {
      submittedBySubject.set(
        assignment.classSubjectId,
        (submittedBySubject.get(assignment.classSubjectId) ?? 0) + 1
      );
    }
  });

  const assignmentTeacherBySubject = new Map<string, { id: string; fullName: string; photoUrl: string | null }>();
  assignmentList.forEach((item) => {
    if (!item.teacher) return;
    if (!assignmentTeacherBySubject.has(item.classSubjectId)) {
      assignmentTeacherBySubject.set(item.classSubjectId, item.teacher);
    }
  });

  return classSubjects.map((subject) => {
    const teachers = teacherBySubject.get(subject.id) ?? [];
    const primaryTeacher =
      assignmentTeacherBySubject.get(subject.id) ??
      teachers[0] ??
      null;
    return {
    classSubjectId: subject.id,
    subjectName: subject.subject?.name ?? null,
    className: subject.class?.className ?? null,
    classId: enrollment.classId,
    sectionId: enrollment.sectionId,
    teacherId: primaryTeacher?.id ?? null,
    teacherName: primaryTeacher?.fullName ?? null,
    teacherPhotoUrl: toPublicUrl(primaryTeacher?.photoUrl ?? null) ?? null,
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      fullName: teacher.fullName ?? null,
      photoUrl: toPublicUrl(teacher.photoUrl ?? null),
    })),
    totalAssignments: totalBySubject.get(subject.id) ?? 0,
    pendingAssignments:
      (totalBySubject.get(subject.id) ?? 0) -
      (submittedBySubject.get(subject.id) ?? 0),
  };
  });
}

async function ensureTeacherSectionAccess(schoolId: string, teacherId: string, sectionId: string) {
  const allowed = await prisma.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
      OR: [
        { classTeacherId: teacherId },
        { teacherSubjects: { some: { teacherId } } },
        { timetableSlots: { some: { teacherId } } },
      ],
    },
    select: { id: true },
  });

  if (!allowed) {
    throw new ApiError(403, "Forbidden");
  }
}

export async function getSectionClassroom(
  schoolId: string,
  userId: string,
  roleType: string,
  sectionId: string
) {
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  await ensureTeacherSectionAccess(schoolId, teacher.id, sectionId);

  const academicYearId = await getActiveAcademicYearId(schoolId);

  const students = academicYearId
    ? await prisma.studentEnrollment.findMany({
        where: {
          sectionId,
          academicYearId,
          student: { schoolId, deletedAt: null, status: "ACTIVE" },
        },
        select: {
          studentId: true,
          rollNumber: true,
          student: {
            select: {
              userId: true,
              fullName: true,
              profile: { select: { profilePhotoUrl: true } },
            },
          },
        },
        orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
      })
    : [];

  const studentIds = students.map((enrollment) => enrollment.studentId);

  const parentLinks = studentIds.length
    ? await prisma.parentStudentLink.findMany({
        where: { studentId: { in: studentIds } },
        select: {
          studentId: true,
          student: { select: { fullName: true } },
          parent: {
            select: {
              id: true,
              userId: true,
              fullName: true,
              mobile: true,
              email: true,
              relationToStudent: true,
            },
          },
        },
      })
    : [];

  const assignments = await prisma.assignment.findMany({
    where: {
      sectionId,
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      maxMarks: true,
      attachments: true,
      createdAt: true,
      classSubject: { select: { subject: { select: { name: true } } } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const notes = await prisma.note.findMany({
    where: {
      sectionId,
      classSubject: { class: { schoolId, deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileType: true,
      publishedAt: true,
      createdAt: true,
      classSubject: { select: { subject: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const teachers = await prisma.teacherSubjectClass.findMany({
    where: { sectionId },
    select: {
      teacher: { select: { id: true, fullName: true, photoUrl: true, email: true } },
      classSubject: { select: { subject: { select: { name: true } } } },
    },
  });

  const uniqueTeachers = new Map(
    teachers.map((item) => [item.teacher.id, {
      id: item.teacher.id,
      fullName: item.teacher.fullName,
      photoUrl: item.teacher.photoUrl,
      email: item.teacher.email,
      subjects: [item.classSubject.subject?.name ?? ""],
    }])
  );

  teachers.forEach((item) => {
    const existing = uniqueTeachers.get(item.teacher.id);
    if (existing && item.classSubject.subject?.name) {
      if (!existing.subjects.includes(item.classSubject.subject.name)) {
        existing.subjects.push(item.classSubject.subject.name);
      }
    }
  });

  const section = await prisma.section.findFirst({
    where: { id: sectionId },
    select: { classId: true },
  });

  const announcements = section
    ? await listClassroomAnnouncements(schoolId, section.classId, sectionId)
    : [];

  return {
    students: students.map((enrollment) => ({
      id: enrollment.studentId,
      userId: enrollment.student?.userId ?? null,
      fullName: enrollment.student?.fullName ?? null,
      rollNumber: enrollment.rollNumber ?? null,
      photoUrl: toSecureUrl(enrollment.student?.profile?.profilePhotoUrl ?? null),
    })),
    parents: parentLinks.reduce(
      (acc: Array<{
        id: string;
        userId: string | null;
        fullName: string | null;
        mobile: string | null;
        email: string | null;
        relationToStudent: string | null;
        students: string[];
      }>, link) => {
        if (!link.parent) return acc;
        const existing = acc.find((item) => item.id === link.parent.id);
        const studentName = link.student?.fullName ?? "";
        if (existing) {
          if (studentName && !existing.students.includes(studentName)) {
            existing.students.push(studentName);
          }
        } else {
          acc.push({
            id: link.parent.id,
            userId: link.parent.userId ?? null,
            fullName: link.parent.fullName ?? null,
            mobile: link.parent.mobile ?? null,
            email: link.parent.email ?? null,
            relationToStudent: link.parent.relationToStudent ?? null,
            students: studentName ? [studentName] : [],
          });
        }
        return acc;
      },
      []
    ),
    assignments: assignments.map((assignment) => ({
      ...assignment,
      attachments: mapAttachments(coerceAttachments(assignment.attachments)),
    })),
    notes: notes.map((note) => ({
      ...note,
      fileUrl: toSecureUrl(note.fileUrl),
    })),
    announcements,
    teachers: Array.from(uniqueTeachers.values()).map((teacher) => ({
      ...teacher,
      photoUrl: toPublicUrl(teacher.photoUrl),
    })),
  };
}

export async function getSubjectClassroom(
  schoolId: string,
  userId: string,
  roleType: string,
  classSubjectId: string,
  studentId?: string,
  pagination?: { skip?: number; take?: number }
) {
  let sectionId: string | null = null;
  let resolvedStudentId: string | null = null;
  let currentTeacherId: string | null = null;

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    resolvedStudentId = student.id;
    const enrollment = await resolveStudentEnrollment(schoolId, student.id);
    sectionId = enrollment.sectionId;
  } else if (roleType === "PARENT") {
    resolvedStudentId = await getStudentIdForParent(schoolId, userId, studentId);
    const enrollment = await resolveStudentEnrollment(schoolId, resolvedStudentId);
    sectionId = enrollment.sectionId;
  } else if (roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
    currentTeacherId = teacher.id;
    const link = await prisma.teacherSubjectClass.findFirst({
      where: { teacherId: teacher.id, classSubjectId },
      select: { sectionId: true },
    });
    if (link) {
      sectionId = link.sectionId ?? null;
    } else {
      const timetable = await prisma.timetableSlot.findFirst({
        where: {
          teacherId: teacher.id,
          classSubjectId,
          section: { class: { schoolId, deletedAt: null }, deletedAt: null },
        },
        select: { sectionId: true },
      });
      if (!timetable) {
        throw new ApiError(403, "Forbidden");
      }
      sectionId = timetable.sectionId ?? null;
    }
  }

  const subject = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, class: { schoolId, deletedAt: null } },
    select: {
      id: true,
      classId: true,
      class: { select: { className: true } },
      subject: { select: { name: true } },
      subjectId: true,
    },
  });

  if (!subject) {
    throw new ApiError(404, "Subject not found");
  }

  const teacherLinks = await prisma.teacherSubjectClass.findMany({
    where: {
      classSubjectId,
      ...(sectionId ? { OR: [{ sectionId }, { sectionId: null }] } : {}),
    },
    select: {
      teacher: {
        select: { id: true, userId: true, fullName: true, photoUrl: true, email: true },
      },
    },
  });

  const timetableTeachers =
    teacherLinks.length === 0
      ? await prisma.timetableSlot.findMany({
          where: {
            classSubjectId,
            ...(sectionId ? { sectionId } : {}),
            teacher: { deletedAt: null },
          },
          select: { teacher: { select: { id: true, userId: true, fullName: true, photoUrl: true, email: true } } },
        })
      : [];

  const teacherMap = new Map<
    string,
    { id: string; userId: string | null; fullName: string | null; photoUrl: string | null; email: string | null }
  >();

  teacherLinks.forEach((link) => {
    if (link.teacher) {
      teacherMap.set(link.teacher.id, {
        ...link.teacher,
        photoUrl: toPublicUrl(link.teacher.photoUrl),
      });
    }
  });

  timetableTeachers.forEach((slot) => {
    if (slot.teacher) {
      teacherMap.set(slot.teacher.id, {
        ...slot.teacher,
        photoUrl: toPublicUrl(slot.teacher.photoUrl),
      });
    }
  });

  const teachers = Array.from(teacherMap.values());
  const primaryTeacher = teachers[0] ?? null;

  if (roleType === "TEACHER" && !currentTeacherId) {
    throw new ApiError(403, "Teacher not linked to subject/class properly");
  }

  let assignmentWhere: {
    classSubjectId: string;
    sectionId?: string;
    classSubject: { class: { schoolId: string; deletedAt: null } };
    teacherId?: string;
  } = {
    classSubjectId,
    classSubject: { class: { schoolId, deletedAt: null } },
  };

  if (sectionId) {
    assignmentWhere.sectionId = sectionId;
  }
  if (roleType === "TEACHER" && currentTeacherId) {
    assignmentWhere.teacherId = currentTeacherId;
  }

  const assignments = await prisma.assignment.findMany({
    where: assignmentWhere,
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      maxMarks: true,
      attachments: true,
      createdAt: true,
      _count: { select: { submissions: true } },
      teacher: {
        select: { id: true, fullName: true, photoUrl: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(pagination?.take ? { take: pagination.take } : {}),
    ...(pagination?.skip ? { skip: pagination.skip } : {}),
  });

  const submissions =
    resolvedStudentId && assignments.length
      ? await prisma.assignmentSubmission.findMany({
          where: {
            studentId: resolvedStudentId,
            assignmentId: { in: assignments.map((assignment) => assignment.id) },
          },
          select: {
            assignmentId: true,
            submittedAt: true,
            isLate: true,
            submissionUrl: true,
          },
        })
      : [];

  const submissionByAssignment = new Map(
    submissions.map((submission) => [submission.assignmentId, submission])
  );

  const notes = await prisma.note.findMany({
    where: {
      classSubjectId,
      ...(sectionId ? { sectionId } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileType: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const section = sectionId
    ? await prisma.section.findFirst({
        where: { id: sectionId, class: { schoolId, deletedAt: null }, deletedAt: null },
        select: { sectionName: true },
      })
    : null;

  const room =
    sectionId && subject.subjectId
      ? await upsertChatRoom(subject.classId, sectionId, subject.subjectId)
      : null;

  return {
    classSubjectId: subject.id,
    className: subject.class?.className ?? null,
    subjectName: subject.subject?.name ?? null,
    sectionId,
    sectionName: section?.sectionName ?? null,
    chatRoomId: room?.id ?? null,
    teacher: primaryTeacher
      ? { ...primaryTeacher, photoUrl: toPublicUrl(primaryTeacher.photoUrl ?? null) }
      : primaryTeacher,
    teachers: teachers.map((teacher) => ({
      ...teacher,
      photoUrl: toPublicUrl(teacher.photoUrl ?? null),
    })),
    assignments: assignments.map((assignment) => {
      const submission = submissionByAssignment.get(assignment.id);
      const status = submission
        ? submission.isLate
          ? "LATE"
          : "SUBMITTED"
        : "PENDING";
      return {
        ...assignment,
        attachments: mapAttachments(coerceAttachments(assignment.attachments)),
        teacher: assignment.teacher
          ? {
              ...assignment.teacher,
              photoUrl: toPublicUrl(assignment.teacher.photoUrl),
            }
          : assignment.teacher,
        submissionStatus: status,
        submission: submission
          ? {
              ...submission,
              submissionUrl: toSecureUrl(submission.submissionUrl ?? null),
            }
          : submission,
      };
    }),
    notes: notes.map((note) => ({
      ...note,
      fileUrl: toSecureUrl(note.fileUrl),
    })),
    announcements: await listClassroomAnnouncements(
      schoolId,
      subject.classId,
      sectionId
    ),
  };
}

export async function createAssignmentInClassroom(
  schoolId: string,
  actor: ActorContext,
  payload: ClassroomAssignmentCreateInput
) {
  const classSubjectId = await resolveClassSubjectId(
    schoolId,
    payload.classId,
    payload.subjectId
  );

  const assignment = await createAssignment(
    schoolId,
    {
      classSubjectId,
      sectionId: payload.sectionId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      dueAt: payload.deadline,
      maxMarks: payload.maxMarks ?? null,
    },
    actor
  );

  if (payload.fileUrl) {
    const fileName = payload.fileName ?? payload.fileUrl.split("/").pop() ?? "Attachment";
    await addAssignmentAttachment(
      schoolId,
      assignment.id,
      {
        fileName,
        fileUrl: payload.fileUrl,
        fileKey: payload.fileKey ?? undefined,
      },
      actor
    );
  }

  if (actor.userId && actor.roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: actor.userId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (teacher) {
      const versionKey = `classroom:${schoolId}:${teacher.id}:${payload.classId}:${payload.sectionId ?? "all"}`;
      await bumpVersion(versionKey);
    }
  }

  return assignment;
}

export async function createNoteInClassroom(
  schoolId: string,
  actor: ActorContext,
  payload: ClassroomNoteCreateInput
) {
  const classSubjectId = await resolveClassSubjectId(
    schoolId,
    payload.classId,
    payload.subjectId
  );

  const note = await createNote(
    schoolId,
    {
      classSubjectId,
      sectionId: payload.sectionId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      fileUrl: payload.fileUrl ?? null,
      fileType: payload.fileType ?? null,
    },
    actor
  );

  if (actor.userId && actor.roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: actor.userId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (teacher) {
      const versionKey = `classroom:${schoolId}:${teacher.id}:${payload.classId}:${payload.sectionId ?? "all"}`;
      await bumpVersion(versionKey);
    }
  }

  return note;
}

export async function createAnnouncementInClassroom(
  schoolId: string,
  actor: ActorContext,
  payload: ClassroomAnnouncementCreateInput
) {
  if (!actor.userId || actor.roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: actor.userId, schoolId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  if (payload.sectionId) {
    await ensureTeacherSectionAccess(schoolId, teacher.id, payload.sectionId);
  } else {
    const hasAccess = await prisma.teacherSubjectClass.findFirst({
      where: {
        teacherId: teacher.id,
        classSubject: { classId: payload.classId },
      },
      select: { id: true },
    });
    const isClassTeacher = await prisma.section.findFirst({
      where: { classId: payload.classId, classTeacherId: teacher.id, deletedAt: null },
      select: { id: true },
    });
    if (!hasAccess && !isClassTeacher) {
      throw new ApiError(403, "Forbidden");
    }
  }

  const targetType = payload.sectionId ? "SECTION" : "CLASS";

  return prisma.noticeBoard.create({
    data: {
      schoolId,
      title: payload.title,
      content: payload.content,
      noticeType: "CLASSROOM",
      isPublic: false,
      publishedAt: new Date(),
      createdById: actor.userId,
      targetType,
      targetClassId: payload.classId,
      targetSectionId: payload.sectionId ?? null,
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      createdById: true,
      targetClassId: true,
      targetSectionId: true,
      targetType: true,
    },
  });
}

export async function submitAssignmentInClassroom(
  schoolId: string,
  actor: ActorContext,
  payload: ClassroomAssignmentSubmitInput
) {
  const submission = await submitAssignment(
    schoolId,
    payload.assignmentId,
    { submissionUrl: payload.submissionUrl },
    actor,
    payload.studentId
  );

  const assignment = await prisma.assignment.findFirst({
    where: { id: payload.assignmentId },
    select: {
      teacherId: true,
      sectionId: true,
      classSubject: { select: { classId: true } },
    },
  });
  if (assignment?.teacherId) {
    const versionKey = `classroom:${schoolId}:${assignment.teacherId}:${assignment.classSubject.classId}:${assignment.sectionId ?? "all"}`;
    await bumpVersion(versionKey);
  }

  return submission;
}

export async function getChatRoomMessages(
  schoolId: string,
  actor: ActorContext,
  roomId: string,
  options?: { limit?: number; before?: string | null }
) {
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId },
    select: { id: true, classId: true, sectionId: true, subjectId: true },
  });
  if (!room) {
    throw new ApiError(404, "Chat room not found");
  }

  await ensureChatRoomAccess(schoolId, actor, {
    roomId: room.id,
    classId: room.classId,
    sectionId: room.sectionId,
    subjectId: room.subjectId,
  });

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 50);
  const beforeDate =
    options?.before && !Number.isNaN(Date.parse(options.before))
      ? new Date(options.before)
      : null;

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: room.id,
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      roomId: true,
      senderId: true,
      senderRole: true,
      message: true,
      fileUrl: true,
      replyToId: true,
      isPinned: true,
      createdAt: true,
      replyTo: {
        select: {
          id: true,
          senderId: true,
          senderRole: true,
          message: true,
          fileUrl: true,
          createdAt: true,
        },
      },
      seenBy: { select: { userId: true } },
    },
  });
  const orderedMessages = [...messages].reverse();
  const teacherIds = new Set(
    orderedMessages
      .filter((msg) => msg.senderRole === "TEACHER")
      .map((msg) => msg.senderId)
  );
  const studentIds = new Set(
    orderedMessages
      .filter((msg) => msg.senderRole === "STUDENT")
      .map((msg) => msg.senderId)
  );
  const parentIds = new Set(
    orderedMessages
      .filter((msg) => msg.senderRole === "PARENT")
      .map((msg) => msg.senderId)
  );
  orderedMessages.forEach((msg) => {
    if (msg.replyTo?.senderRole === "TEACHER") {
      teacherIds.add(msg.replyTo.senderId);
    } else if (msg.replyTo?.senderRole === "STUDENT") {
      studentIds.add(msg.replyTo.senderId);
    } else if (msg.replyTo?.senderRole === "PARENT") {
      parentIds.add(msg.replyTo.senderId);
    }
  });

  const [teachers, students, parents] = await Promise.all([
    teacherIds.size
      ? prisma.teacher.findMany({
          where: { schoolId, userId: { in: [...teacherIds] }, deletedAt: null },
          select: { userId: true, fullName: true },
        })
      : [],
    studentIds.size
      ? prisma.student.findMany({
          where: { schoolId, userId: { in: [...studentIds] }, deletedAt: null },
          select: { userId: true, fullName: true },
        })
      : [],
    parentIds.size
      ? prisma.parent.findMany({
          where: { schoolId, userId: { in: [...parentIds] } },
          select: { id: true, userId: true, fullName: true },
        })
      : [],
  ]);

  const teacherMap = new Map(teachers.map((t) => [t.userId, t.fullName]));
  const studentMap = new Map(students.map((s) => [s.userId, s.fullName]));
  const parentMap = new Map(parents.map((p) => [p.userId, { id: p.id, name: p.fullName }]));

  const academicYearId = parentIds.size ? await getActiveAcademicYearId(schoolId) : null;
  const parentLinks: Array<{ parentId: string; student: { fullName: string | null } }> =
    parentIds.size
      ? await prisma.parentStudentLink.findMany({
          where: {
            parentId: { in: parents.map((p) => p.id) },
            student: {
              schoolId,
              deletedAt: null,
              enrollments: {
                some: {
                  ...(academicYearId ? { academicYearId } : {}),
                  ...(room.sectionId ? { sectionId: room.sectionId } : {}),
                },
              },
            },
          },
          select: { parentId: true, student: { select: { fullName: true } } },
        })
      : [];

  const parentStudentMap = new Map(
    parentLinks.map((link) => [link.parentId, link.student.fullName])
  );

  const enriched = orderedMessages.map((msg) => {
    let senderName = "User";
    if (msg.senderRole === "TEACHER") {
      senderName = teacherMap.get(msg.senderId) ?? "Teacher";
    } else if (msg.senderRole === "STUDENT") {
      senderName = studentMap.get(msg.senderId) ?? "Student";
    } else if (msg.senderRole === "PARENT") {
      const parentInfo = parentMap.get(msg.senderId);
      senderName =
        (parentInfo && parentStudentMap.get(parentInfo.id)) ??
        parentInfo?.name ??
        "Parent";
    }
    let replyToName: string | null = null;
    if (msg.replyTo) {
      if (msg.replyTo.senderRole === "TEACHER") {
        replyToName = teacherMap.get(msg.replyTo.senderId) ?? "Teacher";
      } else if (msg.replyTo.senderRole === "STUDENT") {
        replyToName = studentMap.get(msg.replyTo.senderId) ?? "Student";
      } else if (msg.replyTo.senderRole === "PARENT") {
        const parentInfo = parentMap.get(msg.replyTo.senderId);
        replyToName =
          (parentInfo && parentStudentMap.get(parentInfo.id)) ??
          parentInfo?.name ??
          "Parent";
      }
    }
    const seenCount = msg.seenBy?.length ?? 0;
    const seenByMe = !!msg.seenBy?.some((seen) => seen.userId === actor.userId);
    const { seenBy, ...rest } = msg;
    return {
      ...rest,
      fileUrl: toSecureUrl(rest.fileUrl ?? null),
      senderName,
      replyTo: msg.replyTo
        ? {
            ...msg.replyTo,
            senderName: replyToName ?? "User",
            fileUrl: toSecureUrl(msg.replyTo.fileUrl ?? null),
          }
        : null,
      seenCount,
      seenByMe,
    };
  });

  const nextCursor =
    enriched.length && enriched.length >= limit
      ? enriched[0].createdAt?.toISOString?.() ?? null
      : null;

  return { room, messages: enriched, nextCursor };
}

export async function sendChatRoomMessage(
  schoolId: string,
  actor: ActorContext,
  roomId: string,
  payload: { message?: string | null; fileUrl?: string | null; replyToId?: string | null }
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId },
    select: { id: true, classId: true, sectionId: true, subjectId: true },
  });
  if (!room) {
    throw new ApiError(404, "Chat room not found");
  }

  await ensureChatRoomAccess(schoolId, actor, {
    roomId: room.id,
    classId: room.classId,
    sectionId: room.sectionId,
    subjectId: room.subjectId,
  });

  const messageText =
    typeof payload.message === "string" ? payload.message.trim() : "";
  const fileUrl = payload.fileUrl ? payload.fileUrl.trim() : null;
  const replyToId = payload.replyToId ?? null;

  if (!messageText && !fileUrl) {
    throw new ApiError(400, "Message or file is required");
  }

  const saved = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: actor.userId,
      senderRole: actor.roleType,
      message: messageText || null,
      fileUrl,
      replyToId,
    },
    select: {
      id: true,
      roomId: true,
      senderId: true,
      senderRole: true,
      message: true,
      fileUrl: true,
      replyToId: true,
      isPinned: true,
      createdAt: true,
      replyTo: {
        select: {
          id: true,
          senderId: true,
          senderRole: true,
          message: true,
          fileUrl: true,
          createdAt: true,
        },
      },
    },
  });
  const senderName = await getSenderNameForRoom(
    schoolId,
    actor.userId,
    actor.roleType,
    room.sectionId
  );
  let replyToName: string | null = null;
  if (saved.replyTo) {
    replyToName = await getSenderNameForRoom(
      schoolId,
      saved.replyTo.senderId,
      saved.replyTo.senderRole,
      room.sectionId
    );
  }

  return {
    ...saved,
    fileUrl: toSecureUrl(saved.fileUrl ?? null),
    senderName,
    replyTo: saved.replyTo
      ? {
          ...saved.replyTo,
          senderName: replyToName ?? "User",
          fileUrl: toSecureUrl(saved.replyTo.fileUrl ?? null),
        }
      : null,
    seenCount: 0,
    seenByMe: false,
  };
}

export async function markChatMessageSeen(
  schoolId: string,
  actor: ActorContext,
  messageId: string
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId },
    select: { id: true, roomId: true, senderId: true, room: { select: { classId: true, sectionId: true, subjectId: true } } },
  });
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await ensureChatRoomAccess(schoolId, actor, {
    roomId: message.roomId,
    classId: message.room.classId,
    sectionId: message.room.sectionId,
    subjectId: message.room.subjectId,
  });

  if (message.senderId === actor.userId) {
    return null;
  }

  const existing = await prisma.messageSeen.findUnique({
    where: { messageId_userId: { messageId: message.id, userId: actor.userId } },
    select: { id: true },
  });
  if (existing) {
    return null;
  }

  try {
    queueSeen(message.roomId, actor.userId, message.id);
  } catch (err) {
    console.error("[CHAT] queue fallback failed", err);
  }

  return { messageId: message.id, userId: actor.userId, roomId: message.roomId };
}

export async function pinChatRoomMessage(
  schoolId: string,
  actor: ActorContext,
  messageId: string,
  pin: boolean
) {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  if (actor.roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can pin messages");
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId },
    select: { id: true, roomId: true, room: { select: { classId: true, sectionId: true, subjectId: true } } },
  });
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await ensureChatRoomAccess(schoolId, actor, {
    roomId: message.roomId,
    classId: message.room.classId,
    sectionId: message.room.sectionId,
    subjectId: message.room.subjectId,
  });

  if (pin) {
    await prisma.chatMessage.updateMany({
      where: { roomId: message.roomId, isPinned: true },
      data: { isPinned: false },
    });
  }

  return prisma.chatMessage.update({
    where: { id: message.id },
    data: { isPinned: pin },
    select: {
      id: true,
      roomId: true,
      senderId: true,
      senderRole: true,
      message: true,
      fileUrl: true,
      replyToId: true,
      isPinned: true,
      createdAt: true,
    },
  });
}
