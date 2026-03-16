import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createOrder, verify } from "./payment.controller";
import { createOrderSchema, verifyPaymentSchema } from "./validation";

const paymentRouter = Router();

paymentRouter.post(
  "/create-order",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN", "PARENT", "STUDENT"),
  validate(createOrderSchema),
  createOrder
);

paymentRouter.post(
  "/verify",
  authMiddleware,
  allowRoles("ADMIN", "FINANCE_SUB_ADMIN", "PARENT", "STUDENT"),
  validate(verifyPaymentSchema),
  verify
);

export default paymentRouter;
