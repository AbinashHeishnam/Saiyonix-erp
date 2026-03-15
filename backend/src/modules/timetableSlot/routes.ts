import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createTimetableSlotSchema, updateTimetableSlotSchema } from "./validation";

const timetableSlotRouter = Router();

timetableSlotRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:create"),
  validate(createTimetableSlotSchema),
  create
);

timetableSlotRouter.get("/", authMiddleware, list);
timetableSlotRouter.get("/:id", authMiddleware, getById);

timetableSlotRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:update"),
  validate(updateTimetableSlotSchema),
  update
);

timetableSlotRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:delete"),
  remove
);

export default timetableSlotRouter;
