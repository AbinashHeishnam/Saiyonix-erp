import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createOrder, list, verify, getRazorpayKey } from "@/modules/payment/payment.controller";
import { createOrderSchema, verifyPaymentSchema } from "@/modules/payment/validation";

const paymentRouter = Router();

paymentRouter.post(
  "/create-order",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN", "PARENT", "STUDENT"),
  validate(createOrderSchema),
  createOrder
);

paymentRouter.get(
  "/razorpay-key",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN", "PARENT", "STUDENT"),
  getRazorpayKey
);

paymentRouter.get(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN"),
  list
);

paymentRouter.post(
  "/verify",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN", "PARENT", "STUDENT"),
  validate(verifyPaymentSchema),
  verify
);

export default paymentRouter;
