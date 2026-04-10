import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "@/modules/timetableSlot/controller";
import {
  createTimetableSlotSchema,
  listTimetableSlotQuerySchema,
  timetableSlotIdParamSchema,
  updateTimetableSlotSchema,
} from "@/modules/timetableSlot/validation";

const timetableSlotRouter = Router();

timetableSlotRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:create"),
  validate(createTimetableSlotSchema),
  create
);

timetableSlotRouter.get(
  "/",
  authMiddleware,
  validate({ query: listTimetableSlotQuerySchema }),
  list
);
timetableSlotRouter.get(
  "/:id",
  authMiddleware,
  validate({ params: timetableSlotIdParamSchema }),
  getById
);

timetableSlotRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:update"),
  validate({ params: timetableSlotIdParamSchema, body: updateTimetableSlotSchema }),
  update
);

timetableSlotRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("timetableSlot:delete"),
  validate({ params: timetableSlotIdParamSchema }),
  remove
);

export default timetableSlotRouter;
