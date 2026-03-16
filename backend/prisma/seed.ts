import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, UserRole } from "@prisma/client"
import bcrypt from "bcrypt"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run Prisma seed")
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const SCHOOL_CODE = "CSC001"
const ACADEMIC_YEAR_LABEL = "2026-2027"
const DEFAULT_ADMIN_EMAIL =
  process.env.DEFAULT_ADMIN_EMAIL ?? "admin@catholicschool.edu"
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123"

let cachedSchoolId: string | null = null
let cachedAcademicYearId: string | null = null

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
  "notification:send"
] as const

const permissionDescriptions: Partial<Record<(typeof permissionKeys)[number], string>> =
  {
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
    "notification:send": "Send notifications"
  }

async function seedRoles() {

  const roles: UserRole[] = [
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
      "attendance:mark",
      "attendance:update",
      "attendance:read",
      "student:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read"
    ],
    [UserRole.PARENT]: [
      "student:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read"
    ],
    [UserRole.STUDENT]: [
      "student:read",
      "timetableSlot:read",
      "notice:read",
      "circular:read"
    ]
  }

  const targetRoles: UserRole[] = [
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

async function seedSchool() {

  await prisma.school.upsert({
    where: { code: SCHOOL_CODE },
    update: {},
    create: {
      code: SCHOOL_CODE,
      name: "Catholic School Canchipur",
      timezone: "Asia/Kolkata"
    }
  })

  console.log("✅ School seeded")
}

async function seedAdmin() {
  const school = await prisma.school.findUnique({
    where: { code: SCHOOL_CODE },
    select: { id: true }
  })

  if (!school) {
    throw new Error(`School with code ${SCHOOL_CODE} not found`)
  }

  const adminRole = await prisma.role.findUnique({
    where: { roleType: UserRole.ADMIN },
    select: { id: true }
  })

  if (!adminRole) {
    throw new Error("ADMIN role not found")
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)

  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      schoolId: school.id
    }
  })

  console.log("✅ Default admin created")
}

async function getSchoolId() {
  if (cachedSchoolId) {
    return cachedSchoolId
  }

  const school = await prisma.school.findUnique({
    where: { code: SCHOOL_CODE },
    select: { id: true }
  })

  if (!school) {
    throw new Error(`School with code ${SCHOOL_CODE} not found`)
  }

  cachedSchoolId = school.id
  return cachedSchoolId
}

async function seedAcademicYear() {
  const schoolId = await getSchoolId()

  const academicYear = await prisma.academicYear.upsert({
    where: {
      schoolId_label: {
        schoolId,
        label: ACADEMIC_YEAR_LABEL
      }
    },
    update: {
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true
    },
    create: {
      schoolId,
      label: ACADEMIC_YEAR_LABEL,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true
    },
    select: { id: true }
  })

  cachedAcademicYearId = academicYear.id
  console.log("Academic year seeded")
}

async function getAcademicYearId() {
  if (cachedAcademicYearId) {
    return cachedAcademicYearId
  }

  const schoolId = await getSchoolId()

  const academicYear = await prisma.academicYear.findUnique({
    where: {
      schoolId_label: {
        schoolId,
        label: ACADEMIC_YEAR_LABEL
      }
    },
    select: { id: true }
  })

  if (!academicYear) {
    throw new Error(`Academic year ${ACADEMIC_YEAR_LABEL} not found`)
  }

  cachedAcademicYearId = academicYear.id
  return cachedAcademicYearId
}

async function seedClasses() {
  const schoolId = await getSchoolId()
  const academicYearId = await getAcademicYearId()

  const classNames = [
    "Nursery",
    "LKG",
    "UKG",
    "Class 1",
    "Class 2",
    "Class 3",
    "Class 4",
    "Class 5",
    "Class 6",
    "Class 7",
    "Class 8",
    "Class 9",
    "Class 10",
    "Class 11",
    "Class 12"
  ]

  for (const [index, className] of classNames.entries()) {
    await prisma.class.upsert({
      where: {
        schoolId_academicYearId_className: {
          schoolId,
          academicYearId,
          className
        }
      },
      update: {
        classOrder: index + 1
      },
      create: {
        schoolId,
        academicYearId,
        className,
        classOrder: index + 1
      }
    })
  }

  console.log("Classes seeded")
}

async function seedSections() {
  const schoolId = await getSchoolId()
  const academicYearId = await getAcademicYearId()

  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      academicYearId
    },
    select: { id: true }
  })

  const sectionNames = ["A", "B", "C", "D"]

  for (const classItem of classes) {
    for (const sectionName of sectionNames) {
      await prisma.section.upsert({
        where: {
          classId_sectionName: {
            classId: classItem.id,
            sectionName
          }
        },
        update: {
          capacity: 50
        },
        create: {
          classId: classItem.id,
          sectionName,
          capacity: 50
        }
      })
    }
  }

  console.log("Sections seeded")
}

async function main() {

  console.log("🌱 Starting seed")

  await seedRoles()
  await seedPermissions()
  await seedRolePermissions()
  await seedSchool()
  await seedAdmin()
  await seedAcademicYear()
  await seedClasses()
  await seedSections()

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
