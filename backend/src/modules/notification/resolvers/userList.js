import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function resolveUserList(payload) {
    if (!payload.schoolId) {
        throw new ApiError(400, "schoolId is required for recipient resolution");
    }
    const userIds = payload.userIds ?? [];
    if (userIds.length === 0) {
        throw new ApiError(400, "userIds are required for USER_LIST resolver");
    }
    const users = await prisma.user.findMany({
        where: { id: { in: userIds }, schoolId: payload.schoolId, isActive: true },
        select: { id: true },
    });
    return users.map((user) => user.id);
}
