import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  addSubject,
  addTimetable,
  create,
  getById,
  list,
  lockMarks,
  publishTimetable,
  lock,
  publish,
  unlockMarks,
  register,
  listRegistrations,
  listRegistrationsAdmin,
} from "@/modules/exams/controller";
import {
  addExamSubjectSchema,
  addExamTimetableSchema,
  createExamSchema,
  examIdParamSchema,
  examRegistrationsQuerySchema,
  examRegistrationsAdminQuerySchema,
  listExamQuerySchema,
  registerExamSchema,
} from "@/modules/exams/validation";

const examsRouter = Router();

examsRouter.post(
  "/",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:create"),
  validate(createExamSchema),
  create
);

examsRouter.post(
  "/:id/subjects",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:update"),
  validate({ params: examIdParamSchema, body: addExamSubjectSchema }),
  addSubject
);

examsRouter.post(
  "/:id/timetable",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:update"),
  validate({ params: examIdParamSchema, body: addExamTimetableSchema }),
  addTimetable
);

examsRouter.patch(
  "/:id/publish-timetable",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:update"),
  validate({ params: examIdParamSchema }),
  publishTimetable
);

examsRouter.get(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "STUDENT",
    "PARENT"
  ),
  requirePermission("exam:read"),
  validate({ query: listExamQuerySchema }),
  list
);

examsRouter.get(
  "/registrations",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("exam:read"),
  validate({ query: examRegistrationsQuerySchema }),
  listRegistrations
);

examsRouter.get(
  "/registrations/admin",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:read"),
  validate({ query: examRegistrationsAdminQuerySchema }),
  listRegistrationsAdmin
);

examsRouter.get(
  "/:id",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "STUDENT",
    "PARENT"
  ),
  requirePermission("exam:read"),
  validate({ params: examIdParamSchema }),
  getById
);

examsRouter.patch(
  "/:id/publish",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:publish"),
  validate({ params: examIdParamSchema }),
  publish
);

examsRouter.patch(
  "/:id/lock",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:lock"),
  validate({ params: examIdParamSchema }),
  lock
);

examsRouter.patch(
  "/:id/lock-marks",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:lock"),
  validate({ params: examIdParamSchema }),
  lockMarks
);

examsRouter.patch(
  "/:id/unlock-marks",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("exam:lock"),
  validate({ params: examIdParamSchema }),
  unlockMarks
);

examsRouter.post(
  "/register",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("exam:register"),
  validate({ body: registerExamSchema }),
  register
);

export default examsRouter;
