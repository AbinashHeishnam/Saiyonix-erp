import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { heavyJobLimiter } from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validate.middleware";
import { generate, generatePdfs, get, getPdf, unlock } from "@/modules/admitCards/controller";
import { admitCardQuerySchema, examIdParamSchema, unlockAdmitCardSchema } from "@/modules/admitCards/validation";
const admitCardsRouter = Router();
const allowAdmitCardRead = (req, res, next) => {
    const role = req.user?.roleType ??
        req.user?.role;
    if (role === "STUDENT" || role === "PARENT") {
        return next();
    }
    return requirePermission("admitCard:read")(req, res, next);
};
admitCardsRouter.post("/:examId/generate", authMiddleware, heavyJobLimiter, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("admitCard:generate"), validate({ params: examIdParamSchema }), generate);
admitCardsRouter.patch("/:examId/unlock", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("admitCard:unlock"), validate({ params: examIdParamSchema, body: unlockAdmitCardSchema }), unlock);
admitCardsRouter.get("/:examId", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "STUDENT", "PARENT"), allowAdmitCardRead, validate({ params: examIdParamSchema, query: admitCardQuerySchema }), get);
admitCardsRouter.get("/:examId/pdf", authMiddleware, heavyJobLimiter, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "STUDENT", "PARENT"), allowAdmitCardRead, validate({ params: examIdParamSchema, query: admitCardQuerySchema }), getPdf);
admitCardsRouter.post("/:examId/generate-pdfs", authMiddleware, heavyJobLimiter, allowRoles("SUPER_ADMIN", "ADMIN"), requirePermission("admitCard:generatePdf"), validate({ params: examIdParamSchema }), generatePdfs);
export default admitCardsRouter;
