import prisma from "@/core/db/prisma";
export async function logAudit({ userId, action, entity, entityId, metadata, }) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                metadata,
            },
        });
    }
    catch (error) {
        console.error("Audit log failed:", error);
    }
}
