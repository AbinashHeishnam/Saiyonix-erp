import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "@/modules/notes/controller";
import {
  createNoteSchema,
  listNoteQuerySchema,
  noteIdParamSchema,
  updateNoteSchema,
} from "@/modules/notes/validation";

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
  validate({ query: listNoteQuerySchema }),
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
  validate({ params: noteIdParamSchema }),
  getById
);

notesRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("note:update"),
  validate({ params: noteIdParamSchema, body: updateNoteSchema }),
  update
);

notesRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("note:delete"),
  validate({ params: noteIdParamSchema }),
  remove
);

export default notesRouter;
