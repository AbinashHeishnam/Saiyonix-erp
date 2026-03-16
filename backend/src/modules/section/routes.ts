import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, getTimetable, list, remove, update } from "./controller";
import { createSectionSchema, updateSectionSchema } from "./validation";

const sectionRouter = Router();

sectionRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("section:create"),
  validate(createSectionSchema),
  create
);
sectionRouter.get("/", authMiddleware, list);
sectionRouter.get(
  "/:id/timetable",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"),
  requirePermission("timetableSlot:read"),
  getTimetable
);
sectionRouter.get("/:id", authMiddleware, getById);
sectionRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("section:update"),
  validate(updateSectionSchema),
  update
);
sectionRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("section:delete"),
  remove
);

export default sectionRouter;
