import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { secureFileAccess } from "@/modules/files/controller";
import { secureFileQuerySchema } from "@/modules/files/validation";

const router = Router();

router.get(
  "/secure",
  authMiddleware,
  validate({ query: secureFileQuerySchema }),
  secureFileAccess
);

export default router;
