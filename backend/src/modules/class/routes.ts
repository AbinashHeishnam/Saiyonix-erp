import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  assignClassTeacherController,
  create,
  getById,
  list,
  remove,
  removeClassTeacherController,
  update,
} from "@/modules/class/controller";
import {
  assignClassTeacherSchema,
  classIdParamSchema,
  createClassSchema,
  listClassQuerySchema,
  removeClassTeacherSchema,
  updateClassSchema,
} from "@/modules/class/validation";

const classRouter = Router();

classRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:create"),
  validate(createClassSchema),
  create
);
classRouter.get("/", authMiddleware, validate({ query: listClassQuerySchema }), list);
classRouter.get("/:id", authMiddleware, validate({ params: classIdParamSchema }), getById);
classRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:update"),
  validate({ params: classIdParamSchema, body: updateClassSchema }),
  update
);
classRouter.post(
  "/assign-class-teacher",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:update"),
  validate(assignClassTeacherSchema),
  assignClassTeacherController
);
classRouter.patch(
  "/remove-class-teacher",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:update"),
  validate(removeClassTeacherSchema),
  removeClassTeacherController
);
classRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:delete"),
  validate({ params: classIdParamSchema }),
  remove
);

export default classRouter;
