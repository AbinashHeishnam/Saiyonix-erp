import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  teacherAssignedExams,
  teacherMarksEntryContext,
  teacherMarksEntryMatrix,
  teacherSubmitMarks,
  teacherSubmitMarksBulk,
  adminExamResultStatus,
  adminPublishResult,
  getExamResultMe,
  studentResultRecheck,
  adminListComplaints,
  teacherExamAnalytics,
  teacherMyClassAnalytics,
} from "@/modules/examWorkflow/controller";
import {
  marksEntryQuerySchema,
  marksEntryAllQuerySchema,
  submitMarksSchema,
  submitMarksBulkSchema,
  examIdParamSchema,
  recheckSchema,
  complaintQuerySchema,
  teacherAnalyticsQuerySchema,
  teacherMyClassAnalyticsQuerySchema,
} from "@/modules/examWorkflow/validation";

const router = Router();

router.get(
  "/teacher/exam/assigned",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("marks:create"),
  teacherAssignedExams
);

router.get(
  "/teacher/analytics/my-class",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("marks:read"),
  validate({ query: teacherMyClassAnalyticsQuerySchema }),
  teacherMyClassAnalytics
);

router.get(
  "/teacher/exam/analytics",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("marks:read"),
  validate({ query: teacherAnalyticsQuerySchema }),
  teacherExamAnalytics
);

router.get(
  "/teacher/exam/marks-entry",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("marks:create"),
  validate({ query: marksEntryQuerySchema }),
  teacherMarksEntryContext
);

router.get(
  "/teacher/exam/marks-entry/all",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("marks:create"),
  validate({ query: marksEntryAllQuerySchema }),
  teacherMarksEntryMatrix
);

router.post(
  "/teacher/exam/submit-marks",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("marks:create"),
  validate(submitMarksSchema),
  teacherSubmitMarks
);

router.post(
  "/teacher/exam/submit-marks-bulk",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("marks:create"),
  validate(submitMarksBulkSchema),
  teacherSubmitMarksBulk
);

router.get(
  "/admin/exam/:examId/result-status",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("result:read"),
  validate({ params: examIdParamSchema }),
  adminExamResultStatus
);

router.patch(
  "/admin/exam/publish-result/:examId",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("result:publish"),
  validate({ params: examIdParamSchema }),
  adminPublishResult
);

router.get(
  "/exam/result/me",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("result:read"),
  getExamResultMe
);

router.post(
  "/student/result/recheck",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("result:read"),
  validate(recheckSchema),
  studentResultRecheck
);

router.get(
  "/admin/complaints",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("result:read"),
  validate({ query: complaintQuerySchema }),
  adminListComplaints
);

export default router;
