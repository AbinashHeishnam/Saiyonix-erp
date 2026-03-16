import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import type { NotificationPayload } from "../types";
import type { UserRole } from "@prisma/client";

export async function resolveRoleAll(
  payload: NotificationPayload,
  roles?: UserRole[]
): Promise<string[]> {
  if (!payload.schoolId) {
    throw new ApiError(400, "schoolId is required for recipient resolution");
  }

  const targetRoles = roles ?? payload.roles;
  if (!targetRoles || targetRoles.length === 0) {
    throw new ApiError(400, "roles are required for ROLE_ALL resolver");
  }

  const users = await prisma.user.findMany({
    where: {
      schoolId: payload.schoolId,
      isActive: true,
      role: { roleType: { in: targetRoles } },
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}
