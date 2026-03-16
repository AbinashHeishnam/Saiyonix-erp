import "dotenv/config";

import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { UserRole } from "@prisma/client";

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "deploy", "school.config.json");
const ENV_PATH = path.join(ROOT_DIR, ".env");

type SetupConfig = {
  postgres: { host: string; port: number; adminUser: string; adminPassword: string };
  school: { name: string };
  database: { dbName: string; dbUser: string; dbPassword: string };
  admin: { email: string; password: string };
  academicSubAdmin: { email: string; password: string };
  financeSubAdmin: { email: string; password: string };
};

type PrismaClientLike = {
  [key: string]: any;
  $disconnect: () => Promise<void>;
};

const permissionKeys = [
  "academicYear:create",
  "academicYear:read",
  "academicYear:update",
  "academicYear:delete",
  "student:create",
  "student:read",
  "student:update",
  "student:delete",
  "student:bulk-import",
  "teacher:create",
  "teacher:read",
  "teacher:update",
  "teacher:delete",
  "teacher:bulk-import",
  "class:create",
  "class:read",
  "class:update",
  "class:delete",
  "section:create",
  "section:read",
  "section:update",
  "section:delete",
  "subject:create",
  "subject:read",
  "subject:update",
  "subject:delete",
  "period:create",
  "period:read",
  "period:update",
  "period:delete",
  "classSubject:create",
  "classSubject:read",
  "classSubject:update",
  "classSubject:delete",
  "teacherSubjectClass:create",
  "teacherSubjectClass:read",
  "teacherSubjectClass:update",
  "teacherSubjectClass:delete",
  "timetableSlot:create",
  "timetableSlot:read",
  "timetableSlot:update",
  "timetableSlot:delete",
  "attendance:mark",
  "attendance:update",
  "attendance:read",
  "exam:create",
  "exam:publish",
  "exam:read",
  "fee:create",
  "fee:collect",
  "fee:read",
  "notice:create",
  "notice:read",
  "notice:update",
  "notice:delete",
  "circular:create",
  "circular:read",
  "circular:update",
  "circular:delete",
  "notification:send",
] as const;

const permissionDescriptions: Partial<Record<(typeof permissionKeys)[number], string>> = {
  "attendance:mark": "Mark student attendance",
  "attendance:update": "Update student attendance",
  "notice:create": "Create notice",
  "notice:read": "Read notices",
  "notice:update": "Update notice",
  "notice:delete": "Delete notice",
  "circular:create": "Create circular",
  "circular:read": "Read circulars",
  "circular:update": "Update circular",
  "circular:delete": "Delete circular",
  "notification:send": "Send notifications",
};

function loadConfig(): SetupConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found at ${CONFIG_PATH}`);
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as SetupConfig;

  if (
    !config.postgres?.host ||
    !config.postgres?.port ||
    !config.postgres?.adminUser ||
    !config.postgres?.adminPassword
  ) {
    throw new Error(
      "postgres.host, postgres.port, postgres.adminUser, postgres.adminPassword are required"
    );
  }

  if (!config.school?.name) {
    throw new Error("school.name is required in deploy/school.config.json");
  }

  if (!config.database?.dbName || !config.database?.dbUser || !config.database?.dbPassword) {
    throw new Error("database.dbName, database.dbUser, database.dbPassword are required");
  }

  if (!config.admin?.email || !config.admin?.password) {
    throw new Error("admin.email and admin.password are required");
  }

  if (!config.academicSubAdmin?.email || !config.academicSubAdmin?.password) {
    throw new Error("academicSubAdmin.email and academicSubAdmin.password are required");
  }

  if (!config.financeSubAdmin?.email || !config.financeSubAdmin?.password) {
    throw new Error("financeSubAdmin.email and financeSubAdmin.password are required");
  }

  return config;
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function generateSchoolCode(name: string) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.slice(0, 6) || "SCH001";
}

function updateEnvFile(databaseUrl: string) {
  const line = `DATABASE_URL=${databaseUrl}`;

  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, `${line}\n`, "utf-8");
    return;
  }

  const contents = readFileSync(ENV_PATH, "utf-8");
  const lines = contents.split(/\r?\n/);
  let replaced = false;

  const next = lines.map((existing) => {
    if (existing.startsWith("DATABASE_URL=")) {
      replaced = true;
      return line;
    }
    return existing;
  });

  if (!replaced) {
    next.push(line);
  }

  writeFileSync(ENV_PATH, next.filter((value) => value.length > 0).join("\n") + "\n", "utf-8");
}

async function ensureDatabase(adminUrl: string, dbName: string, dbUser: string, dbPassword: string) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const userExists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [
    dbUser,
  ]);

  if (userExists.rowCount === 0) {
    await client.query(
      `CREATE USER ${quoteIdentifier(dbUser)} WITH PASSWORD ${quoteLiteral(dbPassword)}`
    );
  }

  const dbExists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    dbName,
  ]);

  if (dbExists.rowCount === 0) {
    await client.query(
      `CREATE DATABASE ${quoteIdentifier(dbName)} OWNER ${quoteIdentifier(dbUser)}`
    );
  }

  await client.end();
}

async function seedRolesAndPermissions(prisma: PrismaClientLike) {
  const roles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.ACADEMIC_SUB_ADMIN,
    UserRole.FINANCE_SUB_ADMIN,
    UserRole.TEACHER,
    UserRole.PARENT,
    UserRole.STUDENT,
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleType: role },
      update: {},
      create: { roleType: role },
    });
  }

  for (const permissionKey of permissionKeys) {
    const [module, action] = permissionKey.split(":");
    const description =
      permissionDescriptions[permissionKey] ?? `${module} ${action} permission`;

    await prisma.permission.upsert({
      where: { permissionKey },
      update: { module, description },
      create: { permissionKey, module, description },
    });
  }

  const rolesInDb = await prisma.role.findMany({
    where: {
      roleType: {
        in: [
          UserRole.ADMIN,
          UserRole.ACADEMIC_SUB_ADMIN,
          UserRole.FINANCE_SUB_ADMIN,
          UserRole.TEACHER,
          UserRole.PARENT,
          UserRole.STUDENT,
        ],
      },
    },
    select: { id: true, roleType: true },
  });

  const permissions = await prisma.permission.findMany({
    where: { permissionKey: { in: [...permissionKeys] } },
    select: { id: true, permissionKey: true },
  });

  const roleIdByType = new Map(rolesInDb.map((role) => [role.roleType, role.id]));
  const permissionIdByKey = new Map(
    permissions.map((permission) => [permission.permissionKey, permission.id])
  );

  const academicPermissions = permissionKeys.filter(
    (key) =>
      key.startsWith("academicYear:") ||
      key.startsWith("class:") ||
      key.startsWith("section:") ||
      key.startsWith("subject:") ||
      key.startsWith("period:") ||
      key.startsWith("classSubject:") ||
      key.startsWith("teacherSubjectClass:") ||
      key.startsWith("timetableSlot:") ||
      key.startsWith("student:") ||
      key.startsWith("teacher:") ||
      key.startsWith("attendance:") ||
      key.startsWith("exam:") ||
      key.startsWith("notice:") ||
      key.startsWith("circular:") ||
      key.startsWith("notification:")
  );

  const financePermissions = permissionKeys.filter((key) => key.startsWith("fee:"));

  const rolePermissionMap: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: [...permissionKeys],
    [UserRole.ADMIN]: [...permissionKeys],
    [UserRole.ACADEMIC_SUB_ADMIN]: [...academicPermissions],
    [UserRole.FINANCE_SUB_ADMIN]: [...financePermissions],
    [UserRole.TEACHER]: [
      "teacher:read",
      "attendance:mark",
      "attendance:update",
      "attendance:read",
      "student:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read",
    ],
    [UserRole.PARENT]: ["student:read", "timetableSlot:read", "notice:read", "circular:read"],
    [UserRole.STUDENT]: ["student:read", "timetableSlot:read", "notice:read", "circular:read"],
  };

  const targetRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.ACADEMIC_SUB_ADMIN,
    UserRole.FINANCE_SUB_ADMIN,
    UserRole.TEACHER,
    UserRole.PARENT,
    UserRole.STUDENT,
  ];

  for (const roleType of targetRoles) {
    const roleId = roleIdByType.get(roleType);

    if (!roleId) {
      continue;
    }

    for (const permissionKey of rolePermissionMap[roleType]) {
      const permissionId = permissionIdByKey.get(permissionKey);

      if (!permissionId) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }
}

async function createSchoolAndAdmins(prisma: PrismaClientLike, config: SetupConfig) {
  const schoolCode = generateSchoolCode(config.school.name);

  const school = await prisma.school.upsert({
    where: { code: schoolCode },
    update: { name: config.school.name },
    create: {
      code: schoolCode,
      name: config.school.name,
      timezone: "Asia/Kolkata",
    },
  });

  const roles = await prisma.role.findMany({
    where: {
      roleType: {
        in: [
          UserRole.ADMIN,
          UserRole.ACADEMIC_SUB_ADMIN,
          UserRole.FINANCE_SUB_ADMIN,
        ],
      },
    },
    select: { id: true, roleType: true },
  });

  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]));

  const adminRoleId = roleIdByType.get(UserRole.ADMIN);
  const academicRoleId = roleIdByType.get(UserRole.ACADEMIC_SUB_ADMIN);
  const financeRoleId = roleIdByType.get(UserRole.FINANCE_SUB_ADMIN);

  if (!adminRoleId || !academicRoleId || !financeRoleId) {
    throw new Error("Required roles are missing after seeding.");
  }

  const adminHash = await bcrypt.hash(config.admin.password, 10);
  const academicHash = await bcrypt.hash(config.academicSubAdmin.password, 10);
  const financeHash = await bcrypt.hash(config.financeSubAdmin.password, 10);

  await prisma.user.upsert({
    where: { email: config.admin.email },
    update: {
      passwordHash: adminHash,
      roleId: adminRoleId,
      schoolId: school.id,
      isActive: true,
    },
    create: {
      email: config.admin.email,
      passwordHash: adminHash,
      roleId: adminRoleId,
      schoolId: school.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: config.academicSubAdmin.email },
    update: {
      passwordHash: academicHash,
      roleId: academicRoleId,
      schoolId: school.id,
      isActive: true,
    },
    create: {
      email: config.academicSubAdmin.email,
      passwordHash: academicHash,
      roleId: academicRoleId,
      schoolId: school.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: config.financeSubAdmin.email },
    update: {
      passwordHash: financeHash,
      roleId: financeRoleId,
      schoolId: school.id,
      isActive: true,
    },
    create: {
      email: config.financeSubAdmin.email,
      passwordHash: financeHash,
      roleId: financeRoleId,
      schoolId: school.id,
      isActive: true,
    },
  });
}

async function main() {
  const config = loadConfig();
  const adminUrl = `postgresql://${encodeURIComponent(
    config.postgres.adminUser
  )}:${encodeURIComponent(config.postgres.adminPassword)}@${config.postgres.host}:${
    config.postgres.port
  }/postgres`;

  await ensureDatabase(
    adminUrl,
    config.database.dbName,
    config.database.dbUser,
    config.database.dbPassword
  );

  const databaseUrl = `postgresql://${encodeURIComponent(
    config.database.dbUser
  )}:${encodeURIComponent(config.database.dbPassword)}@${config.postgres.host}:${
    config.postgres.port
  }/${config.database.dbName}`;

  updateEnvFile(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;

  execSync("npx prisma migrate deploy", {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  dotenv.config({ path: ENV_PATH, override: true });
  const { default: prisma } = await import("../src/core/db/prisma");

  try {
    await seedRolesAndPermissions(prisma);
    await createSchoolAndAdmins(prisma, config);
  } finally {
    await prisma.$disconnect();
  }

  console.log("✅ Setup completed successfully");
}

main().catch((error) => {
  console.error("❌ Setup failed:", error);
  process.exit(1);
});
