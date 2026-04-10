import path from "node:path";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { deleteFile, uploadFile } from "@/core/storage/storage.service";
import type { StorageUploadResult } from "@/core/storage/types";

type ActorContext = {
  userId?: string;
  roleType?: string;
  schoolId?: string;
};

function normalizeFileUrl(rawUrl: string) {
  if (rawUrl.startsWith("r2://")) {
    const withoutScheme = rawUrl.slice("r2://".length);
    const [bucket, ...rest] = withoutScheme.split("/");
    const key = rest.join("/");
    if (!bucket || !key) {
      throw new ApiError(400, "Invalid file url");
    }
    if (bucket !== process.env.R2_BUCKET_NAME) {
      throw new ApiError(400, "Invalid file url");
    }
    const normalizedKey = path.posix.normalize(key.replace(/^\/+/, ""));
    if (normalizedKey.includes("..")) {
      throw new ApiError(400, "Invalid file path");
    }
    return `/storage/${normalizedKey}`;
  }

  const decodedUrl = decodeURIComponent(rawUrl);
  let normalizedUrl = decodedUrl;
  if (/^https?:\/\//i.test(decodedUrl)) {
    try {
      normalizedUrl = new URL(decodedUrl).pathname;
    } catch {
      throw new ApiError(400, "Invalid file url");
    }
  }
  normalizedUrl = path.posix.normalize(normalizedUrl);
  if (!normalizedUrl.startsWith("/storage/") && !normalizedUrl.startsWith("/uploads/")) {
    throw new ApiError(400, "Invalid file path");
  }
  return normalizedUrl;
}

async function ensureDeleteAllowed(
  actor: ActorContext,
  fileUrl: string
) {
  const { userId, roleType, schoolId } = actor;
  const actorUserId = userId;
  const actorRoleType = roleType;
  const actorSchoolId = schoolId;
  if (!actorUserId || !actorRoleType || !actorSchoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  const ensuredUserId: string = actorUserId;
  const ensuredRoleType: string = actorRoleType;
  const ensuredSchoolId: string = actorSchoolId;

  const isAdmin = ensuredRoleType === "ADMIN" || ensuredRoleType === "SUPER_ADMIN";
  const normalizedUrl = normalizeFileUrl(fileUrl);
  const candidateUrls = Array.from(new Set([fileUrl, normalizedUrl]));
  const normalizedSegments = normalizedUrl.split("/").filter(Boolean);
  const rootFolder = normalizedSegments[1] ?? "";
  const ownerSegment = normalizedSegments[2] ?? "";
  const isClassroomFile =
    normalizedUrl.includes("/assignments/") ||
    normalizedUrl.includes("/classroom/") ||
    normalizedUrl.includes("/notes/");

  async function teacherHasClassSubjectAccess(
    teacherId: string,
    classSubjectId: string,
    sectionId: string | null
  ) {
    const link = await prisma.teacherSubjectClass.findFirst({
      where: {
        teacherId,
        classSubjectId,
        ...(sectionId ? { OR: [{ sectionId }, { sectionId: null }] } : {}),
      },
      select: { id: true },
    });
    if (link) return true;
    const timetable = await prisma.timetableSlot.findFirst({
      where: {
        teacherId,
        classSubjectId,
        ...(sectionId ? { sectionId } : {}),
        section: { class: { schoolId: ensuredSchoolId, deletedAt: null }, deletedAt: null },
      },
      select: { id: true },
    });
    return Boolean(timetable);
  }

  async function studentHasClassAccess(
    studentId: string,
    classId: string,
    sectionId: string | null
  ) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        classId,
        academicYear: { schoolId: ensuredSchoolId, isActive: true },
      },
      select: { classId: true, sectionId: true },
    });
    if (!enrollment) return false;
    if (sectionId && enrollment.sectionId !== sectionId) return false;
    return true;
  }

  async function resolveStudentIdForUser(userIdValue: string) {
    const student = await prisma.student.findFirst({
      where: { userId: userIdValue, schoolId: ensuredSchoolId, deletedAt: null },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  async function parentHasClassAccess(
    parentUserId: string,
    classId: string,
    sectionId: string | null
  ) {
    const parent = await prisma.parent.findFirst({
      where: { userId: parentUserId, schoolId: ensuredSchoolId },
      select: {
        id: true,
        studentLinks: { select: { studentId: true } },
      },
    });
    if (!parent?.studentLinks?.length) return false;
    const studentIds = parent.studentLinks.map((link) => link.studentId);
    if (!studentIds.length) return false;
    for (const studentId of studentIds) {
      const allowed = await studentHasClassAccess(studentId, classId, sectionId);
      if (allowed) return true;
    }
    return false;
  }

  async function ensureClassroomFileAccess() {
    if (isAdmin) return true;

    const assignmentSubmission = await prisma.assignmentSubmission.findFirst({
      where: { submissionUrl: { in: candidateUrls } },
      select: {
        studentId: true,
        assignment: {
          select: {
            teacherId: true,
            classSubjectId: true,
            sectionId: true,
            classSubject: { select: { classId: true } },
          },
        },
      },
    });

    if (assignmentSubmission?.assignment) {
      const classId = assignmentSubmission.assignment.classSubject.classId;
      const sectionId = assignmentSubmission.assignment.sectionId ?? null;
      if (ensuredRoleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(ensuredUserId);
        if (!studentId) return false;
        return assignmentSubmission.studentId === studentId;
      }
      if (ensuredRoleType === "PARENT") {
        return parentHasClassAccess(ensuredUserId, classId, sectionId);
      }
      if (ensuredRoleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
          where: { userId: ensuredUserId, schoolId: ensuredSchoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher) return false;
        return teacherHasClassSubjectAccess(
          teacher.id,
          assignmentSubmission.assignment.classSubjectId,
          sectionId
        );
      }
    }

    const note = await prisma.note.findFirst({
      where: { fileUrl: { in: candidateUrls } },
      select: {
        teacherId: true,
        classSubjectId: true,
        sectionId: true,
        classSubject: { select: { classId: true } },
      },
    });

    if (note) {
      const classId = note.classSubject.classId;
      const sectionId = note.sectionId ?? null;
      if (ensuredRoleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
          where: { userId: ensuredUserId, schoolId: ensuredSchoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher) return false;
        return (
          note.teacherId === teacher.id ||
          (await teacherHasClassSubjectAccess(teacher.id, note.classSubjectId, sectionId))
        );
      }
      if (ensuredRoleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(ensuredUserId);
        if (!studentId) return false;
        return studentHasClassAccess(studentId, classId, sectionId);
      }
      if (ensuredRoleType === "PARENT") {
        return parentHasClassAccess(ensuredUserId, classId, sectionId);
      }
    }

    const attachmentAssignments = await prisma.$queryRaw<
      { id: string; teacherId: string; classSubjectId: string; sectionId: string | null }[]
    >`SELECT "id", "teacherId", "classSubjectId", "sectionId"
        FROM "Assignment"
        WHERE "attachments" @> ${JSON.stringify([{ fileUrl: normalizedUrl }])}::jsonb
           OR "attachments" @> ${JSON.stringify([{ fileUrl }])}::jsonb
        LIMIT 1`;

    const attachmentAssignment = attachmentAssignments[0];
    if (attachmentAssignment) {
      const classSubject = await prisma.classSubject.findFirst({
        where: {
          id: attachmentAssignment.classSubjectId,
          class: { schoolId: ensuredSchoolId, deletedAt: null },
        },
        select: { classId: true },
      });
      if (!classSubject) return false;
      const classId = classSubject.classId;
      const sectionId = attachmentAssignment.sectionId ?? null;
      if (ensuredRoleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
          where: { userId: ensuredUserId, schoolId: ensuredSchoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher) return false;
        return (
          attachmentAssignment.teacherId === teacher.id ||
          (await teacherHasClassSubjectAccess(teacher.id, attachmentAssignment.classSubjectId, sectionId))
        );
      }
      if (ensuredRoleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(ensuredUserId);
        if (!studentId) return false;
        return studentHasClassAccess(studentId, classId, sectionId);
      }
      if (ensuredRoleType === "PARENT") {
        return parentHasClassAccess(ensuredUserId, classId, sectionId);
      }
    }

    const chatMessage = await prisma.chatMessage.findFirst({
      where: { fileUrl: { in: candidateUrls } },
      select: { roomId: true },
    });
    if (chatMessage?.roomId) {
      const room = await prisma.chatRoom.findFirst({
        where: { id: chatMessage.roomId },
        select: { id: true, classId: true, sectionId: true, subjectId: true },
      });
      if (!room) return false;
      const classRecord = await prisma.class.findFirst({
        where: { id: room.classId, schoolId: ensuredSchoolId, deletedAt: null },
        select: { id: true },
      });
      if (!classRecord) return false;
      if (isAdmin) return true;
      if (ensuredRoleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
          where: { userId: ensuredUserId, schoolId: ensuredSchoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher) return false;
        return teacherHasClassSubjectAccess(teacher.id, room.subjectId, room.sectionId);
      }
      if (ensuredRoleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(ensuredUserId);
        if (!studentId) return false;
        return studentHasClassAccess(studentId, room.classId, room.sectionId);
      }
      if (ensuredRoleType === "PARENT") {
        return parentHasClassAccess(ensuredUserId, room.classId, room.sectionId);
      }
    }

    return false;
  }

  if (isClassroomFile) {
    const allowed = await ensureClassroomFileAccess();
    if (!allowed) {
      throw new ApiError(403, "Forbidden");
    }
    return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
  }

  if (rootFolder === "teachers" && ownerSegment) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        schoolId: ensuredSchoolId,
        deletedAt: null,
        OR: [{ id: ownerSegment }, { userId: ownerSegment }],
      },
      select: { id: true, userId: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Forbidden");
    }
    if (!isAdmin && ensuredRoleType !== "TEACHER") {
      throw new ApiError(403, "Forbidden");
    }
    if (!isAdmin && teacher.userId !== ensuredUserId) {
      throw new ApiError(403, "Forbidden");
    }
    return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
  }

  if (rootFolder === "students" && ownerSegment) {
    const student = await prisma.student.findFirst({
      where: {
        schoolId: ensuredSchoolId,
        deletedAt: null,
        OR: [{ id: ownerSegment }, { userId: ownerSegment }],
      },
      select: { id: true, userId: true },
    });
    if (!student) {
      throw new ApiError(403, "Forbidden");
    }
    if (isAdmin) {
      return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
    }
    if (ensuredRoleType === "STUDENT") {
      if (student.userId !== ensuredUserId) {
        throw new ApiError(403, "Forbidden");
      }
      return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
    }
    if (ensuredRoleType === "PARENT") {
      const link = await prisma.parentStudentLink.findFirst({
        where: {
          studentId: student.id,
          parent: { userId: ensuredUserId, schoolId: ensuredSchoolId },
        },
        select: { id: true },
      });
      if (!link) {
        throw new ApiError(403, "Forbidden");
      }
      return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
    }
    throw new ApiError(403, "Forbidden");
  }

  if (!isAdmin) {
    throw new ApiError(403, "Forbidden");
  }
  return fileUrl.startsWith("r2://") ? fileUrl : normalizedUrl;
}

export async function uploadFileForModule(
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  payload: { userType: "student" | "teacher" | "parent" | "common"; userId?: string; module: string }
): Promise<StorageUploadResult> {
  if (!file) {
    throw new ApiError(400, "File is required");
  }

  return uploadFile(file.buffer, {
    userType: payload.userType,
    userId: payload.userId,
    module: payload.module,
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });
}

export async function deleteStoredFile(fileUrl: string, actor: ActorContext) {
  if (!fileUrl) {
    throw new ApiError(400, "fileUrl is required");
  }
  const normalizedUrl = await ensureDeleteAllowed(actor, fileUrl);
  await deleteFile(normalizedUrl);
  return { fileUrl: normalizedUrl };
}
