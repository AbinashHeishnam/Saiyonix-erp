import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { swaggerSpec } from "@/config/swagger";
import { corsMiddleware } from "@/config/cors";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";
import { apiLimiter } from "./middleware/rateLimiter.middleware";
import { allowRoles } from "./middleware/rbac.middleware";
import { requestIdMiddleware } from "./middleware/requestId.middleware";
import { restrictAfterTC } from "./middleware/restrictAfterTC.middleware";
import apiV1Router from "./routes/api.v1";
import { success } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";
import { Queue } from "bullmq";
import { getJobQueue } from "@/core/queue/queue";

const app = express();

app.use(requestIdMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(corsMiddleware);
app.use(cookieParser());
app.use(compression());
if (process.env.NODE_ENV === "production") {
  app.use(apiLimiter);
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      logger.info(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
    });
    next();
  });
}

app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (res.headersSent) {
      return;
    }
    res.status(503).json({
      success: false,
      message: "Request timeout",
    });
  });
  next();
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

export async function registerBullBoard(appInstance: express.Express) {
  const jobQueue = await getJobQueue();
  if (!(jobQueue instanceof Queue)) {
    return;
  }

  const bullBoardServer = new ExpressAdapter();
  bullBoardServer.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(jobQueue)],
    serverAdapter: bullBoardServer,
  });

  appInstance.use(
    "/admin/queues",
    authMiddleware,
    allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
    bullBoardServer.getRouter()
  );
}

app.use("/api/v1", restrictAfterTC);
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
