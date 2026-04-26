import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
function mapPrismaError(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            throw new ApiError(409, "Subject code already exists");
        }
        if (error.code === "P2003") {
            throw new ApiError(400, "Invalid relation reference");
        }
    }
    throw error;
}
export async function createSubject(schoolId, payload) {
    try {
        return await prisma.subject.create({
            data: {
                schoolId,
                code: payload.code,
                name: payload.name,
                isElective: payload.isElective ?? false,
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listSubjects(schoolId, pagination) {
    const where = { schoolId };
    const [items, total] = await prisma.$transaction([
        prisma.subject.findMany({
            where,
            orderBy: [{ code: "asc" }, { name: "asc" }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.subject.count({ where }),
    ]);
    return { items, total };
}
export async function getSubjectById(schoolId, id) {
    const subject = await prisma.subject.findFirst({
        where: {
            id,
            schoolId,
        },
    });
    if (!subject) {
        throw new ApiError(404, "Subject not found");
    }
    return subject;
}
export async function updateSubject(schoolId, id, payload) {
    await getSubjectById(schoolId, id);
    try {
        return await prisma.subject.update({
            where: { id },
            data: {
                ...(payload.code !== undefined ? { code: payload.code } : {}),
                ...(payload.name !== undefined ? { name: payload.name } : {}),
                ...(payload.isElective !== undefined ? { isElective: payload.isElective } : {}),
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function deleteSubject(schoolId, id) {
    await getSubjectById(schoolId, id);
    try {
        await prisma.subject.delete({
            where: { id },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    return { id };
}
