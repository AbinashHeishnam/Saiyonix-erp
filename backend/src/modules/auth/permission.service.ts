import prisma from "../../core/db/prisma";

const ROLE_PERMISSION_CACHE_TTL_MS = 60_000;

type RolePermissionCacheEntry = {
  expiresAt: number;
  permissionKeys: string[];
  permissionSet: Set<string>;
};

const rolePermissionCache = new Map<string, RolePermissionCacheEntry>();

function getCachedPermissions(roleId: string): RolePermissionCacheEntry | null {
  const cached = rolePermissionCache.get(roleId);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    rolePermissionCache.delete(roleId);
    return null;
  }

  return cached;
}

function setCachedPermissions(roleId: string, permissionKeys: string[]) {
  const uniquePermissionKeys = Array.from(new Set(permissionKeys));

  rolePermissionCache.set(roleId, {
    expiresAt: Date.now() + ROLE_PERMISSION_CACHE_TTL_MS,
    permissionKeys: uniquePermissionKeys,
    permissionSet: new Set(uniquePermissionKeys),
  });
}

export function invalidateRolePermissionCache(roleId?: string) {
  if (roleId) {
    rolePermissionCache.delete(roleId);
    return;
  }

  rolePermissionCache.clear();
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const cached = getCachedPermissions(roleId);

  if (cached) {
    return cached.permissionKeys;
  }

  // Single query via RolePermission -> Permission relation.
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: {
      permission: {
        select: {
          permissionKey: true,
        },
      },
    },
  });

  const permissionKeys = rows.map((row) => row.permission.permissionKey);
  setCachedPermissions(roleId, permissionKeys);

  return getCachedPermissions(roleId)?.permissionKeys ?? permissionKeys;
}

export async function roleHasPermission(
  roleId: string,
  permissionKey: string
): Promise<boolean> {
  const cached = getCachedPermissions(roleId);

  if (cached) {
    return cached.permissionSet.has(permissionKey);
  }

  const permissionKeys = await getRolePermissions(roleId);
  return permissionKeys.includes(permissionKey);
}
