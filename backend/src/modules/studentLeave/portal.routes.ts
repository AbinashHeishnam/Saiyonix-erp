import { Router, Request } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { uploadSingle } from "@/middleware/upload.middleware";
import { apply, myLeaves } from "@/modules/studentLeave/controller";
import { applyStudentLeaveSchema, listStudentLeaveQuerySchema } from "@/modules/studentLeave/validation";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";

const router = Router();

async function resolveLeaveAttachmentOwner(
  req: Request
): Promise<{ userType: "student" | "parent"; userId: string }> {
  const user = (req as { user?: { roleType?: string; sub?: string } }).user;
  const roleType = user?.roleType;
  const userId = user?.sub;
  const schoolId = (req as { schoolId?: string }).schoolId;
  if (!roleType || !userId) {
    throw new ApiError(401, "Unauthorized");
  }
  if (!schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId, schoolId, deletedAt: null },
      select: { id: true, schoolId: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    return { userType: "student", userId: student.id };
  }

  const studentId =
    typeof (req as { body?: { studentId?: string } }).body?.studentId === "string"
      ? (req as { body?: { studentId?: string } }).body?.studentId
      : "";
  if (!studentId) {
    throw new ApiError(400, "studentId is required");
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { userId, schoolId },
      select: { id: true, schoolId: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, studentId },
      select: { id: true },
    });
    if (!link) {
      throw new ApiError(403, "Parent is not linked to this student");
    }
    return { userType: "student", userId: studentId };
  }

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(400, "Student not found");
    }
    return { userType: "student", userId: studentId };
  }

  throw new ApiError(403, "Forbidden");
}

router.post(
  "/apply",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("studentLeave:create"),
  ...uploadSingle({
    module: "leave-attachment",
    fieldName: "attachment",
    resolveUser: resolveLeaveAttachmentOwner,
  }),
  validate(applyStudentLeaveSchema),
  apply
);

router.get(
  "/my",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("studentLeave:read"),
  validate({ query: listStudentLeaveQuerySchema }),
  myLeaves
);

export default router;
