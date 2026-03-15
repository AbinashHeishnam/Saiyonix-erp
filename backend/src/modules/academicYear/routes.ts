import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createAcademicYearSchema, updateAcademicYearSchema } from "./validation";

const academicYearRouter = Router();

academicYearRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("academicYear:create"),
  validate(createAcademicYearSchema),
  create
);
academicYearRouter.get("/", authMiddleware, list);
academicYearRouter.get("/:id", authMiddleware, getById);
academicYearRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("academicYear:update"),
  validate(updateAcademicYearSchema),
  update
);
academicYearRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("academicYear:delete"),
  remove
);

export default academicYearRouter;
