import { Prisma } from "@prisma/client";

import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import type {
  CreateStudentAttendanceInput,
  UpdateStudentAttendanceInput,
} from "./validation";

type DbClient = Prisma.TransactionClient | typeof prisma;

type AttendanceFilters = {
  studentId?: string;
  sectionId?: string;
  academicYearId?: string;
  fromDate?: string;
  toDate?: string;
};

type ActorContext = {
  userId?: string;
  roleType?: string;
};

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : undefined;

  if (code === "P2002") {
    throw new ApiError(409, "Attendance already marked for this student");
  }

  if (code === "P2003") {
    throw new ApiError(400, "Invalid relation reference");
  }

  throw error;
}

function toDateOnly(value?: string) {
  const raw = value ? new Date(value) : new Date();
  if (Number.isNaN(raw.getTime())) {
    throw new ApiError(400, "Invalid attendanceDate");
  }
  return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
}

function isSameUtcDate(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
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

async function ensureSectionBelongsToSchool(
  client: DbClient,
  schoolId: string,
  sectionId: string
) {
  const section = await client.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true, classTeacherId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function ensureTimetableSlotBelongsToSection(
  client: DbClient,
  schoolId: string,
  timetableSlotId: string,
  sectionId: string,
  academicYearId: string
) {
  const slot = await client.timetableSlot.findFirst({
    where: {
      id: timetableSlotId,
      sectionId,
      academicYearId,
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      classSubject: {
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
    },
    select: { id: true },
  });

  if (!slot) {
    throw new ApiError(400, "Timetable slot not found for this section");
  }
}

async function resolveTeacherId(
  client: DbClient,
  schoolId: string,
  params: { roleType?: string; userId?: string; markedByTeacherId?: string }
) {
  if (params.roleType === "TEACHER") {
    if (!params.userId) {
      throw new ApiError(401, "Unauthorized");
    }
    const teacher = await client.teacher.findFirst({
      where: { userId: params.userId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }
    return teacher.id;
  }

  if (!params.markedByTeacherId) {
    throw new ApiError(400, "markedByTeacherId is required");
  }

  const teacher = await client.teacher.findFirst({
    where: { id: params.markedByTeacherId, schoolId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    throw new ApiError(400, "Teacher not found for this school");
  }

  return teacher.id;
}

async function ensureStudentsInSection(
  client: DbClient,
  params: { studentIds: string[]; sectionId: string; academicYearId: string }
) {
  const enrollments = await client.studentEnrollment.findMany({
    where: {
      studentId: { in: params.studentIds },
      sectionId: params.sectionId,
      academicYearId: params.academicYearId,
    },
    select: { studentId: true },
  });

  const enrolledSet = new Set(enrollments.map((item) => item.studentId));
  const missing = params.studentIds.filter((id) => !enrolledSet.has(id));

  if (missing.length > 0) {
    throw new ApiError(400, "Some students are not enrolled in this section");
  }
}

async function ensureAttendanceNotMarked(
  client: DbClient,
  params: { studentIds: string[]; attendanceDate: Date }
) {
  const existing = await client.studentAttendance.findMany({
    where: {
      studentId: { in: params.studentIds },
      attendanceDate: params.attendanceDate,
    },
    select: { studentId: true },
  });

  if (existing.length > 0) {
    throw new ApiError(409, "Attendance already marked for some students");
  }
}

async function ensureTeacherIsClassTeacher(
  client: DbClient,
  sectionId: string,
  teacherId: string
) {
  const section = await client.section.findFirst({
    where: { id: sectionId, classTeacherId: teacherId, deletedAt: null },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(403, "Only class teacher can mark attendance");
  }
}

export async function markStudentAttendance(
  schoolId: string,
  payload: CreateStudentAttendanceInput,
  actor: ActorContext
) {
  const attendanceDate = toDateOnly(payload.attendanceDate);
  const studentIds = payload.records.map((record) => record.studentId);

  try {
    return await prisma.$transaction(async (tx) => {
      await ensureAcademicYearBelongsToSchool(tx, schoolId, payload.academicYearId);
      const section = await ensureSectionBelongsToSchool(
        tx,
        schoolId,
        payload.sectionId
      );
      await ensureTimetableSlotBelongsToSection(
        tx,
        schoolId,
        payload.timetableSlotId,
        payload.sectionId,
        payload.academicYearId
      );

      const teacherId = await resolveTeacherId(tx, schoolId, {
        roleType: actor.roleType,
        userId: actor.userId,
        markedByTeacherId: payload.markedByTeacherId,
      });

      if (actor.roleType === "TEACHER") {
        await ensureTeacherIsClassTeacher(tx, payload.sectionId, teacherId);
      }

      if (section.classTeacherId && actor.roleType !== "TEACHER") {
        // For admin roles, ensure the markedByTeacherId is the class teacher.
        if (section.classTeacherId !== teacherId) {
          throw new ApiError(400, "markedByTeacherId must be the class teacher");
        }
      }

      await ensureStudentsInSection(tx, {
        studentIds,
        sectionId: payload.sectionId,
        academicYearId: payload.academicYearId,
      });

      await ensureAttendanceNotMarked(tx, { studentIds, attendanceDate });

      const created = [];
      for (const record of payload.records) {
        const entry = await tx.studentAttendance.create({
          data: {
            studentId: record.studentId,
            academicYearId: payload.academicYearId,
            sectionId: payload.sectionId,
            timetableSlotId: payload.timetableSlotId,
            attendanceDate,
            status: record.status,
            markedByTeacherId: teacherId,
            remarks: record.remarks,
          },
        });
        created.push(entry);
      }

      return created;
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listStudentAttendance(
  schoolId: string,
  filters: AttendanceFilters,
  pagination?: { skip: number; take: number }
) {
  const where: Prisma.StudentAttendanceWhereInput = {
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.fromDate || filters.toDate
      ? {
          attendanceDate: {
            ...(filters.fromDate ? { gte: toDateOnly(filters.fromDate) } : {}),
            ...(filters.toDate ? { lte: toDateOnly(filters.toDate) } : {}),
          },
        }
      : {}),
    section: {
      class: { schoolId, deletedAt: null },
      deletedAt: null,
    },
    student: {
      schoolId,
      deletedAt: null,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.studentAttendance.findMany({
      where,
      include: {
        student: true,
        section: true,
        timetableSlot: true,
        academicYear: true,
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.studentAttendance.count({ where }),
  ]);

  return { items, total };
}

export async function getStudentAttendanceById(schoolId: string, id: string) {
  const record = await prisma.studentAttendance.findFirst({
    where: {
      id,
      section: {
        class: { schoolId, deletedAt: null },
        deletedAt: null,
      },
      student: { schoolId, deletedAt: null },
    },
    include: {
      student: true,
      section: true,
      timetableSlot: true,
      academicYear: true,
      markedByTeacher: true,
    },
  });

  if (!record) {
    throw new ApiError(404, "Attendance record not found");
  }

  return record;
}

export async function updateStudentAttendance(
  schoolId: string,
  id: string,
  payload: UpdateStudentAttendanceInput,
  actor: ActorContext
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.studentAttendance.findFirst({
        where: {
          id,
          section: {
            class: { schoolId, deletedAt: null },
            deletedAt: null,
          },
          student: { schoolId, deletedAt: null },
        },
        include: {
          section: true,
        },
      });

      if (!record) {
        throw new ApiError(404, "Attendance record not found");
      }

      const today = toDateOnly();
      if (actor.roleType === "TEACHER" && !isSameUtcDate(record.attendanceDate, today)) {
        throw new ApiError(403, "Attendance edits allowed only on the same day");
      }

      if (actor.roleType === "TEACHER") {
        if (!actor.userId) {
          throw new ApiError(401, "Unauthorized");
        }
        const teacher = await tx.teacher.findFirst({
          where: { userId: actor.userId, schoolId, deletedAt: null },
          select: { id: true },
        });
        if (!teacher) {
          throw new ApiError(403, "Teacher account not linked");
        }
        if (record.section.classTeacherId !== teacher.id) {
          throw new ApiError(403, "Only class teacher can edit attendance");
        }
      }

      const updated = await tx.studentAttendance.update({
        where: { id },
        data: {
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}),
        },
      });

      if (payload.status && payload.status !== record.status) {
        await tx.attendanceCorrection.create({
          data: {
            attendanceId: record.id,
            oldStatus: record.status,
            newStatus: payload.status,
            reason: payload.correctionReason ?? "Correction",
            correctedById: actor.userId ?? null,
          },
        });
      }

      await tx.attendanceAuditLog.create({
        data: {
          attendanceId: record.id,
          action: payload.status ? "STATUS_UPDATE" : "REMARKS_UPDATE",
          metadata: {
            status: payload.status,
            remarks: payload.remarks,
            correctionReason: payload.correctionReason,
          },
          actorUserId: actor.userId ?? null,
        },
      });

      return updated;
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export type { AttendanceFilters };
