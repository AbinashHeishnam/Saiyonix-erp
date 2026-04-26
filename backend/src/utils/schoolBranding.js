import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function getSchoolBranding(schoolId) {
    const school = await prisma.school.findFirst({
        where: { id: schoolId },
        select: {
            name: true,
            address: true,
            phone: true,
            email: true,
            logoUrl: true,
        },
    });
    if (!school) {
        throw new ApiError(404, "School not found");
    }
    return {
        schoolName: school.name,
        schoolAddress: school.address ?? null,
        schoolPhone: school.phone ?? null,
        officialEmail: school.email ?? null,
        logoUrl: school.logoUrl ?? null,
    };
}
export function buildSchoolHeaderLines(branding) {
    const lines = [];
    if (branding.schoolAddress)
        lines.push(branding.schoolAddress);
    if (branding.schoolPhone)
        lines.push(`Phone: ${branding.schoolPhone}`);
    if (branding.officialEmail)
        lines.push(`Email: ${branding.officialEmail}`);
    return lines;
}
