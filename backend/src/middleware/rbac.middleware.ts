import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { error as errorResponse } from "../utils/apiResponse";

export function allowRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const userRole = req.user.roleType;

    if (!allowedRoles.includes(userRole)) {
      return errorResponse(res, "Forbidden: insufficient permissions", 403);
    }

    next();
  };
}
