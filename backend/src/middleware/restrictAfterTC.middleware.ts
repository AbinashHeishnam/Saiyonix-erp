import { NextFunction, Response } from "express";

import prisma from "@/core/db/prisma";
import { verifyToken } from "@/utils/jwt";
import type { AuthRequest } from "@/middleware/auth.middleware";
import { extractTokenFromRequest } from "@/middleware/auth.middleware";
import { getStudentTcRestriction } from "@/modules/auth/tcGuard";

export async function restrictAfterTC(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.path.startsWith("/auth")) {
    return next();
  }

  if (req.isRestricted) {
    return enforceRouteRestriction(req, res, next);
  }

  const token = extractTokenFromRequest(req);
  if (!token || token.split(".").length !== 3) {
    return next();
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next();
  }

  req.user = req.user ?? payload;
  req.schoolId = req.schoolId ?? payload.schoolId;

  let isRestricted = false;

  if (payload.roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: payload.sub, schoolId: payload.schoolId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (student?.status === "EXPELLED") {
      const tcStatus = await getStudentTcRestriction(student.id);
      if (tcStatus.isExpired) {
        return res.status(403).json({ message: "Account expired after TC" });
      }
      if (tcStatus.isRestricted) {
        isRestricted = true;
        req.student = student;
      }
    }
  }

  if (payload.roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { userId: payload.sub, schoolId: payload.schoolId },
      select: {
        id: true,
        studentLinks: {
          where: { student: { schoolId: payload.schoolId, deletedAt: null } },
          select: {
            student: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (parent?.studentLinks?.length) {
      let hasActiveStudent = false;
      let hasRestrictedStudent = false;
      let hasExpiredStudent = false;

      for (const link of parent.studentLinks) {
        const student = link.student;
        if (!student) continue;
        if (student.status === "ACTIVE") {
          hasActiveStudent = true;
          continue;
        }
        if (student.status === "EXPELLED") {
          const tcStatus = await getStudentTcRestriction(student.id);
          if (tcStatus.isExpired) {
            hasExpiredStudent = true;
          } else if (tcStatus.isRestricted) {
            hasRestrictedStudent = true;
          }
        }
      }

      if (!hasActiveStudent) {
        if (hasRestrictedStudent) {
          isRestricted = true;
        } else if (hasExpiredStudent) {
          return res.status(403).json({ message: "Parent access expired" });
        }
      }
    }
  }

  if (!isRestricted) {
    return next();
  }

  req.isRestricted = true;
  return enforceRouteRestriction(req, res, next);
}

function enforceRouteRestriction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.isRestricted) return next();

  const allowedRoutes = [
    "/certificate",
    "/certificate/request",
    "/certificate/download",
  ];

  const allowed = allowedRoutes.some((route) => req.path.startsWith(route));

  if (!allowed) {
    return res.status(403).json({
      message: "Only certificate access allowed after TC",
    });
  }

  return next();
}
