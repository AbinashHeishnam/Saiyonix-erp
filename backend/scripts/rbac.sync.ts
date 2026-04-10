import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function listRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith("routes.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractPermissionKeys(files: string[]): string[] {
  const keys = new Set<string>();
  const pattern = /requirePermission\("([^"]+)"\)/g;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content))) {
      if (match[1]) {
        keys.add(match[1]);
      }
    }
  }
  return Array.from(keys).sort();
}

function byPrefix(keys: string[], prefix: string) {
  return keys.filter((key) => key.startsWith(`${prefix}:`));
}

function pick(keys: string[], wanted: string[]) {
  const set = new Set(keys);
  return wanted.filter((key) => set.has(key));
}

async function ensurePermissions(keys: string[]) {
  for (const key of keys) {
    const [module, action] = key.split(":");
    await prisma.permission.upsert({
      where: { permissionKey: key },
      update: { module, description: `${module} ${action} permission` },
      create: { permissionKey: key, module, description: `${module} ${action} permission` },
    });
  }
}

async function ensureRolePermissions(roleId: string, keys: string[]) {
  if (keys.length === 0) return;
  const permissions = await prisma.permission.findMany({
    where: { permissionKey: { in: keys } },
    select: { id: true, permissionKey: true },
  });
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      update: {},
      create: { roleId, permissionId: permission.id },
    });
  }
}

async function main() {
  const routesDir = path.join(process.cwd(), "src", "modules");
  const routeFiles = listRouteFiles(routesDir);
  const permissionKeys = extractPermissionKeys(routeFiles);

  if (permissionKeys.length === 0) {
    console.error("No permissions found in routes.", {
      routesDir,
      routeFiles: routeFiles.length,
      sample: routeFiles.slice(0, 3),
    });
    throw new Error("No permissions found in routes.");
  }

  await ensurePermissions(permissionKeys);

  const roles = await prisma.role.findMany({
    where: {
      roleType: {
        in: [
          "SUPER_ADMIN",
          "ADMIN",
          "ACADEMIC_SUB_ADMIN",
          "FINANCE_SUB_ADMIN",
          "TEACHER",
          "STUDENT",
          "PARENT",
        ],
      },
    },
    select: { id: true, roleType: true },
  });

  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]));
  const superAdminRoleId = roleIdByType.get("SUPER_ADMIN");
  const adminRoleId = roleIdByType.get("ADMIN");
  const academicRoleId = roleIdByType.get("ACADEMIC_SUB_ADMIN");
  const financeRoleId = roleIdByType.get("FINANCE_SUB_ADMIN");
  const teacherRoleId = roleIdByType.get("TEACHER");
  const studentRoleId = roleIdByType.get("STUDENT");
  const parentRoleId = roleIdByType.get("PARENT");

  if (!adminRoleId || !academicRoleId || !financeRoleId) {
    throw new Error("Required admin roles are missing in DB.");
  }

  const adminPermissions = permissionKeys;
  const academicPermissions = permissionKeys;
  const financePermissions = permissionKeys;
  const teacherPermissions = permissionKeys;
  const studentPermissions = permissionKeys;
  const parentPermissions = permissionKeys;

  if (superAdminRoleId) {
    await ensureRolePermissions(superAdminRoleId, adminPermissions);
  }
  await ensureRolePermissions(adminRoleId, adminPermissions);
  await ensureRolePermissions(academicRoleId, academicPermissions);
  await ensureRolePermissions(financeRoleId, financePermissions);
  if (teacherRoleId) {
    await ensureRolePermissions(teacherRoleId, teacherPermissions);
  }
  if (studentRoleId) {
    await ensureRolePermissions(studentRoleId, studentPermissions);
  }
  if (parentRoleId) {
    await ensureRolePermissions(parentRoleId, parentPermissions);
  }

  console.log(
    JSON.stringify(
      {
        permissionCount: permissionKeys.length,
        adminPermissions: adminPermissions.length,
        academicPermissions: academicPermissions.length,
        financePermissions: financePermissions.length,
        teacherPermissions: teacherPermissions.length,
        studentPermissions: studentPermissions.length,
        parentPermissions: parentPermissions.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
