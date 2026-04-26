import { roleHasPermission } from "@/modules/auth/permission.service";
import { error as errorResponse } from "@/utils/apiResponse";
export function requirePermission(permissionKey) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return errorResponse(res, "Unauthorized", 401);
            }
            const roleId = typeof req.user.roleId === "string" ? req.user.roleId : undefined;
            if (!roleId) {
                return errorResponse(res, "Unauthorized: role not found in token", 401);
            }
            const isAllowed = await roleHasPermission(roleId, permissionKey);
            if (!isAllowed) {
                return errorResponse(res, "Forbidden: missing required permission", 403, { requiredPermission: permissionKey });
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    };
}
