import type { Response } from "express";

export function success(
  res: Response,
  data?: unknown,
  message = "OK",
  status = 200,
  pagination?: Record<string, unknown>
) {
  return res.status(status).json({
    success: true,
    data,
    message,
    pagination,
  });
}

export function error(
  res: Response,
  message: string,
  status = 500,
  data?: unknown,
  pagination?: Record<string, unknown>
) {
  return res.status(status).json({
    success: false,
    data,
    message,
    pagination,
  });
}
