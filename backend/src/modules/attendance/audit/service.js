import prisma from "@/core/db/prisma";
export async function listAttendanceAuditLogs(schoolId, filters, pagination) {
    const where = {
        attendance: {
            ...(filters.attendanceId ? { id: filters.attendanceId } : {}),
            ...(filters.studentId ? { studentId: filters.studentId } : {}),
            student: { schoolId, deletedAt: null },
            section: { class: { schoolId, deletedAt: null }, deletedAt: null },
        },
    };
    const [items, total] = await prisma.$transaction([
        prisma.attendanceAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.attendanceAuditLog.count({ where }),
    ]);
    return { items, total };
}
