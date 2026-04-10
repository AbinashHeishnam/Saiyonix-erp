import prisma from "@/core/db/prisma";

type AuditParams = {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
};

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  metadata,
}: AuditParams) {
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
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
