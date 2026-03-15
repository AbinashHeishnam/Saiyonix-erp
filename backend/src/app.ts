import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./config/swagger";
import { corsMiddleware } from "./config/cors";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";
import { apiLimiter } from "./middleware/rateLimiter.middleware";
import { allowRoles } from "./middleware/rbac.middleware";
import { requestIdMiddleware } from "./middleware/requestId.middleware";
import apiV1Router from "./routes/api.v1";
import { success } from "./utils/apiResponse";

const app = express();

app.use(requestIdMiddleware);
app.use(helmet());
app.use(corsMiddleware);
app.use(morgan("dev"));
app.use(apiLimiter);
app.use(express.json());

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/v1", apiV1Router);

app.get("/", (_req, res) => {
  return success(res, null, "SaiyoniX ERP API running - dev mode");
});

app.get("/protected", authMiddleware, (_req, res) => {
  return success(res, null, "Protected route accessed");
});

app.get("/admin-only", authMiddleware, allowRoles("SUPER_ADMIN"), (_req, res) => {
  return success(res, null, "Welcome SUPER ADMIN");
});

app.use(errorHandler);

export default app;
