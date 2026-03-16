import type { Prisma } from "@prisma/client";

import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";

export type AttendanceAuditFilters = {
  attendanceId?: string;
  studentId?: string;
};

export async function listAttendanceAuditLogs(
  schoolId: string,
  filters: AttendanceAuditFilters,
  pagination?: { skip: number; take: number }
): Promise<{ items: Prisma.AttendanceAuditLogGetPayload<{}>[]; total: number }> {
  if (!filters.attendanceId && !filters.studentId) {
    throw new ApiError(400, "attendanceId or studentId is required");
  }

  const where: Prisma.AttendanceAuditLogWhereInput = {
    attendance: {
      ...(filters.attendanceId ? { id: filters.attendanceId } : {}),
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      student: { schoolId, deletedAt: null },
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.attendanceAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.attendanceAuditLog.count({ where }),
  ]);

  return { items, total };
}
