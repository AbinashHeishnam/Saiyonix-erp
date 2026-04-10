import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  createStructure,
  listStructures,
  publishStructure,
  createScholarshipRecord,
  listScholarshipRecords,
  updateScholarshipRecord,
  deleteScholarshipRecord,
  createDiscountRecord,
  listDiscountRecords,
  updateDiscountRecord,
  deleteDiscountRecord,
  createFeeDeadlineRecord,
  listFeeDeadlineRecords,
  listLateFeeRecords,
  getStudentFee,
  pay,
  listReceipts,
  getReceipt,
} from "@/modules/fee/fee.controller";
import {
  createFeeStructureSchema,
  listFeeStructuresSchema,
  payFeeSchema,
  publishFeeSchema,
  scholarshipSchema,
  scholarshipIdParamSchema,
  discountSchema,
  discountIdParamSchema,
  feeDeadlineSchema,
  feeRecordsQuerySchema,
  studentFeeParamsSchema,
  feeReceiptsQuerySchema,
  feeReceiptParamsSchema,
} from "@/modules/fee/fee.validation";

const feeRouter = Router();

feeRouter.post(
  "/structure",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: createFeeStructureSchema }),
  createStructure
);

feeRouter.get(
  "/structure",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ query: listFeeStructuresSchema }),
  listStructures
);

feeRouter.post(
  "/scholarships",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: scholarshipSchema }),
  createScholarshipRecord
);

feeRouter.get(
  "/scholarships",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  listScholarshipRecords
);

feeRouter.patch(
  "/scholarships/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ params: scholarshipIdParamSchema, body: scholarshipSchema }),
  updateScholarshipRecord
);

feeRouter.delete(
  "/scholarships/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ params: scholarshipIdParamSchema }),
  deleteScholarshipRecord
);

feeRouter.post(
  "/discounts",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: discountSchema }),
  createDiscountRecord
);

feeRouter.get(
  "/discounts",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  listDiscountRecords
);

feeRouter.patch(
  "/discounts/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ params: discountIdParamSchema, body: discountSchema }),
  updateDiscountRecord
);

feeRouter.delete(
  "/discounts/:id",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ params: discountIdParamSchema }),
  deleteDiscountRecord
);

feeRouter.post(
  "/fee-deadlines",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: feeDeadlineSchema }),
  createFeeDeadlineRecord
);

feeRouter.get(
  "/fee-deadlines",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  listFeeDeadlineRecords
);

feeRouter.get(
  "/late-records",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ query: feeRecordsQuerySchema }),
  listLateFeeRecords
);

feeRouter.post(
  "/publish",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  requirePermission("fee:structure"),
  validate({ body: publishFeeSchema }),
  publishStructure
);

feeRouter.post(
  "/pay",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("fee:pay"),
  validate({ body: payFeeSchema }),
  pay
);

feeRouter.get(
  "/student/:id",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("fee:read"),
  validate({ params: studentFeeParamsSchema }),
  getStudentFee
);

feeRouter.get(
  "/receipts",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("fee:read"),
  validate({ query: feeReceiptsQuerySchema }),
  listReceipts
);

feeRouter.get(
  "/receipts/:paymentId",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("fee:read"),
  validate({ params: feeReceiptParamsSchema, query: feeReceiptsQuerySchema }),
  getReceipt
);

export default feeRouter;
