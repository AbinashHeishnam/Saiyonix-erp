import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { error as errorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return errorResponse(res, err.message, err.status, err.details);
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";

  logger.error(`[API] ${message}`);

  if (env.NODE_ENV === "development") {
    return errorResponse(res, message, 500);
  }

  return errorResponse(res, "Internal Server Error", 500);
}
