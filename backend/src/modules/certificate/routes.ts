import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  createCertificateRequest,
  listCertificateRequestsForAdmin,
  listCertificateRequests,
  approveCertificate,
  rejectCertificate,
  generateTc,
} from "@/modules/certificate/controller";
import {
  adminApproveCertificateSchema,
  adminGenerateTcSchema,
  adminRejectCertificateSchema,
  createCertificateRequestSchema,
} from "@/modules/certificate/validation";

const certificateRouter = Router();

certificateRouter.post(
  "/request",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("certificate:request"),
  validate(createCertificateRequestSchema),
  createCertificateRequest
);

certificateRouter.get(
  "/requests",
  authMiddleware,
  allowRoles("STUDENT", "PARENT", "ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("certificate:read"),
  listCertificateRequests
);

const adminCertificateRouter = Router();

adminCertificateRouter.get(
  "/certificate/requests",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("certificate:read"),
  listCertificateRequestsForAdmin
);

adminCertificateRouter.post(
  "/certificate/approve",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("certificate:approve"),
  validate(adminApproveCertificateSchema),
  approveCertificate
);

adminCertificateRouter.post(
  "/certificate/reject",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("certificate:reject"),
  validate(adminRejectCertificateSchema),
  rejectCertificate
);

adminCertificateRouter.post(
  "/tc/generate",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("tc:generate"),
  validate(adminGenerateTcSchema),
  generateTc
);

export { certificateRouter, adminCertificateRouter };
