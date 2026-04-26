import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function resolveSchoolAll(payload) {
    if (!payload.schoolId) {
        throw new ApiError(400, "schoolId is required for recipient resolution");
    }
    const users = await prisma.user.findMany({
        where: { schoolId: payload.schoolId, isActive: true },
        select: { id: true },
    });
    return users.map((user) => user.id);
}
