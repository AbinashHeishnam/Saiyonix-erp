import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "@/modules/subject/controller";
import {
  createSubjectSchema,
  listSubjectQuerySchema,
  subjectIdParamSchema,
  updateSubjectSchema,
} from "@/modules/subject/validation";

const subjectRouter = Router();

subjectRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:create"),
  validate(createSubjectSchema),
  create
);
subjectRouter.get("/", authMiddleware, validate({ query: listSubjectQuerySchema }), list);
subjectRouter.get("/:id", authMiddleware, validate({ params: subjectIdParamSchema }), getById);
subjectRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:update"),
  validate({ params: subjectIdParamSchema, body: updateSubjectSchema }),
  update
);
subjectRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:delete"),
  validate({ params: subjectIdParamSchema }),
  remove
);

export default subjectRouter;
