import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function resolveSection(payload) {
    if (!payload.schoolId) {
        throw new ApiError(400, "schoolId is required for recipient resolution");
    }
    if (!payload.sectionId) {
        throw new ApiError(400, "sectionId is required for SECTION resolver");
    }
    const enrollments = await prisma.studentEnrollment.findMany({
        where: {
            sectionId: payload.sectionId,
            student: { schoolId: payload.schoolId, deletedAt: null },
        },
        select: { student: { select: { userId: true } } },
    });
    return enrollments
        .map((enrollment) => enrollment.student.userId)
        .filter((userId) => Boolean(userId));
}
