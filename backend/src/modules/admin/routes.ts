import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { uploadSingle } from "@/middleware/upload.middleware";
import {
  getAdminStudentDetails,
  getAdminTeacherDetails,
  uploadAdminTeacherPhoto,
  assignSectionRollNumbers,
  assignClassRollNumbers,
} from "@/modules/admin/controller";
import {
  listAdminStudentIdCards,
  updateAdminStudentIdCardName,
  updateAdminStudentIdCardPhoto,
  updateAdminStudentIdCardDetails,
} from "@/modules/student/controller";
import {
  listAdminTeacherIdCards,
  updateAdminTeacherIdCardDetails,
  updateAdminTeacherIdCardPhoto,
} from "@/modules/teacher/controller";
import { listAppConfigs, upsertAppConfig } from "@/modules/admin/config.controller";
import {
  listStudentLeavesAdmin,
  listTeacherLeavesAdmin,
  updateStudentLeaveAdmin,
  updateTeacherLeaveAdmin,
} from "@/modules/admin/leave.controller";
import {
  createManualPaymentRecord,
  downloadAdminReceipt,
  listLogs as listPaymentLogs,
} from "@/modules/payment/payment.controller";
import { getAdminFeeOverview } from "@/modules/fee/fee.controller";
import {
  studentIdParamSchema,
  studentIdCardUpdateSchema,
  studentIdCardDetailsSchema,
} from "@/modules/student/validation";
import { teacherIdParamSchema, teacherIdCardDetailsSchema } from "@/modules/teacher/validation";
import { sectionIdParamSchema } from "@/modules/section/validation";
import { classIdParamSchema } from "@/modules/class/validation";
import {
  adminUpdateStudentLeaveSchema,
  listStudentLeaveQuerySchema,
  studentLeaveIdParamSchema,
} from "@/modules/studentLeave/validation";
import {
  adminUpdateTeacherLeaveSchema,
  listTeacherLeaveQuerySchema,
  teacherLeaveIdParamSchema,
} from "@/modules/teacherLeave/validation";
import {
  manualPaymentSchema,
  paymentIdParamSchema,
  paymentLogsQuerySchema,
} from "@/modules/payment/validation";
import { upsertAppConfigSchema } from "@/modules/admin/config.validation";

const adminRouter = Router();

adminRouter.get(
  "/students/id-cards",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("student:read"),
  listAdminStudentIdCards
);

adminRouter.get(
  "/teachers/id-cards",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("teacher:read"),
  listAdminTeacherIdCards
);

adminRouter.patch(
  "/teachers/:id/id-card/details",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherIdParamSchema, body: teacherIdCardDetailsSchema }),
  updateAdminTeacherIdCardDetails
);

adminRouter.post(
  "/teachers/:id/id-card/photo",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherIdParamSchema }),
  ...uploadSingle({ module: "profile-photo", userType: "teacher", userIdParam: "id", fieldName: "photo" }),
  updateAdminTeacherIdCardPhoto
);

adminRouter.patch(
  "/students/:id/id-card",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("student:update"),
  validate({ params: studentIdParamSchema, body: studentIdCardUpdateSchema }),
  updateAdminStudentIdCardName
);

adminRouter.post(
  "/students/:id/id-card/photo",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("student:update"),
  validate({ params: studentIdParamSchema }),
  ...uploadSingle({ module: "profile-photo", userType: "student", userIdParam: "id", fieldName: "photo" }),
  updateAdminStudentIdCardPhoto
);

adminRouter.patch(
  "/students/:id/id-card/details",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("student:update"),
  validate({ params: studentIdParamSchema, body: studentIdCardDetailsSchema }),
  updateAdminStudentIdCardDetails
);

adminRouter.get(
  "/teacher/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:read"),
  validate({ params: teacherIdParamSchema }),
  getAdminTeacherDetails
);

adminRouter.post(
  "/teacher/:id/photo",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherIdParamSchema }),
  ...uploadSingle({ module: "profile-photo", userType: "teacher", userIdParam: "id", fieldName: "photo" }),
  uploadAdminTeacherPhoto
);

adminRouter.get(
  "/student/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:read"),
  validate({ params: studentIdParamSchema }),
  getAdminStudentDetails
);

adminRouter.post(
  "/sections/:id/assign-rolls",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:update"),
  validate({ params: sectionIdParamSchema }),
  assignSectionRollNumbers
);

adminRouter.post(
  "/classes/:id/assign-rolls",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:update"),
  validate({ params: classIdParamSchema }),
  assignClassRollNumbers
);

adminRouter.get(
  "/student-leaves",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("studentLeave:read"),
  validate({ query: listStudentLeaveQuerySchema }),
  listStudentLeavesAdmin
);

adminRouter.get(
  "/teacher-leaves",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:read"),
  validate({ query: listTeacherLeaveQuerySchema }),
  listTeacherLeavesAdmin
);

adminRouter.patch(
  "/student-leave/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("studentLeave:update"),
  validate({ params: studentLeaveIdParamSchema, body: adminUpdateStudentLeaveSchema }),
  updateStudentLeaveAdmin
);

adminRouter.patch(
  "/teacher-leave/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:update"),
  validate({ params: teacherLeaveIdParamSchema, body: adminUpdateTeacherLeaveSchema }),
  updateTeacherLeaveAdmin
);

adminRouter.get(
  "/fees/overview",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("fee:read"),
  getAdminFeeOverview
);

adminRouter.get(
  "/payments/logs",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("fee:read"),
  validate({ query: paymentLogsQuerySchema }),
  listPaymentLogs
);

adminRouter.get(
  "/payments/:paymentId/receipt",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("fee:read"),
  validate({ params: paymentIdParamSchema }),
  downloadAdminReceipt
);

adminRouter.post(
  "/payments/manual",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: manualPaymentSchema }),
  createManualPaymentRecord
);

adminRouter.get(
  "/config",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("settings:read"),
  listAppConfigs
);

adminRouter.post(
  "/config",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("settings:update"),
  validate({ body: upsertAppConfigSchema }),
  upsertAppConfig
);

export default adminRouter;
