export function canAccessResource({
  userId,
  userRole,
  resourceOwnerId,
  allowedRoles = [],
}: {
  userId?: string;
  userRole?: string;
  resourceOwnerId?: string | null;
  allowedRoles?: string[];
}) {
  if (allowedRoles.includes(userRole || "")) return true;
  if (resourceOwnerId && userId === resourceOwnerId) return true;
  return false;
}
