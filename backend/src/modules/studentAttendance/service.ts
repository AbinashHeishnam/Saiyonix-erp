import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { toLocalDateOnly } from "@/core/utils/localDate";
import { markAttendance, updateAttendance } from "@/modules/attendance/service";
import type {
  CreateStudentAttendanceInput,
  UpdateStudentAttendanceInput,
} from "@/modules/studentAttendance/validation";

type DbClient = typeof prisma;

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

// TODO(attendance): studentAttendance is a legacy wrapper; migrate callers to src/modules/attendance.

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

async function getActiveAcademicYearId(client: DbClient, schoolId: string) {
  const academicYear = await client.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  return academicYear.id;
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

async function findExistingStudentAttendance(
  client: DbClient,
  params: { studentIds: string[]; attendanceDate: Date }
) {
  return client.studentAttendance.findMany({
    where: {
      studentId: { in: params.studentIds },
      attendanceDate: params.attendanceDate,
    },
    select: { studentId: true },
  });
}

async function findSectionAttendance(
  client: DbClient,
  params: { sectionId: string; attendanceDate: Date }
) {
  return client.sectionAttendance.findFirst({
    where: {
      sectionId: params.sectionId,
      attendanceDate: params.attendanceDate,
    },
    select: { id: true },
  });
}

async function ensureTeacherIsClassTeacher(
  client: DbClient,
  sectionId: string,
  teacherId: string,
  attendanceDate: Date,
  timeZone: string
) {
  const section = await client.section.findFirst({
    where: { id: sectionId, deletedAt: null },
    select: { id: true, classTeacherId: true },
  });

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  if (section.classTeacherId !== teacherId) {
    const dateOnly = toLocalDateOnly(attendanceDate, timeZone);
    const substitution = await client.substitution.findFirst({
      where: {
        sectionId,
        date: dateOnly,
        substituteTeacherId: teacherId,
      },
      select: { id: true, isClassTeacherSubstitution: true, absentTeacherId: true },
    });
    console.log({
      teacherId,
      sectionClassTeacher: section.classTeacherId,
      substitution,
      dateOnly,
    });
    const isClassTeacher = section.classTeacherId === teacherId;
    const isValidSubstitute =
      substitution &&
      (substitution.isClassTeacherSubstitution === true ||
        substitution.absentTeacherId === section.classTeacherId);
    if (!isClassTeacher && !isValidSubstitute) {
      throw new ApiError(403, "Not allowed to mark attendance");
    }
  }
}

export async function markStudentAttendance(
  schoolId: string,
  payload: CreateStudentAttendanceInput,
  actor: ActorContext
) {
  try {
    if (actor.roleType === "TEACHER" && !payload.markedByTeacherId) {
      return await markAttendance(schoolId, payload, {
        userId: actor.userId,
        roleType: actor.roleType,
      });
    }

    const attendanceDate = toDateOnly(payload.attendanceDate);
    const studentIds = payload.records.map((record) => record.studentId);

    return await prisma.$transaction(async (tx) => {
      const db = tx as DbClient;
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
      });
      const timeZone = school?.timezone ?? "Asia/Kolkata";
      const academicYearId =
        payload.academicYearId ?? (await getActiveAcademicYearId(db, schoolId));
      await ensureAcademicYearBelongsToSchool(db, schoolId, academicYearId);
      const section = await ensureSectionBelongsToSchool(
        db,
        schoolId,
        payload.sectionId
      );

      const teacherId = await resolveTeacherId(db, schoolId, {
        roleType: actor.roleType,
        userId: actor.userId,
        markedByTeacherId: payload.markedByTeacherId,
      });

      if (actor.roleType === "TEACHER") {
        await ensureTeacherIsClassTeacher(
          db,
          payload.sectionId,
          teacherId,
          attendanceDate,
          timeZone
        );
      }

      if (section.classTeacherId && actor.roleType !== "TEACHER") {
        // For admin roles, ensure the markedByTeacherId is the class teacher.
        if (section.classTeacherId !== teacherId) {
          throw new ApiError(400, "markedByTeacherId must be the class teacher");
        }
      }

      await ensureStudentsInSection(db, {
        studentIds,
        sectionId: payload.sectionId,
        academicYearId,
      });

      const existingAttendance = await findExistingStudentAttendance(db, {
        studentIds,
        attendanceDate,
      });
      if (existingAttendance.length === studentIds.length) {
        throw new ApiError(409, "Attendance already marked for all students");
      }
      const existingSet = new Set(existingAttendance.map((item) => item.studentId));
      const recordsToCreate = payload.records.filter(
        (record) => !existingSet.has(record.studentId)
      );
      if (recordsToCreate.length === 0) {
        throw new ApiError(409, "Attendance already marked for all students");
      }

      const existingSection = await findSectionAttendance(db, {
        sectionId: payload.sectionId,
        attendanceDate,
      });
      if (!existingSection) {
        await tx.sectionAttendance.create({
          data: {
            sectionId: payload.sectionId,
            academicYearId,
            attendanceDate,
            markedByTeacherId: teacherId,
          },
        });
      }

      const entries = recordsToCreate.map((record) => ({
        studentId: record.studentId,
        academicYearId,
        sectionId: payload.sectionId,
        attendanceDate,
        status: record.status,
        markedByTeacherId: teacherId,
        remarks: record.remarks,
      }));

      await tx.studentAttendance.createMany({
        data: entries,
      });

      return tx.studentAttendance.findMany({
        where: {
          studentId: { in: studentIds },
          attendanceDate,
          academicYearId,
          sectionId: payload.sectionId,
        },
      });
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
      select: {
        id: true,
        studentId: true,
        student: {
          select: {
            fullName: true,
          },
        },
        attendanceDate: true,
        status: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
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
    if (actor.roleType === "TEACHER") {
      return await updateAttendance(schoolId, id, payload, {
        userId: actor.userId,
        roleType: actor.roleType,
      });
    }

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
          const school = await tx.school.findUnique({
            where: { id: schoolId },
            select: { timezone: true },
          });
          const timeZone = school?.timezone ?? "Asia/Kolkata";
          const dateOnly = toLocalDateOnly(record.attendanceDate, timeZone);
          const substitution = await tx.substitution.findFirst({
            where: {
              sectionId: record.sectionId,
              date: dateOnly,
              substituteTeacherId: teacher.id,
            },
            select: { id: true, isClassTeacherSubstitution: true, absentTeacherId: true },
          });
          console.log({
            teacherId: teacher.id,
            sectionClassTeacher: record.section.classTeacherId,
            substitution,
            dateOnly,
          });
          const isClassTeacher = record.section.classTeacherId === teacher.id;
          const isValidSubstitute =
            substitution &&
            (substitution.isClassTeacherSubstitution === true ||
              substitution.absentTeacherId === record.section.classTeacherId);
          if (!isClassTeacher && !isValidSubstitute) {
            throw new ApiError(403, "Not allowed to mark attendance");
          }
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
            correctedAt: new Date(),
            status: "APPROVED",
            requestedById: actor.userId ?? null,
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
