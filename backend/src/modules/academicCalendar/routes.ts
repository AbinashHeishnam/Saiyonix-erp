import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  academicCalendarEventIdParamSchema,
  createAcademicCalendarEventSchema,
  emergencyHolidaySchema,
  listAcademicCalendarQuerySchema,
  updateAcademicCalendarEventSchema,
} from "@/modules/academicCalendar/validation";
import {
  create,
  emergencyHoliday,
  list,
  remove,
  summary,
  update,
} from "@/modules/academicCalendar/controller";

const academicCalendarRouter = Router();

academicCalendarRouter.get(
  "/academic-calendar",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "STUDENT", "PARENT"),
  requirePermission("academicCalendar:read"),
  validate({ query: listAcademicCalendarQuerySchema }),
  list
);

academicCalendarRouter.get(
  "/academic-calendar/summary",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "STUDENT", "PARENT"),
  requirePermission("academicCalendar:read"),
  summary
);

academicCalendarRouter.post(
  "/academic-calendar",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("academicCalendar:create"),
  validate(createAcademicCalendarEventSchema),
  create
);

academicCalendarRouter.patch(
  "/academic-calendar/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("academicCalendar:update"),
  validate({ params: academicCalendarEventIdParamSchema, body: updateAcademicCalendarEventSchema }),
  update
);

academicCalendarRouter.delete(
  "/academic-calendar/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("academicCalendar:delete"),
  validate({ params: academicCalendarEventIdParamSchema }),
  remove
);

academicCalendarRouter.post(
  "/academic-calendar/emergency-holiday",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("academicCalendar:create"),
  validate(emergencyHolidaySchema),
  emergencyHoliday
);

export default academicCalendarRouter;
