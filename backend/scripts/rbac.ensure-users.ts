import "dotenv/config";

import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
  if (!school) {
    throw new Error("No school found");
  }

  const roles = await prisma.role.findMany({
    where: { roleType: { in: ["ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"] } },
    select: { id: true, roleType: true },
  });

  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]));
  const academicRoleId = roleIdByType.get("ACADEMIC_SUB_ADMIN");
  const financeRoleId = roleIdByType.get("FINANCE_SUB_ADMIN");

  if (!academicRoleId || !financeRoleId) {
    throw new Error("Required sub-admin roles are missing in DB.");
  }

  const academicEmail = "phase3.academic@csc.edu";
  const financeEmail = "phase3.finance@csc.edu";

  await prisma.user.upsert({
    where: { email: academicEmail },
    update: {},
    create: {
      schoolId: school.id,
      roleId: academicRoleId,
      email: academicEmail,
      passwordHash: await bcrypt.hash("Academic@123", 10),
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: financeEmail },
    update: {},
    create: {
      schoolId: school.id,
      roleId: financeRoleId,
      email: financeEmail,
      passwordHash: await bcrypt.hash("Finance@123", 10),
      isActive: true,
    },
  });

  console.log(JSON.stringify({
    academicEmail,
    academicPassword: "Academic@123",
    financeEmail,
    financePassword: "Finance@123",
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
