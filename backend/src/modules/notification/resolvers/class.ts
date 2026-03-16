import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import type { NotificationPayload } from "../types";

export async function resolveClass(
  payload: NotificationPayload
): Promise<string[]> {
  if (!payload.schoolId) {
    throw new ApiError(400, "schoolId is required for recipient resolution");
  }

  if (!payload.classId) {
    throw new ApiError(400, "classId is required for CLASS resolver");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId: payload.classId,
      student: { schoolId: payload.schoolId, deletedAt: null },
    },
    select: { student: { select: { userId: true } } },
  });

  return enrollments
    .map((enrollment) => enrollment.student.userId)
    .filter((userId): userId is string => Boolean(userId));
}
