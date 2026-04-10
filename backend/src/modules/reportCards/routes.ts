import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { heavyJobLimiter } from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validate.middleware";
import { get, getPdf } from "@/modules/reportCards/controller";
import { examIdParamSchema, reportCardQuerySchema } from "@/modules/reportCards/validation";

const reportCardsRouter = Router();
const reportCardPermission = requirePermission("reportCard:read");

const allowStudentParentOrPermission = (
  req: { user?: { roleType?: string } },
  res: any,
  next: any
) => {
  const roleType = req.user?.roleType;
  if (roleType === "STUDENT" || roleType === "PARENT") {
    return next();
  }
  return reportCardPermission(req as any, res, next);
};

reportCardsRouter.get(
  "/:examId",
  authMiddleware,
  allowRoles("STUDENT", "PARENT", "ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  allowStudentParentOrPermission,
  validate({ params: examIdParamSchema, query: reportCardQuerySchema }),
  get
);

reportCardsRouter.get(
  "/:examId/pdf",
  authMiddleware,
  heavyJobLimiter,
  allowRoles("STUDENT", "PARENT", "ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  allowStudentParentOrPermission,
  validate({ params: examIdParamSchema, query: reportCardQuerySchema }),
  getPdf
);

export default reportCardsRouter;
