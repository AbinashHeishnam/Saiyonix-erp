import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createTeacher,
  deleteTeacher,
  getTeacher,
  getTeacherProfile,
  getTeacherPublicProfile,
  listTeachers,
  updateTeacher,
  updateTeacherProfile,
  updateTeacherPhoto,
  updateTeacherStatus,
  getTeacherTimetable,
  getTeacherIdCard,
} from "@/modules/teacher/controller";
import { teacherHistory, teacherHistoryById } from "@/modules/teacher/history.controller";
import {
  createTeacherSchema,
  listTeacherQuerySchema,
  teacherProfileQuerySchema,
  teacherIdParamSchema,
  updateTeacherSchema,
  updateTeacherProfileSchema,
  updateTeacherStatusSchema,
} from "@/modules/teacher/validation";
import { uploadSingle } from "@/middleware/upload.middleware";

const teacherRouter = Router();

teacherRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:create"),
  validate(createTeacherSchema),
  createTeacher
);
teacherRouter.get(
  "/:id/public",
  validate({ params: teacherIdParamSchema }),
  getTeacherPublicProfile
);
teacherRouter.get(
  "/profile",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "TEACHER"),
  validate({ query: teacherProfileQuerySchema }),
  getTeacherProfile
);
teacherRouter.patch(
  "/profile",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "TEACHER"),
  validate(updateTeacherProfileSchema),
  updateTeacherProfile
);

teacherRouter.post(
  "/profile/photo",
  authMiddleware,
  allowRoles("TEACHER"),
  ...uploadSingle({ module: "profile-photo", userType: "teacher", fieldName: "photo" }),
  updateTeacherPhoto
);
teacherRouter.get(
  "/id-card",
  authMiddleware,
  allowRoles("TEACHER"),
  getTeacherIdCard
);
teacherRouter.get(
  "/",
  authMiddleware,
  validate({ query: listTeacherQuerySchema }),
  listTeachers
);
teacherRouter.get(
  "/:id/timetable",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("timetableSlot:read"),
  validate({ params: teacherIdParamSchema }),
  getTeacherTimetable
);
teacherRouter.get(
  "/history",
  authMiddleware,
  allowRoles("TEACHER"),
  teacherHistory
);
teacherRouter.get(
  "/:id/history",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  validate({ params: teacherIdParamSchema }),
  teacherHistoryById
);
teacherRouter.get("/:id", authMiddleware, validate({ params: teacherIdParamSchema }), getTeacher);
teacherRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherIdParamSchema, body: updateTeacherSchema }),
  updateTeacher
);
teacherRouter.patch(
  "/:id/status",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherIdParamSchema, body: updateTeacherStatusSchema }),
  updateTeacherStatus
);
teacherRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:delete"),
  validate({ params: teacherIdParamSchema }),
  deleteTeacher
);

export default teacherRouter;
