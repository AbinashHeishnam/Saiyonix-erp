import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { uploadSingle } from "@/middleware/upload.middleware";
import { apply, myLeaves } from "@/modules/teacherLeave/controller";
import { applyTeacherLeaveSchema, listTeacherLeaveQuerySchema } from "@/modules/teacherLeave/validation";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
const router = Router();
async function resolveTeacherLeaveAttachmentOwner(req) {
    const user = req.user;
    const roleType = user?.roleType;
    const userId = user?.sub;
    const schoolId = req.schoolId;
    if (!roleType || !userId || !schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    if (roleType !== "TEACHER") {
        throw new ApiError(403, "Forbidden");
    }
    const teacher = await prisma.teacher.findFirst({
        where: { userId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    return { userType: "teacher", userId: teacher.id };
}
router.post("/apply", authMiddleware, allowRoles("TEACHER"), requirePermission("teacherLeave:create"), ...uploadSingle({
    module: "leave-attachment",
    fieldName: "attachment",
    resolveUser: resolveTeacherLeaveAttachmentOwner,
}), validate(applyTeacherLeaveSchema), apply);
router.get("/my", authMiddleware, allowRoles("TEACHER"), requirePermission("teacherLeave:read"), validate({ query: listTeacherLeaveQuerySchema }), myLeaves);
export default router;
