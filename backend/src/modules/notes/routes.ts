import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createNoteSchema, updateNoteSchema } from "./validation";

const notesRouter = Router();

notesRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("note:create"),
  validate(createNoteSchema),
  create
);

notesRouter.get(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("note:read"),
  list
);

notesRouter.get(
  "/:id",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("note:read"),
  getById
);

notesRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("note:update"),
  validate(updateNoteSchema),
  update
);

notesRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("note:delete"),
  remove
);

export default notesRouter;
