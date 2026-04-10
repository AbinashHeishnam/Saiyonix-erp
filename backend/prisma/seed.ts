import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, UserRole } from "@prisma/client"
import {
  permissionKeys,
  permissionDescriptions,
} from "../src/modules/auth/permissions"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run Prisma seed")
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function seedRoles() {
  const roles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACADEMIC_SUB_ADMIN,
    UserRole.FINANCE_SUB_ADMIN,
    UserRole.TEACHER,
    UserRole.PARENT,
    UserRole.STUDENT
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleType: role },
      update: {},
      create: { roleType: role }
    })
  }

  console.log("✅ Roles seeded")
}

async function seedPermissions() {
  for (const permissionKey of permissionKeys) {
    const [module, action] = permissionKey.split(":")
    const description =
      permissionDescriptions[permissionKey] ?? `${module} ${action} permission`

    await prisma.permission.upsert({
      where: { permissionKey },
      update: {
        module,
        description
      },
      create: {
        permissionKey,
        module,
        description
      }
    })
  }

  console.log("✅ Permissions seeded")
}

async function seedRolePermissions() {
  const roles = await prisma.role.findMany({
    where: {
      roleType: {
        in: [
          UserRole.ADMIN,
          UserRole.ACADEMIC_SUB_ADMIN,
          UserRole.FINANCE_SUB_ADMIN,
          UserRole.TEACHER,
          UserRole.PARENT,
          UserRole.STUDENT
        ]
      }
    },
    select: {
      id: true,
      roleType: true
    }
  })

  const permissions = await prisma.permission.findMany({
    where: {
      permissionKey: {
        in: [...permissionKeys]
      }
    },
    select: {
      id: true,
      permissionKey: true
    }
  })

  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]))
  const permissionIdByKey = new Map(
    permissions.map((permission) => [permission.permissionKey, permission.id])
  )

  const academicPermissions = permissionKeys.filter(
    (key) =>
      key.startsWith("academicYear:") ||
      key.startsWith("admitCard:") ||
      key.startsWith("assignment:") ||
      key.startsWith("note:") ||
      key.startsWith("syllabus:") ||
      key.startsWith("marks:") ||
      key.startsWith("result:") ||
      key.startsWith("reportCard:") ||
      key.startsWith("ranking:") ||
      key.startsWith("class:") ||
      key.startsWith("section:") ||
      key.startsWith("subject:") ||
      key.startsWith("period:") ||
      key.startsWith("classSubject:") ||
      key.startsWith("teacherSubjectClass:") ||
      key.startsWith("timetableSlot:") ||
      key.startsWith("student:") ||
      key.startsWith("studentLeave:") ||
      key.startsWith("teacher:") ||
      key.startsWith("teacherLeave:") ||
      key.startsWith("attendance:") ||
      key.startsWith("exam:") ||
      key.startsWith("notice:") ||
      key.startsWith("circular:") ||
      key.startsWith("notification:")
  )

  const financePermissions = permissionKeys.filter((key) =>
    key.startsWith("fee:")
  )

  const rolePermissionMap: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: [...permissionKeys],
    [UserRole.ADMIN]: [...permissionKeys],
    [UserRole.ACADEMIC_SUB_ADMIN]: [...academicPermissions],
    [UserRole.FINANCE_SUB_ADMIN]: financePermissions,
    [UserRole.TEACHER]: [
      "teacher:read",
      "teacherSubjectClass:read",
      "class:read",
      "section:read",
      "attendance:mark",
      "attendance:update",
      "attendance:read",
      "student:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read",
      "notification:read",
      "assignment:create",
      "assignment:read",
      "assignment:update",
      "assignment:grade",
      "note:create",
      "note:read",
      "note:update",
      "syllabus:read",
      "syllabus:update",
      "marks:create",
      "marks:update",
      "exam:read",
      "result:read",
      "reportCard:read",
      "ranking:read",
      "studentLeave:read",
      "studentLeave:update",
      "teacherLeave:create",
      "teacherLeave:read",
      "teacherLeave:update"
    ],
    [UserRole.PARENT]: [
      "student:read",
      "attendance:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read",
      "notification:read",
      "assignment:read",
      "assignment:submit",
      "note:read",
      "certificate:request",
      "certificate:read",
      "syllabus:read",
      "exam:read",
      "exam:register",
      "result:read",
      "reportCard:read",
      "admitCard:read",
      "fee:read",
      "fee:pay",
      "ranking:read",
      "studentLeave:create",
      "studentLeave:read",
      "studentLeave:update"
    ],
    [UserRole.STUDENT]: [
      "student:read",
      "attendance:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read",
      "notification:read",
      "assignment:read",
      "assignment:submit",
      "note:read",
      "certificate:request",
      "certificate:read",
      "syllabus:read",
      "exam:read",
      "exam:register",
      "result:read",
      "reportCard:read",
      "admitCard:read",
      "fee:read",
      "fee:pay",
      "ranking:read",
      "studentLeave:create",
      "studentLeave:read",
      "studentLeave:update"
    ]
  }

  const targetRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACADEMIC_SUB_ADMIN,
    UserRole.FINANCE_SUB_ADMIN,
    UserRole.TEACHER,
    UserRole.PARENT,
    UserRole.STUDENT
  ]

  for (const roleType of targetRoles) {
    const roleId = roleIdByType.get(roleType)

    if (!roleId) {
      continue
    }

    for (const permissionKey of rolePermissionMap[roleType]) {
      const permissionId = permissionIdByKey.get(permissionKey)

      if (!permissionId) {
        continue
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId
          }
        },
        update: {},
        create: {
          roleId,
          permissionId
        }
      })
    }
  }

  console.log("✅ Role permissions seeded")
}

async function main() {
  console.log("🌱 Starting seed")

  await seedRoles()
  await seedPermissions()
  await seedRolePermissions()
  // Core RBAC only

  console.log("🌱 Seed finished")
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
