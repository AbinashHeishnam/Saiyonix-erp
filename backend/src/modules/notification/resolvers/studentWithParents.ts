import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import type { NotificationPayload } from "../types";

export async function resolveStudentWithParents(
  payload: NotificationPayload,
  options?: { includeStudent?: boolean; includeParents?: boolean }
): Promise<string[]> {
  if (!payload.schoolId) {
    throw new ApiError(400, "schoolId is required for recipient resolution");
  }

  const studentIds = payload.studentIds ?? (payload.studentId ? [payload.studentId] : []);
  if (studentIds.length === 0) {
    throw new ApiError(400, "studentId or studentIds are required for STUDENT_WITH_PARENTS resolver");
  }

  const includeStudent = options?.includeStudent ?? true;
  const includeParents = options?.includeParents ?? true;

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId: payload.schoolId, deletedAt: null },
    select: {
      userId: true,
      parentLinks: {
        select: { parent: { select: { userId: true, schoolId: true } } },
      },
    },
  });

  const recipientIds: string[] = [];

  if (includeStudent) {
    for (const student of students) {
      if (student.userId) {
        recipientIds.push(student.userId);
      }
    }
  }

  if (includeParents) {
    for (const student of students) {
      for (const link of student.parentLinks) {
        if (link.parent.userId && link.parent.schoolId === payload.schoolId) {
          recipientIds.push(link.parent.userId);
        }
      }
    }
  }

  return recipientIds;
}
