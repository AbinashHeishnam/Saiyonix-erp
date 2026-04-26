import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { canStudentInteractWithPreviousYear, getPreviousAcademicYear, } from "@/modules/academicYear/service";
export async function getActiveAcademicYearId(schoolId, client = prisma) {
    const academicYear = await client.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
    }
    return academicYear.id;
}
export async function resolveStudentEnrollmentForPortal(params) {
    const client = params.client ?? prisma;
    const activeAcademicYearId = await getActiveAcademicYearId(params.schoolId, client);
    let targetAcademicYearId = activeAcademicYearId;
    if (params.allowPreviousYear) {
        const canUsePrevious = await canStudentInteractWithPreviousYear(params.schoolId);
        if (canUsePrevious) {
            const previousYear = await getPreviousAcademicYear(params.schoolId);
            if (previousYear?.id) {
                const previousEnrollment = await client.studentEnrollment.findFirst({
                    where: {
                        studentId: params.studentId,
                        academicYearId: previousYear.id,
                        student: { schoolId: params.schoolId, deletedAt: null },
                    },
                    orderBy: { createdAt: "desc" },
                    select: { classId: true, sectionId: true, academicYearId: true },
                });
                if (previousEnrollment) {
                    return {
                        studentId: params.studentId,
                        classId: previousEnrollment.classId,
                        sectionId: previousEnrollment.sectionId,
                        academicYearId: previousEnrollment.academicYearId,
                    };
                }
            }
        }
    }
    const enrollment = await client.studentEnrollment.findFirst({
        where: {
            studentId: params.studentId,
            academicYearId: targetAcademicYearId,
            student: { schoolId: params.schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: { classId: true, sectionId: true, academicYearId: true },
    });
    if (!enrollment) {
        throw new ApiError(404, "Student enrollment not found");
    }
    return {
        studentId: params.studentId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        academicYearId: enrollment.academicYearId,
    };
}
