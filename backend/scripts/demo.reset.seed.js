require("dotenv/config");
const bcrypt = require("bcrypt");
const { PrismaClient, UserRole, AttendanceStatus, NoticeTargetType } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run demo seed");
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SCHOOL_CODE = "SX-DEMO-01";
const SCHOOL_NAME = "SaiyoniX Demo School";
const ACADEMIC_LABEL = "2026-2027";
const ADMIN_EMAIL = "admin@saiyonix.demo";
const ADMIN_PASSWORD = "Admin@123";
const TEACHER_PASSWORD = "Teacher@123";

const permissionKeys = [
  "academicYear:create",
  "academicYear:read",
  "academicYear:update",
  "academicYear:delete",
  "admitCard:generate",
  "admitCard:generatePdf",
  "admitCard:read",
  "admitCard:unlock",
  "assignment:create",
  "assignment:delete",
  "assignment:grade",
  "assignment:read",
  "assignment:submit",
  "assignment:update",
  "attendance:mark",
  "attendance:read",
  "attendance:update",
  "circular:create",
  "circular:delete",
  "circular:read",
  "circular:update",
  "class:create",
  "class:read",
  "class:update",
  "class:delete",
  "classSubject:create",
  "classSubject:read",
  "classSubject:update",
  "classSubject:delete",
  "exam:create",
  "exam:update",
  "exam:publish",
  "exam:lock",
  "exam:read",
  "marks:create",
  "marks:read",
  "marks:update",
  "note:create",
  "note:delete",
  "note:read",
  "note:update",
  "notice:create",
  "notice:read",
  "notice:update",
  "notice:delete",
  "notification:send",
  "notification:read",
  "notification:update",
  "period:create",
  "period:read",
  "period:update",
  "period:delete",
  "ranking:read",
  "ranking:recompute",
  "reportCard:read",
  "result:read",
  "result:publish",
  "result:recompute",
  "section:create",
  "section:read",
  "section:update",
  "section:delete",
  "student:create",
  "student:read",
  "student:update",
  "student:delete",
  "student:bulk-import",
  "studentLeave:create",
  "studentLeave:read",
  "studentLeave:update",
  "subject:create",
  "subject:read",
  "subject:update",
  "subject:delete",
  "syllabus:create",
  "syllabus:read",
  "syllabus:update",
  "syllabus:delete",
  "teacher:create",
  "teacher:read",
  "teacher:update",
  "teacher:delete",
  "teacher:bulk-import",
  "teacherLeave:create",
  "teacherLeave:read",
  "teacherLeave:update",
  "teacherSubjectClass:create",
  "teacherSubjectClass:read",
  "teacherSubjectClass:update",
  "teacherSubjectClass:delete",
  "timetableSlot:create",
  "timetableSlot:read",
  "timetableSlot:update",
  "timetableSlot:delete",
];

async function truncateAllTables() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows } = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
    );

    if (!rows.length) return;

    const quoted = rows
      .map((row) => `"${row.tablename.replace(/"/g, '""')}"`)
      .join(", ");

    await pool.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
  } finally {
    await pool.end();
  }
}

async function seedRoles() {
  const roles = [
    UserRole.SUPER_ADMIN,
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
}

async function seedPermissions() {
  for (const permissionKey of permissionKeys) {
    const [module, action] = permissionKey.split(":");
    await prisma.permission.upsert({
      where: { permissionKey },
      update: { module, description: `${module} ${action} permission` },
      create: { permissionKey, module, description: `${module} ${action} permission` },
    });
  }
}

async function seedRolePermissions() {
  const roles = await prisma.role.findMany({
    where: {
      roleType: {
        in: [
          UserRole.SUPER_ADMIN,
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
    where: { permissionKey: { in: permissionKeys } },
    select: { id: true, permissionKey: true },
  });

  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]));
  const permissionIdByKey = new Map(
    permissions.map((permission) => [permission.permissionKey, permission.id])
  );

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
  );

  const rolePermissionMap = {
    [UserRole.SUPER_ADMIN]: [...permissionKeys],
    [UserRole.ADMIN]: [...permissionKeys],
    [UserRole.ACADEMIC_SUB_ADMIN]: [...academicPermissions],
    [UserRole.FINANCE_SUB_ADMIN]: [],
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
      "marks:read",
      "marks:update",
      "exam:read",
      "result:read",
      "reportCard:read",
      "ranking:read",
      "studentLeave:read",
      "studentLeave:update",
      "teacherLeave:create",
      "teacherLeave:read",
      "teacherLeave:update",
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
      "syllabus:read",
      "exam:read",
      "result:read",
      "reportCard:read",
      "admitCard:read",
      "ranking:read",
      "studentLeave:create",
      "studentLeave:read",
      "studentLeave:update",
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
      "syllabus:read",
      "exam:read",
      "result:read",
      "reportCard:read",
      "admitCard:read",
      "ranking:read",
      "studentLeave:create",
      "studentLeave:read",
      "studentLeave:update",
    ],
  };

  for (const roleType of Object.keys(rolePermissionMap)) {
    const roleId = roleIdByType.get(roleType);
    if (!roleId) continue;
    for (const permissionKey of rolePermissionMap[roleType]) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

async function seedSchool() {
  return prisma.school.create({
    data: {
      code: SCHOOL_CODE,
      name: SCHOOL_NAME,
      timezone: "Asia/Kolkata",
      phone: "0361-0000000",
      email: "info@saiyonix.demo",
    },
  });
}

async function seedAdmin(schoolId) {
  const role = await prisma.role.findUnique({
    where: { roleType: UserRole.ADMIN },
    select: { id: true },
  });
  if (!role) throw new Error("ADMIN role missing");

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: {
      schoolId,
      roleId: role.id,
      email: ADMIN_EMAIL,
      passwordHash,
      isActive: true,
    },
  });
}

async function seedAcademicYear(schoolId) {
  return prisma.academicYear.create({
    data: {
      schoolId,
      label: ACADEMIC_LABEL,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true,
      isLocked: false,
    },
  });
}

async function seedClasses(schoolId, academicYearId) {
  const classes = [];
  for (let i = 1; i <= 10; i += 1) {
    classes.push(
      await prisma.class.create({
        data: {
          schoolId,
          academicYearId,
          className: `Class ${i}`,
          classOrder: i,
        },
      })
    );
  }
  return classes;
}

async function seedSections(classes) {
  const sectionNames = ["A", "B"];
  const sections = [];
  for (const classItem of classes) {
    for (const sectionName of sectionNames) {
      sections.push(
        await prisma.section.create({
          data: {
            classId: classItem.id,
            sectionName,
            capacity: 40,
          },
        })
      );
    }
  }
  return sections;
}

async function seedSubjects(schoolId) {
  const subjects = [
    { code: "ENG", name: "English" },
    { code: "MATH", name: "Mathematics" },
    { code: "SCI", name: "Science" },
    { code: "SST", name: "Social Studies" },
    { code: "COMP", name: "Computer" },
  ];

  const subjectIds = new Map();
  for (const subject of subjects) {
    const record = await prisma.subject.create({
      data: { schoolId, code: subject.code, name: subject.name },
      select: { id: true, code: true },
    });
    subjectIds.set(record.code, record.id);
  }
  return subjectIds;
}

async function seedClassSubjects(classIds, subjectIds) {
  const classSubjectIds = new Map();
  for (const classId of classIds) {
    const ids = [];
    for (const subjectId of subjectIds.values()) {
      const record = await prisma.classSubject.create({
        data: {
          classId,
          subjectId,
          periodsPerWeek: 5,
        },
        select: { id: true },
      });
      ids.push(record.id);
    }
    classSubjectIds.set(classId, ids);
  }
  return classSubjectIds;
}

async function seedPeriods(schoolId) {
  const periods = [
    { periodNumber: 1, start: "09:00", end: "09:40" },
    { periodNumber: 2, start: "09:40", end: "10:20" },
    { periodNumber: 3, start: "10:20", end: "11:00" },
    { periodNumber: 4, start: "11:00", end: "11:40" },
    { periodNumber: 5, start: "11:40", end: "12:20" },
  ];

  const periodIds = [];
  for (const period of periods) {
    const record = await prisma.period.create({
      data: {
        schoolId,
        periodNumber: period.periodNumber,
        startTime: new Date(`1970-01-01T${period.start}:00.000Z`),
        endTime: new Date(`1970-01-01T${period.end}:00.000Z`),
        isLunch: period.periodNumber === 3,
        isFirstPeriod: period.periodNumber === 1,
      },
      select: { id: true },
    });
    periodIds.push(record.id);
  }
  return periodIds;
}

async function seedTeachers(schoolId) {
  const role = await prisma.role.findUnique({
    where: { roleType: UserRole.TEACHER },
    select: { id: true },
  });
  if (!role) throw new Error("TEACHER role missing");

  const passwordHash = await bcrypt.hash(TEACHER_PASSWORD, 10);
  const teachers = [];
  for (let i = 1; i <= 5; i += 1) {
    const user = await prisma.user.create({
      data: {
        schoolId,
        roleId: role.id,
        email: `teacher${i}@saiyonix.demo`,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        isMobileVerified: false,
      },
      select: { id: true },
    });
    const teacher = await prisma.teacher.create({
      data: {
        schoolId,
        userId: user.id,
        employeeId: `T-${String(i).padStart(3, "0")}`,
        fullName: `Teacher ${i}`,
        designation: "Teacher",
        department: "Academics",
        joiningDate: new Date("2024-04-01"),
      },
      select: { id: true },
    });
    teachers.push({ id: teacher.id, userId: user.id });
  }
  return teachers;
}

async function assignClassTeachers(sections, teachers) {
  for (let i = 0; i < sections.length; i += 1) {
    const teacher = teachers[i % teachers.length];
    await prisma.section.update({
      where: { id: sections[i].id },
      data: { classTeacherId: teacher.id },
    });
  }
}

async function seedTimetableSlots({ sections, classSubjectIds, periodIds, academicYearId }) {
  const dayOfWeekValues = [1, 2, 3, 4, 5];

  for (const section of sections) {
    const subjects = classSubjectIds.get(section.classId) || [];
    let subjectIndex = 0;
    for (const day of dayOfWeekValues) {
      for (const periodId of periodIds) {
        const classSubjectId = subjects[subjectIndex % subjects.length];
        subjectIndex += 1;
        await prisma.timetableSlot.create({
          data: {
            sectionId: section.id,
            classSubjectId,
            academicYearId,
            dayOfWeek: day,
            periodId,
          },
        });
      }
    }
  }
}

async function seedParentsAndStudents({ schoolId, academicYearId, sections, studentCount }) {
  const parentRole = await prisma.role.findUnique({
    where: { roleType: UserRole.PARENT },
    select: { id: true },
  });
  if (!parentRole) throw new Error("PARENT role missing");

  const students = [];
  const parentIds = [];

  for (let i = 1; i <= Math.ceil(studentCount / 2); i += 1) {
    const mobile = `9000000${String(100 + i).slice(-3)}`.padEnd(10, "0");
    const user = await prisma.user.create({
      data: {
        schoolId,
        roleId: parentRole.id,
        mobile,
        isActive: true,
      },
      select: { id: true },
    });
    const parent = await prisma.parent.create({
      data: {
        schoolId,
        userId: user.id,
        fullName: `Parent ${i}`,
        mobile,
        relationToStudent: "Parent",
      },
      select: { id: true },
    });
    parentIds.push(parent.id);
  }

  for (let i = 1; i <= studentCount; i += 1) {
    const section = sections[(i - 1) % sections.length];
    const student = await prisma.student.create({
      data: {
        schoolId,
        registrationNumber: `REG-${String(i).padStart(3, "0")}`,
        admissionNumber: `ADM-${String(i).padStart(3, "0")}`,
        fullName: `Student ${i}`,
        dateOfBirth: new Date("2015-01-01"),
        gender: i % 2 === 0 ? "FEMALE" : "MALE",
      },
      select: { id: true },
    });

    await prisma.studentEnrollment.create({
      data: {
        studentId: student.id,
        academicYearId,
        classId: section.classId,
        sectionId: section.id,
        rollNumber: i,
      },
    });

    const parentId = parentIds[(i - 1) % parentIds.length];
    await prisma.parentStudentLink.create({
      data: {
        parentId,
        studentId: student.id,
        isPrimary: true,
      },
    });

    students.push({ id: student.id, sectionId: section.id, classId: section.classId });
  }

  return students;
}

async function seedAttendance({ academicYearId, students, sections, timetableSlots }) {
  const today = new Date();
  const attendanceDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  const teacherBySection = new Map(
    sections.map((section) => [section.id, section.classTeacherId])
  );
  const slotBySection = new Map();
  timetableSlots.forEach((slot) => {
    if (!slotBySection.has(slot.sectionId)) {
      slotBySection.set(slot.sectionId, slot.id);
    }
  });

  for (const student of students) {
    const teacherId = teacherBySection.get(student.sectionId);
    const slotId = slotBySection.get(student.sectionId);
    if (!teacherId || !slotId) continue;
    await prisma.studentAttendance.create({
      data: {
        studentId: student.id,
        academicYearId,
        sectionId: student.sectionId,
        timetableSlotId: slotId,
        attendanceDate,
        status: Math.random() > 0.15 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
        markedByTeacherId: teacherId,
      },
    });
  }
}

async function seedExamAndMarks({ schoolId, academicYearId, classSubjects, students, sections }) {
  const exam = await prisma.exam.create({
    data: {
      schoolId,
      academicYearId,
      termNo: 1,
      title: "Term 1 Exam",
      isPublished: true,
      isLocked: false,
    },
  });

  const class1 = Array.from(classSubjects.keys())[0];
  const subjectId = classSubjects.get(class1)[0];
  if (!subjectId) return;

  const examSubject = await prisma.examSubject.create({
    data: {
      examId: exam.id,
      classSubjectId: subjectId,
      maxMarks: 100,
      passMarks: 35,
    },
  });

  const teacherBySection = new Map(
    sections.map((section) => [section.id, section.classTeacherId])
  );

  for (const student of students.filter((s) => s.classId === class1)) {
    await prisma.mark.create({
      data: {
        examSubjectId: examSubject.id,
        studentId: student.id,
        marksObtained: 40 + Math.floor(Math.random() * 50),
        enteredByTeacherId: teacherBySection.get(student.sectionId) || undefined,
      },
    });
  }
}

async function seedNotices(schoolId) {
  const now = new Date();
  await prisma.noticeBoard.create({
    data: {
      schoolId,
      title: "Welcome to SaiyoniX Demo",
      content: "Demo notice for staff, students, and parents.",
      noticeType: "GENERAL",
      targetType: NoticeTargetType.ALL,
      isPublic: true,
      publishedAt: now,
    },
  });
  await prisma.noticeBoard.create({
    data: {
      schoolId,
      title: "Parent-Teacher Meeting",
      content: "PTM scheduled next week. Please check the timetable.",
      noticeType: "EVENT",
      targetType: NoticeTargetType.ALL,
      isPublic: true,
      publishedAt: now,
    },
  });
}

async function validateData({ academicYearId, sections }) {
  const missingTeachers = sections.filter((section) => !section.classTeacherId);
  if (missingTeachers.length) {
    throw new Error("Validation failed: some sections missing class teachers");
  }

  const enrollmentCounts = await prisma.studentEnrollment.groupBy({
    by: ["studentId"],
    where: { academicYearId },
    _count: { studentId: true },
  });
  const invalidEnrollments = enrollmentCounts.filter((entry) => entry._count.studentId !== 1);
  if (invalidEnrollments.length) {
    throw new Error("Validation failed: some students have multiple enrollments");
  }

  const marks = await prisma.mark.findMany({
    include: {
      student: {
        include: { enrollments: { where: { academicYearId } } },
      },
    },
  });
  for (const mark of marks) {
    const enrollment = mark.student.enrollments[0];
    const section = sections.find((item) => item.id === (enrollment ? enrollment.sectionId : ""));
    if (section && mark.enteredByTeacherId && section.classTeacherId !== mark.enteredByTeacherId) {
      throw new Error("Validation failed: mark entered by non-class-teacher");
    }
  }

  const parentUsers = await prisma.user.count({
    where: { role: { roleType: UserRole.PARENT }, mobile: { not: null } },
  });
  if (parentUsers === 0) {
    throw new Error("Validation failed: parent OTP users missing");
  }
}

async function main() {
  console.log("Resetting database...");
  await truncateAllTables();

  console.log("Seeding roles/permissions...");
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();

  console.log("Seeding school + admin + year...");
  const school = await seedSchool();
  await seedAdmin(school.id);
  const academicYear = await seedAcademicYear(school.id);

  console.log("Seeding classes/sections...");
  const classes = await seedClasses(school.id, academicYear.id);
  const sections = await seedSections(classes);

  console.log("Seeding subjects/periods/timetable...");
  const subjectIds = await seedSubjects(school.id);
  const classSubjectIds = await seedClassSubjects(
    classes.map((c) => c.id),
    subjectIds
  );
  const periodIds = await seedPeriods(school.id);

  console.log("Seeding teachers...");
  const teachers = await seedTeachers(school.id);
  await assignClassTeachers(sections, teachers);

  console.log("Seeding timetable slots...");
  await seedTimetableSlots({
    sections,
    classSubjectIds,
    periodIds,
    academicYearId: academicYear.id,
  });

  console.log("Seeding parents + students...");
  const students = await seedParentsAndStudents({
    schoolId: school.id,
    academicYearId: academicYear.id,
    sections,
    studentCount: 24,
  });

  const timetableSlots = await prisma.timetableSlot.findMany({
    select: { id: true, sectionId: true },
  });
  const sectionsWithTeachers = await prisma.section.findMany({
    select: { id: true, classTeacherId: true },
  });

  console.log("Seeding attendance...");
  await seedAttendance({
    academicYearId: academicYear.id,
    students,
    sections: sectionsWithTeachers,
    timetableSlots,
  });

  console.log("Seeding exams + marks...");
  await seedExamAndMarks({
    schoolId: school.id,
    academicYearId: academicYear.id,
    classSubjects: classSubjectIds,
    students,
    sections: sectionsWithTeachers,
  });

  console.log("Seeding notices...");
  await seedNotices(school.id);

  console.log("Validating demo data...");
  await validateData({
    academicYearId: academicYear.id,
    sections: sectionsWithTeachers,
  });

  console.log("✅ Demo seed completed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
