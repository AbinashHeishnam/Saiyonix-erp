import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { getByStudent } from "@/modules/admitCards/controller";
import {
  admitCardByStudentQuerySchema,
  admitCardStudentParamSchema,
} from "@/modules/admitCards/validation";

const admitCardStudentRouter = Router();

admitCardStudentRouter.get(
  "/:studentId",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "STUDENT", "PARENT"),
  requirePermission("admitCard:read"),
  validate({ params: admitCardStudentParamSchema, query: admitCardByStudentQuerySchema }),
  getByStudent
);

export default admitCardStudentRouter;
