import type { NextFunction, Response } from "express";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import prisma from "@/core/db/prisma";
import { canJoinChatRoomSafe } from "@/modules/classroom/service";
import { downloadFile } from "@/services/storage/r2.service";

export async function secureFileAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  let debugFileUrl = "";
  let debugNormalizedPath = "";
  let debugRootFolder = "";
  let debugRoleType = "";
  let debugStorage = "";
  let debugUserId = "";
  const LOG_FILE_DEBUG =
    process.env.LOG_FILE_ACCESS === "true" || process.env.NODE_ENV !== "production";
  try {
    const user = req.user;
    const fileUrlRaw =
      typeof req.query.fileUrl === "string"
        ? req.query.fileUrl
        : typeof req.query.url === "string"
          ? req.query.url
          : "";
    const safeDecodeURIComponent = (value: string) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    // Required: decode the incoming fileUrl query param.
    const fileUrl = (() => {
      try {
        return decodeURIComponent(fileUrlRaw);
      } catch {
        return fileUrlRaw;
      }
    })();
    const redactToken = (value: string) => {
      if (!value) return value;
      if (!value.includes("token=")) return value;
      try {
        const parsed = new URL(value);
        if (parsed.searchParams.has("token")) {
          parsed.searchParams.set("token", "REDACTED");
          return parsed.toString();
        }
      } catch {
        // fall through for non-URL strings
      }
      return value.replace(/(token=)[^&]+/gi, "$1REDACTED");
    };
    debugFileUrl = redactToken(fileUrl);
    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }
    if (!fileUrl) {
      throw new ApiError(400, "url is required");
    }

    const userId = (user as { id?: string } | undefined)?.id ?? user.sub;
    debugUserId = userId ?? "";
    const roleType =
      (user as { roleType?: string; role?: string } | undefined)?.roleType ??
      (user as { role?: string } | undefined)?.role;
    debugRoleType = roleType ?? "";
    const schoolId = (user as { schoolId?: string } | undefined)?.schoolId ?? "";
    if (!userId || !roleType || !schoolId) {
      throw new ApiError(401, "Unauthorized");
    }

    const isAdmin = roleType === "ADMIN" || roleType === "SUPER_ADMIN";

    function normalizeFileUrl(value: string) {
      const decodedUrl = decodeURIComponent(value);
      let normalizedUrl = decodedUrl;
      if (/^https?:\/\//i.test(decodedUrl)) {
        try {
          normalizedUrl = new URL(decodedUrl).pathname;
        } catch {
          throw new ApiError(400, "Invalid url");
        }
      }
      return path.posix.normalize(normalizedUrl);
    }

    const isR2 = fileUrl.startsWith("r2://");
    let r2Key = "";
    let normalizedPath = "";

    if (isR2) {
      const withoutScheme = fileUrl.slice("r2://".length);
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
      r2Key = normalizedKey;
      normalizedPath = `/storage/${normalizedKey}`;
    } else {
      normalizedPath = normalizeFileUrl(fileUrl);
      if (!normalizedPath.startsWith("/storage") && !normalizedPath.startsWith("/uploads")) {
        throw new ApiError(400, "Invalid file path");
      }
    }
    debugNormalizedPath = normalizedPath;

    const normalizedSegments = normalizedPath.split("/").filter(Boolean);
    const rootFolder = normalizedSegments[1] ?? "";
    debugRootFolder = rootFolder;
    const ownerSegment = normalizedSegments[2] ?? "";
    const isClassroomFile =
      normalizedPath.includes("/assignments/") ||
      normalizedPath.includes("/assignment-submissions/") ||
      normalizedPath.includes("/classroom/") ||
      normalizedPath.includes("/notes/") ||
      normalizedPath.includes("/chat/");
    const isLeaveAttachment = normalizedPath.includes("/leave-attachment/");
    const isNoticeAttachment = normalizedPath.includes("/notice/");

    async function serveResolvedFile() {
      if (isR2) {
        debugStorage = "r2";
        const { stream, contentType, contentLength, eTag } = await downloadFile(r2Key);

        if (res.headersSent) {
          if (typeof stream.destroy === "function") {
            stream.destroy();
          }
          return;
        }

        const finalType = contentType ?? "application/octet-stream";
        res.setHeader("Content-Type", finalType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        if (contentLength !== null) {
          res.setHeader("Content-Length", contentLength.toString());
        }
        if (eTag) {
          res.setHeader("ETag", eTag);
        }
        if (finalType.includes("pdf") || r2Key.toLowerCase().endsWith(".pdf")) {
          const filename = path.posix.basename(r2Key) || "document.pdf";
          res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        }
        console.info("[FILE ACCESS]", {
          storage: "r2",
          decision: "allowed",
          fileUrl,
          normalizedPath,
          rootFolder,
          roleType,
          contentType: finalType,
        });
        stream.on("error", (streamError) => {
          console.error("[FILE ACCESS] R2 stream error:", streamError);
          if (!res.headersSent) {
            return next(streamError);
          }
          res.end();
        });
        res.on("close", () => {
          if (typeof stream.destroy === "function") {
            stream.destroy();
          }
        });
        return stream.pipe(res);
      }

      const baseDir = process.cwd();
      let absolutePath = "";

      if (normalizedPath.startsWith("/uploads")) {
        absolutePath = path.join(baseDir, normalizedPath.replace(/^\//, ""));
      } else if (normalizedPath.startsWith("/storage")) {
        absolutePath = path.join(baseDir, normalizedPath.replace(/^\//, ""));
      } else {
        throw new ApiError(400, "Invalid file path");
      }

      if (!fs.existsSync(absolutePath)) {
        if (LOG_FILE_DEBUG) {
          console.warn("FILE NOT FOUND:", {
            path: normalizedPath,
            rootFolder,
            roleType,
          });
        }
        throw new ApiError(404, "File not found");
      }

      if (LOG_FILE_DEBUG) {
        console.log("FILE DEBUG:", {
          fileUrl: debugFileUrl,
          normalizedPath,
          absolutePath,
          exists: fs.existsSync(absolutePath),
        });
      }

      const mimeType = mime.lookup(absolutePath) || "application/octet-stream";
      debugStorage = "local";

      if (res.headersSent) {
        return;
      }

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (String(mimeType).includes("pdf") || absolutePath.toLowerCase().endsWith(".pdf")) {
        const filename = path.basename(absolutePath) || "document.pdf";
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      }

      console.info("[FILE ACCESS]", {
        storage: "local",
        decision: "allowed",
        fileUrl,
        normalizedPath,
        rootFolder,
        roleType,
        contentType: mimeType,
      });
      return res.sendFile(absolutePath);
    }

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
          section: { class: { schoolId, deletedAt: null }, deletedAt: null },
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
          academicYear: { schoolId, isActive: true },
        },
        select: { classId: true, sectionId: true },
      });
      if (!enrollment) return false;
      if (sectionId && enrollment.sectionId !== sectionId) return false;
      return true;
    }

    async function resolveStudentIdForUser(userIdValue: string) {
      const student = await prisma.student.findFirst({
        where: { userId: userIdValue, schoolId },
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
        where: { userId: parentUserId, schoolId },
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

    async function teacherHasStudentAccess(teacherId: string, studentId: string) {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          studentId,
          academicYear: { schoolId, isActive: true },
        },
        select: { classId: true, sectionId: true },
      });
      if (!enrollments.length) return false;

      const classIds = Array.from(new Set(enrollments.map((e) => e.classId)));
      const sectionIds = Array.from(
        new Set(enrollments.map((e) => e.sectionId).filter(Boolean))
      ) as string[];

      const teacherClassLink = await prisma.teacherSubjectClass.findFirst({
        where: {
          teacherId,
          classSubject: {
            classId: { in: classIds },
            class: { schoolId, deletedAt: null },
          },
          OR: sectionIds.length
            ? [{ sectionId: null }, { sectionId: { in: sectionIds } }]
            : [{ sectionId: null }],
        },
        select: { id: true },
      });
      if (teacherClassLink) return true;

      if (!sectionIds.length) {
        return false;
      }

      const timetableLink = await prisma.timetableSlot.findFirst({
        where: {
          teacherId,
          sectionId: { in: sectionIds },
          classSubject: {
            classId: { in: classIds },
            class: { schoolId, deletedAt: null },
          },
        },
        select: { id: true },
      });
      return Boolean(timetableLink);
    }

    async function teacherIsClassTeacherForStudent(teacherUserId: string, studentId: string) {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: teacherUserId, schoolId },
        select: { id: true },
      });
      if (!teacher) return false;
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, student: { schoolId, deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: { sectionId: true },
      });
      if (!enrollment?.sectionId) return false;
      const section = await prisma.section.findFirst({
        where: { id: enrollment.sectionId, classTeacherId: teacher.id, deletedAt: null },
        select: { id: true },
      });
      return Boolean(section);
    }

    async function getActiveAcademicYearId() {
      const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
      });
      return academicYear?.id ?? null;
    }

    async function resolveStudentTargetsForUser(userIdValue: string) {
      const academicYearId = await getActiveAcademicYearId();
      if (!academicYearId) return { classIds: [], sectionIds: [] };
      const student = await prisma.student.findFirst({
        where: { schoolId, userId: userIdValue, deletedAt: null },
        select: { id: true },
      });
      if (!student) return { classIds: [], sectionIds: [] };
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId: student.id, academicYearId },
        select: { classId: true, sectionId: true },
      });
      return {
        classIds: enrollment?.classId ? [enrollment.classId] : [],
        sectionIds: enrollment?.sectionId ? [enrollment.sectionId] : [],
      };
    }

    async function resolveParentTargetsForUser(userIdValue: string) {
      const academicYearId = await getActiveAcademicYearId();
      if (!academicYearId) return { classIds: [], sectionIds: [] };
      const parent = await prisma.parent.findFirst({
        where: { schoolId, userId: userIdValue },
        select: { id: true },
      });
      if (!parent) return { classIds: [], sectionIds: [] };
      const links = await prisma.parentStudentLink.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      const studentIds = links.map((link) => link.studentId);
      if (!studentIds.length) return { classIds: [], sectionIds: [] };
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
      return { classIds: Array.from(classIds), sectionIds: Array.from(sectionIds) };
    }

    async function ensureLeaveAttachmentAccess() {
      if (isAdmin) return true;

      const studentLeave = await prisma.studentLeave.findFirst({
        where: {
          OR: [{ attachmentUrl: fileUrl }, { attachmentUrl: normalizedPath }],
          student: { schoolId, deletedAt: null },
        },
        select: { student: { select: { id: true, userId: true } } },
      });

      if (studentLeave?.student) {
        if (roleType === "STUDENT") {
          return studentLeave.student.userId === userId;
        }
        if (roleType === "PARENT") {
          const link = await prisma.parentStudentLink.findFirst({
            where: { studentId: studentLeave.student.id, parent: { userId, schoolId } },
            select: { id: true },
          });
          return Boolean(link);
        }
        if (roleType === "TEACHER") {
          return teacherIsClassTeacherForStudent(userId, studentLeave.student.id);
        }
      }

      const teacherLeave = await prisma.teacherLeave.findFirst({
        where: {
          OR: [{ attachmentUrl: fileUrl }, { attachmentUrl: normalizedPath }],
          teacher: { schoolId, deletedAt: null },
        },
        select: { teacher: { select: { id: true, userId: true } } },
      });

      if (teacherLeave?.teacher) {
        if (roleType === "TEACHER") {
          return teacherLeave.teacher.userId === userId;
        }
        return false;
      }

      return false;
    }

    async function ensureNoticeAttachmentAccess() {
      if (isAdmin) return true;

      const noticeRows = await prisma.$queryRaw<
        {
          id: string;
          targetType: string;
          targetRole: string | null;
          targetClassId: string | null;
          targetSectionId: string | null;
          publishedAt: Date | null;
          expiresAt: Date | null;
        }[]
      >`SELECT "id", "targetType", "targetRole", "targetClassId", "targetSectionId", "publishedAt", "expiresAt"
        FROM "NoticeBoard"
        WHERE "schoolId" = ${schoolId}
          AND ("attachments" @> ${JSON.stringify([fileUrl])}::jsonb
               OR "attachments" @> ${JSON.stringify([normalizedPath])}::jsonb)
        LIMIT 1`;

      const notice = noticeRows[0];
      if (!notice) return false;

      const now = new Date();
      if (notice.publishedAt && notice.publishedAt > now) return false;
      if (notice.expiresAt && notice.expiresAt < now) return false;

      if (roleType === "TEACHER") {
        return true;
      }

      if (notice.targetType === "ALL") {
        return true;
      }

      if (notice.targetType === "ROLE") {
        return Boolean(notice.targetRole && notice.targetRole === roleType);
      }

      if (roleType === "STUDENT") {
        const targets = await resolveStudentTargetsForUser(userId);
        if (notice.targetType === "CLASS") {
          return Boolean(notice.targetClassId && targets.classIds.includes(notice.targetClassId));
        }
        if (notice.targetType === "SECTION") {
          return Boolean(notice.targetSectionId && targets.sectionIds.includes(notice.targetSectionId));
        }
      }

      if (roleType === "PARENT") {
        const targets = await resolveParentTargetsForUser(userId);
        if (notice.targetType === "CLASS") {
          return Boolean(notice.targetClassId && targets.classIds.includes(notice.targetClassId));
        }
        if (notice.targetType === "SECTION") {
          return Boolean(notice.targetSectionId && targets.sectionIds.includes(notice.targetSectionId));
        }
      }

      return false;
    }

    async function ensureClassroomFileAccess() {
      if (isAdmin) return true;

      const assignmentSubmission = await prisma.assignmentSubmission.findFirst({
        where: { OR: [{ submissionUrl: fileUrl }, { submissionUrl: normalizedPath }] },
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
        if (roleType === "STUDENT") {
          const studentId = await resolveStudentIdForUser(userId);
          if (!studentId) return false;
          return assignmentSubmission.studentId === studentId;
        }
        if (roleType === "PARENT") {
          return parentHasClassAccess(userId, classId, sectionId);
        }
        if (roleType === "TEACHER") {
          const teacher = await prisma.teacher.findFirst({
            where: { userId, schoolId },
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
        where: { OR: [{ fileUrl }, { fileUrl: normalizedPath }] },
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
        if (roleType === "TEACHER") {
          const teacher = await prisma.teacher.findFirst({
            where: { userId, schoolId },
            select: { id: true },
          });
          if (!teacher) return false;
          return (
            note.teacherId === teacher.id ||
            (await teacherHasClassSubjectAccess(teacher.id, note.classSubjectId, sectionId))
          );
        }
        if (roleType === "STUDENT") {
          const studentId = await resolveStudentIdForUser(userId);
          if (!studentId) return false;
          return studentHasClassAccess(studentId, classId, sectionId);
        }
        if (roleType === "PARENT") {
          return parentHasClassAccess(userId, classId, sectionId);
        }
      }

      const attachmentAssignments = await prisma.$queryRaw<
        { id: string; teacherId: string; classSubjectId: string; sectionId: string | null }[]
      >`SELECT "id", "teacherId", "classSubjectId", "sectionId"
        FROM "Assignment"
        WHERE "attachments" @> ${JSON.stringify([{ fileUrl: normalizedPath }])}::jsonb
           OR "attachments" @> ${JSON.stringify([{ fileUrl }])}::jsonb
        LIMIT 1`;

      const attachmentAssignment = attachmentAssignments[0];
      if (attachmentAssignment) {
        const classSubject = await prisma.classSubject.findFirst({
          where: { id: attachmentAssignment.classSubjectId, class: { schoolId, deletedAt: null } },
          select: { classId: true },
        });
        if (!classSubject) return false;
        const classId = classSubject.classId;
        const sectionId = attachmentAssignment.sectionId ?? null;
        if (roleType === "TEACHER") {
          const teacher = await prisma.teacher.findFirst({
            where: { userId, schoolId },
            select: { id: true },
          });
          if (!teacher) return false;
          return (
            attachmentAssignment.teacherId === teacher.id ||
            (await teacherHasClassSubjectAccess(teacher.id, attachmentAssignment.classSubjectId, sectionId))
          );
        }
        if (roleType === "STUDENT") {
          const studentId = await resolveStudentIdForUser(userId);
          if (!studentId) return false;
          return studentHasClassAccess(studentId, classId, sectionId);
        }
        if (roleType === "PARENT") {
          return parentHasClassAccess(userId, classId, sectionId);
        }
      }

      const chatMessage = await prisma.chatMessage.findFirst({
        where: { OR: [{ fileUrl }, { fileUrl: normalizedPath }] },
        select: { roomId: true },
      });
      if (chatMessage?.roomId) {
        const room = await prisma.chatRoom.findFirst({
          where: { id: chatMessage.roomId },
          select: { id: true, classId: true, sectionId: true, subjectId: true },
        });
        if (!room) return false;
        const classRecord = await prisma.class.findFirst({
          where: { id: room.classId, schoolId, deletedAt: null },
          select: { id: true },
        });
        if (!classRecord) return false;
        if (isAdmin) return true;
        const allowed = await canJoinChatRoomSafe(
          schoolId,
          { userId, roleType },
          { roomId: room.id, classId: room.classId, sectionId: room.sectionId, subjectId: room.subjectId }
        );
        return allowed;
      }

      return false;
    }

    // Chat attachment file access (room member-based authorization).
    // IMPORTANT: If this file belongs to chat, we must STOP here (no fall-through to other checks).
    const extractInnerFileUrl = (value: string) => {
      try {
        const parsed = new URL(value);
        const inner = parsed.searchParams.get("fileUrl");
        return inner ? safeDecodeURIComponent(inner) : null;
      } catch {
        // Not an absolute URL. Try parsing as path-only URL.
      }
      try {
        const parsed = new URL(`http://local${value.startsWith("/") ? "" : "/"}${value}`);
        const inner = parsed.searchParams.get("fileUrl");
        return inner ? safeDecodeURIComponent(inner) : null;
      } catch {
        return null;
      }
    };

    const expandPathVariants = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return [];
      const variants = new Set<string>([trimmed]);
      if (trimmed.startsWith("/")) {
        variants.add(trimmed.slice(1));
      } else {
        variants.add(`/${trimmed}`);
      }
      return Array.from(variants);
    };

    const chatLookupCandidates = Array.from(
      new Set(
        [
          normalizedPath,
          fileUrl,
          fileUrlRaw,
          extractInnerFileUrl(fileUrl),
          extractInnerFileUrl(fileUrlRaw),
        ]
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .flatMap((v) => expandPathVariants(v))
      )
    );

    const chatMessage = await prisma.chatMessage.findFirst({
      where: {
        OR: chatLookupCandidates.map((candidate) => ({ fileUrl: candidate })),
      },
      include: {
        room: true,
      },
    });

    if (chatMessage) {
      const chatRoomMemberModel = (prisma as unknown as { chatRoomMember?: any }).chatRoomMember;
      const hasMemberModel = typeof chatRoomMemberModel?.findFirst === "function";
      const isMemberFromModel =
        hasMemberModel
          ? await chatRoomMemberModel.findFirst({
              where: {
                roomId: chatMessage.roomId,
                userId: userId,
              },
            })
          : null;

      let isMemberFromRaw: { id: string } | null = null;
      let hasMemberTable = false;
      if (!chatRoomMemberModel) {
        try {
          const tableExistsRows = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT (to_regclass('public."ChatRoomMember"') IS NOT NULL) as "exists"
          `;
          hasMemberTable = Boolean(tableExistsRows?.[0]?.exists);
          if (hasMemberTable) {
            const rows = await prisma.$queryRaw<{ id: string }[]>`
              SELECT "id"
              FROM "ChatRoomMember"
              WHERE "roomId" = ${chatMessage.roomId}
                AND "userId" = ${userId}
              LIMIT 1
            `;
            isMemberFromRaw = rows?.[0] ?? null;
          }
        } catch {
          // Ignore: DB/table may not exist in some environments
        }
      }

      const isMember = Boolean(isMemberFromModel || isMemberFromRaw);
      const memberAuthAvailable = hasMemberModel || hasMemberTable;

      const allowed = memberAuthAvailable
        ? isMember
        : isAdmin
          ? true
          : await canJoinChatRoomSafe(
              schoolId,
              { userId, roleType },
              {
                roomId: chatMessage.roomId,
                classId: chatMessage.room.classId,
                sectionId: chatMessage.room.sectionId,
                subjectId: chatMessage.room.subjectId,
              }
            );

      console.log("[CHAT FILE ACCESS]", {
        userId: user.id,
        roomId: chatMessage.roomId,
        allowed,
      });

      if (!allowed) {
        console.log("[FILE ACCESS DENIED - CHAT]", {
          userId: user.id,
          roomId: chatMessage.roomId,
        });
        throw new ApiError(403, "Forbidden");
      }

      // allow access
      return serveResolvedFile();
    }

    // Payment receipt access (DB-based authorization).
    // If this file matches a stored receipt pdfUrl, do not fall through to other checks.
    const mightBeReceipt =
      normalizedPath.toLowerCase().endsWith(".pdf") || fileUrl.toLowerCase().includes(".pdf");
    if (mightBeReceipt) {
      const receiptSecureCandidate = `/api/v1/files/secure?fileUrl=${encodeURIComponent(normalizedPath)}`;
      const receiptLookupCandidates = Array.from(
        new Set(
          [
            normalizedPath,
            fileUrl,
            fileUrlRaw,
            extractInnerFileUrl(fileUrl),
            extractInnerFileUrl(fileUrlRaw),
            receiptSecureCandidate,
          ]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .flatMap((v) => expandPathVariants(v))
        )
      );

      const receipt = await prisma.receipt.findFirst({
        where: {
          OR: [
            { pdfUrl: { in: receiptLookupCandidates } },
            { pdfUrl: { contains: receiptSecureCandidate } },
            { pdfUrl: { contains: normalizedPath } },
          ],
        },
        select: {
          payment: {
            select: {
              id: true,
              studentId: true,
              student: { select: { id: true, userId: true, schoolId: true } },
            },
          },
        },
      });

      if (!receipt?.payment) {
        // not a receipt file
      } else {
      if (receipt.payment.student.schoolId !== schoolId) {
        throw new ApiError(403, "Forbidden");
      }

      const isFinanceAdmin = roleType === "FINANCE_SUB_ADMIN";
      if (isAdmin || isFinanceAdmin) {
        return serveResolvedFile();
      }

      if (roleType === "STUDENT") {
        if (!receipt.payment.student.userId || receipt.payment.student.userId !== userId) {
          throw new ApiError(403, "Forbidden");
        }
        return serveResolvedFile();
      }

      if (roleType === "PARENT") {
        const link = await prisma.parentStudentLink.findFirst({
          where: {
            studentId: receipt.payment.studentId,
            parent: { is: { userId, schoolId } },
          },
          select: { id: true },
        });
        if (!link) {
          throw new ApiError(403, "Forbidden");
        }
        return serveResolvedFile();
      }

      throw new ApiError(403, "Forbidden");
      }
    }

    if (isClassroomFile) {
      const allowed = await ensureClassroomFileAccess();
      if (!allowed) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (isLeaveAttachment) {
      const allowed = await ensureLeaveAttachmentAccess();
      if (!allowed) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (isNoticeAttachment) {
      const allowed = await ensureNoticeAttachmentAccess();
      if (!allowed) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (rootFolder === "teachers" && ownerSegment) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          schoolId,
          deletedAt: null,
          OR: [{ id: ownerSegment }, { userId: ownerSegment }],
        },
        select: { id: true, userId: true },
      });
      if (!teacher) {
        throw new ApiError(403, "Forbidden");
      }
      if (!isAdmin && roleType === "TEACHER") {
        if (teacher.userId !== userId) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (!isAdmin && roleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(userId);
        if (!studentId || !(await teacherHasStudentAccess(teacher.id, studentId))) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (!isAdmin && roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
          where: { userId, schoolId },
          select: { studentLinks: { select: { studentId: true } } },
        });
        const studentIds = parent?.studentLinks?.map((link) => link.studentId) ?? [];
        if (!studentIds.length) {
          throw new ApiError(403, "Forbidden");
        }
        let allowed = false;
        for (const studentId of studentIds) {
          if (await teacherHasStudentAccess(teacher.id, studentId)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (!isAdmin) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (rootFolder === "admit-cards") {
      if (isAdmin) {
        // allow
      } else {
        const studentFileSegment = normalizedSegments[3] ?? "";
        const baseName = studentFileSegment.split(".")[0] ?? "";
        const studentIdFromFile = baseName.split("_")[0] ?? "";
        if (!studentIdFromFile) {
          throw new ApiError(403, "Forbidden");
        }

        if (roleType === "STUDENT") {
          const student = await prisma.student.findFirst({
            where: { userId, schoolId, deletedAt: null },
            select: { id: true },
          });
          if (!student || student.id !== studentIdFromFile) {
            throw new ApiError(403, "Forbidden");
          }
        } else if (roleType === "PARENT") {
          const link = await prisma.parentStudentLink.findFirst({
            where: {
              studentId: studentIdFromFile,
              parent: { is: { userId, schoolId } },
            },
            select: { id: true },
          });
          if (!link) {
            throw new ApiError(403, "Forbidden");
          }
        } else {
          throw new ApiError(403, "Forbidden");
        }
      }
    } else if (rootFolder === "report-cards" && ownerSegment) {
      const filename = normalizedSegments[3] ?? "";
      const studentIdFromFile = filename.replace(/\.pdf$/i, "");
      if (!studentIdFromFile) {
        throw new ApiError(403, "Forbidden");
      }
      if (isAdmin) {
        // allow
      } else if (roleType === "STUDENT") {
        const studentId = await resolveStudentIdForUser(userId);
        if (!studentId || studentId !== studentIdFromFile) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (roleType === "PARENT") {
        const link = await prisma.parentStudentLink.findFirst({
          where: {
            studentId: studentIdFromFile,
            parent: { userId, schoolId },
          },
          select: { id: true },
        });
        if (!link) {
          throw new ApiError(403, "Forbidden");
        }
      } else {
        throw new ApiError(403, "Forbidden");
      }
    } else if (rootFolder === "students" && ownerSegment) {
      const student = await prisma.student.findFirst({
        where: {
          schoolId,
          deletedAt: null,
          OR: [{ id: ownerSegment }, { userId: ownerSegment }],
        },
        select: { id: true, userId: true },
      });
      if (!student) {
        throw new ApiError(403, "Forbidden");
      }
      if (isAdmin) {
        // allow
      } else if (roleType === "STUDENT") {
        if (student.userId !== userId) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (roleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
          where: { userId, schoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher || !(await teacherHasStudentAccess(teacher.id, student.id))) {
          throw new ApiError(403, "Forbidden");
        }
      } else if (roleType === "PARENT") {
        const link = await prisma.parentStudentLink.findFirst({
          where: {
            studentId: student.id,
            parent: { userId, schoolId },
          },
          select: { id: true },
        });
        if (!link) {
          throw new ApiError(403, "Forbidden");
        }
      } else {
        throw new ApiError(403, "Forbidden");
      }
    } else if (rootFolder === "common" && normalizedPath.includes("/shared/")) {
      if (!isAdmin) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (rootFolder === "common" && ownerSegment && normalizedPath.includes("/school-logo/")) {
      // School logos are readable by any authenticated user within the school
      if (ownerSegment !== schoolId) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (!isAdmin) {
      throw new ApiError(403, "Forbidden");
    }
    return serveResolvedFile();
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;
    if (status === 401 || status === 403) {
      console.info("[FILE ACCESS]", {
        storage: debugStorage || "unknown",
        decision: "denied",
        fileUrl: debugFileUrl,
        normalizedPath: debugNormalizedPath,
        rootFolder: debugRootFolder,
        roleType: debugRoleType,
        status,
      });
      if (status === 403) {
        console.log("[FILE ACCESS DENIED]", {
          userId: debugUserId,
          role: debugRoleType,
          filePath: debugNormalizedPath,
        });
      }
    } else {
      console.info("[FILE ACCESS]", {
        storage: debugStorage || "unknown",
        decision: "error",
        fileUrl: debugFileUrl,
        normalizedPath: debugNormalizedPath,
        rootFolder: debugRootFolder,
        roleType: debugRoleType,
        status,
      });
    }
    console.error("[Phase1] Secure file access error:", error);
    return next(error);
  }
}
