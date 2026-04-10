import "dotenv/config";

import bcrypt from "bcrypt";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { UserRole } from "@prisma/client";
import {
  permissionKeys,
  permissionDescriptions,
} from "../src/modules/auth/permissions";

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "deploy", "school.config.json");

type SetupConfig = {
  school: { name: string };
  admin: { email: string };
  academicSubAdmin: { email: string };
  financeSubAdmin: { email: string };
};

type SetupEnv = {
  postgresHost: string;
  postgresPort: number;
  postgresAdminUser: string;
  postgresAdminPassword: string;
  appDbName: string;
  appDbUser: string;
  appDbPassword: string;
  bootstrapAdminPassword: string;
  bootstrapAcademicPassword: string;
  bootstrapFinancePassword: string;
};

type PrismaClientLike = {
  [key: string]: any;
  $disconnect: () => Promise<void>;
};

function loadConfig(): SetupConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found at ${CONFIG_PATH}`);
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as SetupConfig;

  if (!config.school?.name) {
    throw new Error("school.name is required in deploy/school.config.json");
  }

  if (!config.admin?.email) {
    throw new Error("admin.email is required");
  }

  if (!config.academicSubAdmin?.email) {
    throw new Error("academicSubAdmin.email is required");
  }

  if (!config.financeSubAdmin?.email) {
    throw new Error("financeSubAdmin.email is required");
  }

  return config;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function loadEnv(): SetupEnv {
  const postgresHost = requireEnv("POSTGRES_HOST");
  const postgresPortRaw = requireEnv("POSTGRES_PORT");
  const postgresPort = Number(postgresPortRaw);

  if (!Number.isFinite(postgresPort) || postgresPort <= 0) {
    throw new Error("POSTGRES_PORT must be a valid number");
  }

  return {
    postgresHost,
    postgresPort,
    postgresAdminUser: requireEnv("POSTGRES_ADMIN_USER"),
    postgresAdminPassword: requireEnv("POSTGRES_ADMIN_PASSWORD"),
    appDbName: requireEnv("APP_DB_NAME"),
    appDbUser: requireEnv("APP_DB_USER"),
    appDbPassword: requireEnv("APP_DB_PASSWORD"),
    bootstrapAdminPassword: requireEnv("BOOTSTRAP_ADMIN_PASSWORD"),
    bootstrapAcademicPassword: requireEnv("BOOTSTRAP_ACADEMIC_PASSWORD"),
    bootstrapFinancePassword: requireEnv("BOOTSTRAP_FINANCE_PASSWORD"),
  };
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

  const roleIdByType = new Map(rolesInDb.map((role: { id: string; roleType: UserRole }) => [role.roleType, role.id]));
  const permissionIdByKey = new Map(
    permissions.map((permission: { id: string; permissionKey: string }) => [permission.permissionKey, permission.id])
  );

  const academicPermissions = [...permissionKeys];

  const financePermissions = [...permissionKeys];

  const rolePermissionMap: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: [...permissionKeys],
    [UserRole.ADMIN]: [...permissionKeys],
    [UserRole.ACADEMIC_SUB_ADMIN]: [...academicPermissions],
    [UserRole.FINANCE_SUB_ADMIN]: [...financePermissions],
    [UserRole.TEACHER]: [...permissionKeys],
    [UserRole.PARENT]: [...permissionKeys],
    [UserRole.STUDENT]: [...permissionKeys],
  };

  const targetRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
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

async function createSchoolAndAdmins(
  prisma: PrismaClientLike,
  config: SetupConfig,
  env: SetupEnv
) {
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

  const roleIdByType = new Map(roles.map((role: { id: string; roleType: UserRole }) => [role.roleType, role.id]));

  const adminRoleId = roleIdByType.get(UserRole.ADMIN);
  const academicRoleId = roleIdByType.get(UserRole.ACADEMIC_SUB_ADMIN);
  const financeRoleId = roleIdByType.get(UserRole.FINANCE_SUB_ADMIN);

  if (!adminRoleId || !academicRoleId || !financeRoleId) {
    throw new Error("Required roles are missing after seeding.");
  }

  const adminHash = await bcrypt.hash(env.bootstrapAdminPassword, 10);
  const academicHash = await bcrypt.hash(env.bootstrapAcademicPassword, 10);
  const financeHash = await bcrypt.hash(env.bootstrapFinancePassword, 10);

  await prisma.user.upsert({
    where: { email: config.admin.email },
    update: {
      passwordHash: adminHash,
      roleId: adminRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: config.admin.email,
      passwordHash: adminHash,
      roleId: adminRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.user.upsert({
    where: { email: config.academicSubAdmin.email },
    update: {
      passwordHash: academicHash,
      roleId: academicRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: config.academicSubAdmin.email,
      passwordHash: academicHash,
      roleId: academicRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.user.upsert({
    where: { email: config.financeSubAdmin.email },
    update: {
      passwordHash: financeHash,
      roleId: financeRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: config.financeSubAdmin.email,
      passwordHash: financeHash,
      roleId: financeRoleId,
      schoolId: school.id,
      isActive: true,
      mustChangePassword: true,
    },
  });
}

async function main() {
  const config = loadConfig();
  const env = loadEnv();
  const adminUrl = `postgresql://${encodeURIComponent(
    env.postgresAdminUser
  )}:${encodeURIComponent(env.postgresAdminPassword)}@${env.postgresHost}:${env.postgresPort
    }/postgres`;

  await ensureDatabase(adminUrl, env.appDbName, env.appDbUser, env.appDbPassword);

  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${encodeURIComponent(env.appDbUser)}:${encodeURIComponent(
      env.appDbPassword
    )}@${env.postgresHost}:${env.postgresPort}/${env.appDbName}`;

  process.env.DATABASE_URL = databaseUrl;

  execSync("npx prisma migrate deploy", {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const { default: prisma } = await import("../src/core/db/prisma");

  try {
    await seedRolesAndPermissions(prisma);
    await createSchoolAndAdmins(prisma, config, env);
  } finally {
    await prisma.$disconnect();
  }

  console.log("✅ Setup completed successfully");
}

main().catch((error) => {
  console.error("❌ Setup failed:", error);
  process.exit(1);
});
