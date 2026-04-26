import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function resolveClass(payload) {
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
        .filter((userId) => Boolean(userId));
}
