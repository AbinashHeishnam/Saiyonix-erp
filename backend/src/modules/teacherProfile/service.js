import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
async function ensureTeacherBelongsToSchool(schoolId, teacherId) {
    const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(404, "Teacher not found");
    }
}
export async function createTeacherProfile(schoolId, payload) {
    await ensureTeacherBelongsToSchool(schoolId, payload.teacherId);
    const existing = await prisma.teacherProfile.findUnique({
        where: { teacherId: payload.teacherId },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Teacher profile already exists");
    }
    return prisma.teacherProfile.create({
        data: {
            teacherId: payload.teacherId,
            qualification: payload.qualification,
            address: payload.address,
            photoUrl: payload.photoUrl,
            emergencyContactMobile: payload.emergencyContactMobile,
        },
    });
}
export async function getTeacherProfileByTeacherId(schoolId, teacherId) {
    const profile = await prisma.teacherProfile.findFirst({
        where: { teacherId, teacher: { schoolId, deletedAt: null } },
    });
    if (!profile) {
        throw new ApiError(404, "Teacher profile not found");
    }
    return profile;
}
export async function listTeacherProfiles(schoolId, pagination) {
    const where = {
        teacher: { schoolId, deletedAt: null },
    };
    const [items, total] = await prisma.$transaction([
        prisma.teacherProfile.findMany({
            where,
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        employeeId: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.teacherProfile.count({ where }),
    ]);
    return { items, total };
}
export async function updateTeacherProfile(schoolId, teacherId, payload) {
    await ensureTeacherBelongsToSchool(schoolId, teacherId);
    const existing = await prisma.teacherProfile.findFirst({
        where: { teacherId, teacher: { schoolId, deletedAt: null } },
        select: { id: true },
    });
    if (!existing) {
        throw new ApiError(404, "Teacher profile not found");
    }
    return prisma.teacherProfile.update({
        where: { teacherId },
        data: {
            ...(payload.qualification !== undefined
                ? { qualification: payload.qualification }
                : {}),
            ...(payload.address !== undefined ? { address: payload.address } : {}),
            ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl } : {}),
            ...(payload.emergencyContactMobile !== undefined
                ? { emergencyContactMobile: payload.emergencyContactMobile }
                : {}),
        },
    });
}
