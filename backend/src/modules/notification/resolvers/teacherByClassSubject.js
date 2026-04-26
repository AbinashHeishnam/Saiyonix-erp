import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function resolveTeacherByClassSubject(payload) {
    if (!payload.schoolId) {
        throw new ApiError(400, "schoolId is required for recipient resolution");
    }
    if (!payload.classSubjectId) {
        throw new ApiError(400, "classSubjectId is required for TEACHER_BY_CLASS_SUBJECT resolver");
    }
    const assignments = await prisma.teacherSubjectClass.findMany({
        where: {
            classSubjectId: payload.classSubjectId,
            ...(payload.sectionId ? { sectionId: payload.sectionId } : {}),
            teacher: { schoolId: payload.schoolId, deletedAt: null },
        },
        select: { teacher: { select: { userId: true } } },
    });
    return assignments
        .map((assignment) => assignment.teacher.userId)
        .filter((userId) => Boolean(userId));
}
