import { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../utils/jwt";
import { verifyToken } from "../utils/jwt";
import { error as errorResponse } from "../utils/apiResponse";

export interface AuthRequest extends Request {
  user?: JwtPayload;
  schoolId?: string;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token missing", 401);
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    req.schoolId = payload.schoolId;
    next();
  } catch (error) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
}
