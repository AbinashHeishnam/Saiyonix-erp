import { error as errorResponse } from "@/utils/apiResponse";
export function allowRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, "Unauthorized", 401);
        }
        const userRole = req.user.roleType ?? req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return errorResponse(res, "Forbidden: insufficient permissions", 403);
        }
        next();
    };
}
