import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import type { NotificationPayload } from "../types";

export async function resolveSchoolAll(
  payload: NotificationPayload
): Promise<string[]> {
  if (!payload.schoolId) {
    throw new ApiError(400, "schoolId is required for recipient resolution");
  }

  const users = await prisma.user.findMany({
    where: { schoolId: payload.schoolId, isActive: true },
    select: { id: true },
  });

  return users.map((user) => user.id);
}
