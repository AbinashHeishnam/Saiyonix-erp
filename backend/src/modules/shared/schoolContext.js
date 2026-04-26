import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function getUserSchoolId(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { schoolId: true },
    });
    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }
    return user.schoolId;
}
