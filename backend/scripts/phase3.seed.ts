import "dotenv/config";

import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { publishResults } from "../src/modules/results/service";
import { recomputeRanking } from "../src/modules/ranking/service";
import { generateAdmitCardsForExam } from "../src/modules/admitCards/service";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type SectionInfo = {
  id: string;
  classId: string;
  className: string;
  sectionName: string;
};

type SubjectPlan = {
  code: string;
  name: string;
  periodsPerWeek: number;
};

type AssignmentOption = {
  teacherId: string;
  classSubjectId: string;
};

const teacherProfiles = [
  { name: "Aarav Sharma", gender: "Male", subject: "Mathematics", dept: "Mathematics" },
  { name: "Ananya Iyer", gender: "Female", subject: "Mathematics", dept: "Mathematics" },
  { name: "Rohan Mehta", gender: "Male", subject: "Mathematics", dept: "Mathematics" },
  { name: "Priya Nair", gender: "Female", subject: "Mathematics", dept: "Mathematics" },
  { name: "Ishaan Gupta", gender: "Male", subject: "English", dept: "English" },
  { name: "Meera Kapoor", gender: "Female", subject: "English", dept: "English" },
  { name: "Kavya Menon", gender: "Female", subject: "English", dept: "English" },
  { name: "Arjun Rao", gender: "Male", subject: "English", dept: "English" },
  { name: "Siddharth Verma", gender: "Male", subject: "Science", dept: "Science" },
  { name: "Nisha Bhattacharya", gender: "Female", subject: "Science", dept: "Science" },
  { name: "Rajesh Kulkarni", gender: "Male", subject: "Science", dept: "Science" },
  { name: "Pooja Das", gender: "Female", subject: "Social Studies", dept: "Social Studies" },
  { name: "Aditya Singh", gender: "Male", subject: "Social Studies", dept: "Social Studies" },
  { name: "Neha Joshi", gender: "Female", subject: "Social Studies", dept: "Social Studies" },
  { name: "Vikram Subramanian", gender: "Male", subject: "Hindi", dept: "Hindi" },
  { name: "Sana Khan", gender: "Female", subject: "Hindi", dept: "Hindi" },
  { name: "Rahul Chawla", gender: "Male", subject: "Hindi", dept: "Hindi" },
  { name: "Tanya Bose", gender: "Female", subject: "Computer Science", dept: "Computer Science" },
  { name: "Kunal Patel", gender: "Male", subject: "Computer Science", dept: "Computer Science" },
  { name: "Shruti Pillai", gender: "Female", subject: "Computer Science", dept: "Computer Science" },
];

const studentFirstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Mohammed",
  "Sai", "Arnav", "Ayaan", "Ananya", "Diya", "Myra", "Ira", "Sara",
  "Aadhya", "Anvi", "Kiara", "Meera", "Riya", "Saanvi", "Ishita",
  "Prisha", "Nisha", "Kavya", "Tanya", "Neha", "Pooja", "Sana", "Aditi",
];

const studentLastNames = [
  "Sharma", "Verma", "Iyer", "Nair", "Singh", "Gupta", "Kapoor", "Joshi",
  "Mehta", "Rao", "Patel", "Khan", "Das", "Bose", "Menon", "Kulkarni",
  "Chawla", "Bhatt", "Pillai", "Subramanian",
];

const subjectsCatalog = [
  { code: "MATH", name: "Mathematics" },
  { code: "ENG", name: "English" },
  { code: "SCI", name: "Science" },
  { code: "SOC", name: "Social Studies" },
  { code: "COMP", name: "Computer Science" },
  { code: "HIN", name: "Hindi" },
  { code: "EVS", name: "Environmental Studies" },
];

const permissionKeys = [
  "result:read",
  "result:recompute",
  "result:publish",
  "ranking:read",
  "ranking:recompute",
  "reportCard:read",
  "admitCard:read",
  "admitCard:generate",
  "admitCard:unlock",
  "admitCard:generatePdf",
];

function pad(num: number, size = 3) {
  return num.toString().padStart(size, "0");
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function ensurePermissions() {
  for (const key of permissionKeys) {
    const [module, action] = key.split(":");
    await prisma.permission.upsert({
      where: { permissionKey: key },
      update: { module, description: `${module} ${action} permission` },
      create: { permissionKey: key, module, description: `${module} ${action} permission` },
    });
  }
}

async function ensureRolePermissions(roleId: string, keys: string[]) {
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

async function ensurePeriods(schoolId: string) {
  const existing = await prisma.period.findMany({
    where: { schoolId },
    select: { periodNumber: true },
  });
  const existingSet = new Set(existing.map((p) => p.periodNumber));
  const baseTimes = [
    ["09:00", "09:45"],
    ["09:50", "10:35"],
    ["10:40", "11:25"],
    ["11:30", "12:15"],
    ["12:20", "13:05"],
    ["13:10", "13:55"],
  ];

  for (let i = 0; i < baseTimes.length; i += 1) {
    const periodNumber = i + 1;
    if (existingSet.has(periodNumber)) continue;
    const [start, end] = baseTimes[i];
    await prisma.period.create({
      data: {
        schoolId,
        periodNumber,
        startTime: new Date(`1970-01-01T${start}:00`),
        endTime: new Date(`1970-01-01T${end}:00`),
        isLunch: false,
        isFirstPeriod: periodNumber === 1,
      },
    });
  }
}

function buildClassSubjectPlan(classOrder: number): SubjectPlan[] {
  if (classOrder <= 3) {
    return [
      { code: "ENG", name: "English", periodsPerWeek: 8 },
      { code: "MATH", name: "Mathematics", periodsPerWeek: 8 },
      { code: "EVS", name: "Environmental Studies", periodsPerWeek: 7 },
      { code: "HIN", name: "Hindi", periodsPerWeek: 7 },
    ];
  }

  if (classOrder <= 5) {
    return [
      { code: "ENG", name: "English", periodsPerWeek: 6 },
      { code: "MATH", name: "Mathematics", periodsPerWeek: 6 },
      { code: "SCI", name: "Science", periodsPerWeek: 6 },
      { code: "SOC", name: "Social Studies", periodsPerWeek: 6 },
      { code: "HIN", name: "Hindi", periodsPerWeek: 6 },
    ];
  }

  return [
    { code: "ENG", name: "English", periodsPerWeek: 6 },
    { code: "MATH", name: "Mathematics", periodsPerWeek: 6 },
    { code: "SCI", name: "Science", periodsPerWeek: 6 },
    { code: "SOC", name: "Social Studies", periodsPerWeek: 6 },
    { code: "COMP", name: "Computer Science", periodsPerWeek: 6 },
  ];
}

function buildMarks(scoreBase: number, maxMarks: number) {
  const raw = 55 + (scoreBase % 41); // 55 - 95
  return Math.min(maxMarks, raw);
}

async function main() {
  const school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
  if (!school) {
    throw new Error("No school found. Please seed school first.");
  }

  let academicYear = await prisma.academicYear.findFirst({
    where: { schoolId: school.id, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!academicYear) {
    academicYear = await prisma.academicYear.findFirst({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
    });
  }
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        label: "2026-2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isActive: true,
      },
    });
  }

  await ensurePermissions();

  const roles = await prisma.role.findMany({
    where: { roleType: { in: [UserRole.ADMIN, UserRole.STUDENT] } },
    select: { id: true, roleType: true },
  });
  const roleIdByType = new Map(roles.map((role) => [role.roleType, role.id]));

  if (!roleIdByType.get(UserRole.ADMIN) || !roleIdByType.get(UserRole.STUDENT)) {
    throw new Error("Required roles missing. Seed roles before running.");
  }

  await ensureRolePermissions(roleIdByType.get(UserRole.ADMIN)!, [
    "result:read",
    "result:publish",
    "result:recompute",
    "ranking:read",
    "ranking:recompute",
    "reportCard:read",
    "admitCard:read",
    "admitCard:generate",
    "admitCard:unlock",
    "admitCard:generatePdf",
  ]);

  await ensureRolePermissions(roleIdByType.get(UserRole.STUDENT)!, [
    "result:read",
    "ranking:read",
    "reportCard:read",
    "admitCard:read",
  ]);

  const existingClasses = await prisma.class.findMany({
    where: { schoolId: school.id, academicYearId: academicYear.id, deletedAt: null },
    select: { id: true, className: true, classOrder: true },
  });
  const classByOrder = new Map(existingClasses.map((c) => [c.classOrder, c]));
  const classes: { id: string; className: string; classOrder: number }[] = [...existingClasses];

  for (let i = 1; i <= 10; i += 1) {
    if (classByOrder.has(i)) continue;
    const created = await prisma.class.create({
      data: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        className: `Class ${i}`,
        classOrder: i,
      },
    });
    classes.push(created);
  }

  const sectionsByClassId = new Map<string, SectionInfo[]>();
  for (const cls of classes) {
    const existingSections = await prisma.section.findMany({
      where: { classId: cls.id, deletedAt: null },
      select: { id: true, sectionName: true, classId: true },
    });
    const existingNames = new Set(existingSections.map((s) => s.sectionName));
    const desired = ["A", "B", "C"];
    const targetCount = existingSections.length >= 2 ? existingSections.length : 2;
    for (let i = 0; i < targetCount; i += 1) {
      const name = desired[i];
      if (!name || existingNames.has(name)) continue;
      await prisma.section.create({
        data: {
          classId: cls.id,
          sectionName: name,
        },
      });
    }

    const finalSections = await prisma.section.findMany({
      where: { classId: cls.id, deletedAt: null },
      select: { id: true, sectionName: true, classId: true },
      orderBy: { sectionName: "asc" },
    });
    sectionsByClassId.set(
      cls.id,
      finalSections.map((s) => ({
        id: s.id,
        classId: s.classId,
        className: cls.className,
        sectionName: s.sectionName,
      }))
    );
  }

  const existingTeachers = await prisma.teacher.findMany({
    where: { schoolId: school.id, deletedAt: null },
    select: { id: true, email: true, employeeId: true, department: true },
  });
  const teacherEmails = new Set(existingTeachers.map((t) => t.email ?? ""));
  const teacherBySubject = new Map<string, string[]>();
  const teachers: { id: string; subject: string }[] = [];
  let teachersCreated = 0;

  let employeeCounter = existingTeachers.length + 1;
  for (const profile of teacherProfiles) {
    const email = `${profile.name.toLowerCase().replace(/\s+/g, ".")}` + "@csc.edu";
    if (teacherEmails.has(email)) {
      const existing = existingTeachers.find((t) => t.email === email);
      if (existing) {
        teachers.push({ id: existing.id, subject: profile.subject });
        const list = teacherBySubject.get(profile.subject) ?? [];
        list.push(existing.id);
        teacherBySubject.set(profile.subject, list);
      }
      continue;
    }

    const employeeId = `T2026-${pad(employeeCounter, 4)}`;
    employeeCounter += 1;
    const created = await prisma.teacher.create({
      data: {
        schoolId: school.id,
        employeeId,
        fullName: profile.name,
        designation: "Subject Teacher",
        department: profile.dept,
        joiningDate: new Date("2024-06-01"),
        gender: profile.gender,
        qualification: "B.Ed",
        phone: `98${pad(employeeCounter, 8)}`,
        email,
        address: "Bengaluru, Karnataka",
      },
    });
    teachersCreated += 1;
    teachers.push({ id: created.id, subject: profile.subject });
    const list = teacherBySubject.get(profile.subject) ?? [];
    list.push(created.id);
    teacherBySubject.set(profile.subject, list);
  }

  for (const subject of subjectsCatalog) {
    await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: subject.code } },
      update: { name: subject.name },
      create: { schoolId: school.id, code: subject.code, name: subject.name },
    });
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId: school.id },
    select: { id: true, code: true, name: true },
  });
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));

  const classSubjects: { id: string; classId: string; subjectCode: string; periodsPerWeek: number }[] = [];

  for (const cls of classes) {
    const plan = buildClassSubjectPlan(cls.classOrder);
    for (const entry of plan) {
      const subject = subjectByCode.get(entry.code);
      if (!subject) continue;
      const created = await prisma.classSubject.upsert({
        where: { classId_subjectId: { classId: cls.id, subjectId: subject.id } },
        update: { periodsPerWeek: entry.periodsPerWeek },
        create: {
          classId: cls.id,
          subjectId: subject.id,
          periodsPerWeek: entry.periodsPerWeek,
        },
      });
      classSubjects.push({
        id: created.id,
        classId: cls.id,
        subjectCode: entry.code,
        periodsPerWeek: entry.periodsPerWeek,
      });
    }
  }

  const classSubjectsByClass = new Map<string, typeof classSubjects>();
  for (const cs of classSubjects) {
    const list = classSubjectsByClass.get(cs.classId) ?? [];
    list.push(cs);
    classSubjectsByClass.set(cs.classId, list);
  }

  const subjectRoundRobin = new Map<string, number>();
  function pickTeacherIds(subjectCode: string) {
    const subjectName =
      subjectCode === "SOC"
        ? "Social Studies"
        : subjectCode === "COMP"
          ? "Computer Science"
          : subjectCode === "HIN"
            ? "Hindi"
            : subjectCode === "EVS"
              ? "Science"
              : subjectCode === "ENG"
                ? "English"
                : subjectCode === "MATH"
                  ? "Mathematics"
                  : "Science";
    const pool = teacherBySubject.get(subjectName) ?? [];
    if (pool.length === 0) {
      throw new Error(`No teachers found for subject ${subjectName}`);
    }
    const idx = subjectRoundRobin.get(subjectName) ?? 0;
    const first = pool[idx % pool.length];
    const second = pool[(idx + 1) % pool.length];
    subjectRoundRobin.set(subjectName, idx + 2);
    return pool.length > 1 ? [first, second] : [first];
  }

  const sectionAssignments = new Map<string, Map<string, string[]>>();
  for (const cls of classes) {
    const sections = sectionsByClassId.get(cls.id) ?? [];
    const classSubjectList = classSubjectsByClass.get(cls.id) ?? [];
    for (const section of sections) {
      const subjectTeacherMap = new Map<string, string[]>();
      for (const cs of classSubjectList) {
        const teacherIds = pickTeacherIds(cs.subjectCode);
        subjectTeacherMap.set(cs.id, teacherIds);
        for (const teacherId of teacherIds) {
          await prisma.teacherSubjectClass.upsert({
            where: {
              teacherId_classSubjectId_sectionId_academicYearId: {
                teacherId,
                classSubjectId: cs.id,
                sectionId: section.id,
                academicYearId: academicYear.id,
              },
            },
            update: {},
            create: {
              teacherId,
              classSubjectId: cs.id,
              sectionId: section.id,
              academicYearId: academicYear.id,
            },
          });
        }
      }
      sectionAssignments.set(section.id, subjectTeacherMap);

      if (!section.classTeacherId) {
        const englishSubject = classSubjectList.find((cs) => cs.subjectCode === "ENG");
        if (englishSubject) {
          await prisma.section.update({
            where: { id: section.id },
            data: { classTeacherId: subjectTeacherMap.get(englishSubject.id)?.[0] ?? null },
          });
        }
      }
    }
  }

  await ensurePeriods(school.id);
  const periods = await prisma.period.findMany({
    where: { schoolId: school.id },
    orderBy: { periodNumber: "asc" },
    select: { id: true, periodNumber: true },
  });
  const periodIds = periods.map((p) => p.id);

  const allSections: SectionInfo[] = [];
  for (const list of sectionsByClassId.values()) {
    allSections.push(...list);
  }

  await prisma.timetableSlot.deleteMany({
    where: { academicYearId: academicYear.id, sectionId: { in: allSections.map((s) => s.id) } },
  });

  const timetableData: Prisma.TimetableSlotCreateManyInput[] = [];
  const usageBySection = new Map<string, Map<string, number>>();

  for (const section of allSections) {
    const classSubjectList = classSubjectsByClass.get(section.classId) ?? [];
    const usage = new Map<string, number>();
    for (const cs of classSubjectList) {
      usage.set(cs.id, 0);
    }
    usageBySection.set(section.id, usage);
  }

  const slots: { dayOfWeek: number; periodId: string }[] = [];
  for (let day = 1; day <= 5; day += 1) {
    for (const periodId of periodIds) {
      slots.push({ dayOfWeek: day, periodId });
    }
  }

  for (const slot of slots) {
    let assigned = false;
    let attempts = 0;
    while (!assigned && attempts < 50) {
      attempts += 1;
      const sectionOrder = shuffle(allSections);
      const optionsBySection = new Map<string, AssignmentOption[]>();

      for (const section of sectionOrder) {
        const map = sectionAssignments.get(section.id)!;
        const options: AssignmentOption[] = [];
        for (const [classSubjectId, teacherIds] of map.entries()) {
          if (!teacherIds || teacherIds.length === 0) continue;
          for (const teacherId of teacherIds) {
            options.push({ teacherId, classSubjectId });
          }
        }

        optionsBySection.set(section.id, shuffle(options));
      }

      const teacherToSection = new Map<string, string>();
      const assignment = new Map<string, AssignmentOption>();

      const sectionsSorted = [...sectionOrder].sort((a, b) => {
        const aOptions = optionsBySection.get(a.id)?.length ?? 0;
        const bOptions = optionsBySection.get(b.id)?.length ?? 0;
        return aOptions - bOptions;
      });

      const tryAssign = (sectionId: string, seen: Set<string>): boolean => {
        const options = optionsBySection.get(sectionId) ?? [];
        if (options.length === 0) return false;
        const ordered = [...options].sort((a, b) => {
          const usedA = usageBySection.get(sectionId)?.get(a.classSubjectId) ?? 0;
          const usedB = usageBySection.get(sectionId)?.get(b.classSubjectId) ?? 0;
          return usedA - usedB;
        });

        for (const option of ordered) {
          if (seen.has(option.teacherId)) continue;
          seen.add(option.teacherId);
          const occupiedBy = teacherToSection.get(option.teacherId);
          if (!occupiedBy || tryAssign(occupiedBy, seen)) {
            teacherToSection.set(option.teacherId, sectionId);
            assignment.set(sectionId, option);
            return true;
          }
        }
        return false;
      };

      let ok = true;
      for (const section of sectionsSorted) {
        if (!tryAssign(section.id, new Set())) {
          ok = false;
          break;
        }
      }

      if (!ok) {
        continue;
      }

      for (const section of sectionsSorted) {
        const picked = assignment.get(section.id);
        if (!picked) {
          ok = false;
          break;
        }
        const usage = usageBySection.get(section.id)!;
        usage.set(picked.classSubjectId, (usage.get(picked.classSubjectId) ?? 0) + 1);
        timetableData.push({
          sectionId: section.id,
          classSubjectId: picked.classSubjectId,
          teacherId: picked.teacherId,
          academicYearId: academicYear.id,
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
        });
      }

      if (ok) {
        assigned = true;
      }
    }

    if (!assigned) {
      throw new Error(`Failed to assign timetable for day ${slot.dayOfWeek} period ${slot.periodId}`);
    }
  }

  const timetableChunks = [] as Prisma.TimetableSlotCreateManyInput[][];
  for (let i = 0; i < timetableData.length; i += 500) {
    timetableChunks.push(timetableData.slice(i, i + 500));
  }
  for (const chunk of timetableChunks) {
    await prisma.timetableSlot.createMany({ data: chunk });
  }

  const existingStudents = await prisma.student.count({
    where: { schoolId: school.id, deletedAt: null },
  });
  let admissionCounter = existingStudents + 1;
  let registrationCounter = existingStudents + 1;

  const targetSections = allSections
    .filter((section) => ["A", "B"].includes(section.sectionName))
    .sort((a, b) => a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName));

  const createdStudents: { id: string; classId: string; sectionId: string }[] = [];
  const classOrderById = new Map(classes.map((cls) => [cls.id, cls.classOrder]));

  for (const section of targetSections) {
    const existingRolls = await prisma.studentEnrollment.findMany({
      where: { sectionId: section.id, academicYearId: academicYear.id },
      select: { rollNumber: true },
    });
    const maxRoll = Math.max(0, ...existingRolls.map((r) => r.rollNumber ?? 0));
    const existingCount = existingRolls.length;
    const toCreate = Math.max(0, 10 - existingCount);
    for (let i = 1; i <= toCreate; i += 1) {
      const first = studentFirstNames[(admissionCounter + i) % studentFirstNames.length];
      const last = studentLastNames[(registrationCounter + i) % studentLastNames.length];
      const fullName = `${first} ${last}`;
      const admissionNumber = `ADM2026-${pad(admissionCounter, 4)}`;
      const registrationNumber = `REG2026-${pad(registrationCounter, 4)}`;
      admissionCounter += 1;
      registrationCounter += 1;

      const classOrder = classOrderById.get(section.classId) ?? 1;
      const birthYear = 2016 - classOrder;
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          registrationNumber,
          admissionNumber,
          fullName,
          dateOfBirth: new Date(`${birthYear}-06-15`),
          gender: i % 2 === 0 ? "Female" : "Male",
          bloodGroup: i % 3 === 0 ? "O+" : i % 3 === 1 ? "A+" : "B+",
        },
      });

      await prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          classId: section.classId,
          sectionId: section.id,
          rollNumber: maxRoll + i,
        },
      });

      createdStudents.push({ id: student.id, classId: section.classId, sectionId: section.id });
    }
  }

  const adminEmail = "phase3.admin@csc.edu";
  const studentEmail = "phase3.student@csc.edu";
  const adminPassword = "Admin@123";
  const studentPassword = "Student@123";

  const adminRoleId = roleIdByType.get(UserRole.ADMIN)!;
  const studentRoleId = roleIdByType.get(UserRole.STUDENT)!;

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      schoolId: school.id,
      roleId: adminRoleId,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      isActive: true,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      schoolId: school.id,
      roleId: studentRoleId,
      email: studentEmail,
      passwordHash: await bcrypt.hash(studentPassword, 10),
      isActive: true,
    },
  });

  let sampleStudentId: string | null = null;
  const existingLinkedStudent = await prisma.student.findFirst({
    where: { userId: studentUser.id, schoolId: school.id },
    select: { id: true },
  });
  if (existingLinkedStudent) {
    sampleStudentId = existingLinkedStudent.id;
  } else if (createdStudents[0]) {
    await prisma.student.update({
      where: { id: createdStudents[0].id },
      data: { userId: studentUser.id },
    });
    sampleStudentId = createdStudents[0].id;
  }

  let exam = await prisma.exam.findFirst({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      title: "Midterm Assessment",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      schoolId: true,
      academicYearId: true,
      termNo: true,
      title: true,
      isPublished: true,
      isLocked: true,
      startsOn: true,
      endsOn: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!exam) {
    const latestTerm = await prisma.exam.findFirst({
      where: { schoolId: school.id, academicYearId: academicYear.id },
      orderBy: { termNo: "desc" },
      select: { termNo: true },
    });
    const termNo = latestTerm ? latestTerm.termNo + 1 : 1;
    exam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        termNo,
        title: "Midterm Assessment",
        startsOn: new Date("2026-09-10"),
        endsOn: new Date("2026-09-20"),
      },
    });
  }

  const examSubjectsData: Prisma.ExamSubjectCreateManyInput[] = [];
  for (const cs of classSubjects) {
    examSubjectsData.push({
      examId: exam.id,
      classSubjectId: cs.id,
      maxMarks: new Prisma.Decimal(100),
      passMarks: new Prisma.Decimal(35),
    });
  }
  await prisma.examSubject.createMany({ data: examSubjectsData, skipDuplicates: true });

  const examSubjects = await prisma.examSubject.findMany({
    where: { examId: exam.id },
    select: { id: true, classSubjectId: true, classSubject: { select: { classId: true } } },
  });

  const examSubjectsByClass = new Map<string, { id: string; classSubjectId: string }[]>();
  for (const es of examSubjects) {
    const list = examSubjectsByClass.get(es.classSubject.classId) ?? [];
    list.push({ id: es.id, classSubjectId: es.classSubjectId });
    examSubjectsByClass.set(es.classSubject.classId, list);
  }

  const examTimetableData: Prisma.ExamTimetableCreateManyInput[] = [];
  let subjectIndex = 0;
  for (const list of examSubjectsByClass.values()) {
    for (const es of list) {
      subjectIndex += 1;
      const dayOffset = (subjectIndex % 10) + 1;
      examTimetableData.push({
        examSubjectId: es.id,
        examDate: new Date(`2026-09-${pad(10 + dayOffset, 2)}`),
        startTime: new Date("1970-01-01T09:30:00"),
        endTime: new Date("1970-01-01T12:30:00"),
        venue: `Hall ${((subjectIndex - 1) % 4) + 1}`,
      });
    }
  }
  await prisma.examTimetable.createMany({ data: examTimetableData, skipDuplicates: true });

  const marksData: Prisma.MarkCreateManyInput[] = [];
  const marksTeachersMap = new Map<string, string>();
  for (const section of allSections) {
    const map = sectionAssignments.get(section.id);
    if (!map) continue;
    for (const [classSubjectId, teacherIds] of map.entries()) {
      if (teacherIds.length === 0) continue;
      marksTeachersMap.set(`${section.id}:${classSubjectId}`, teacherIds[0]);
    }
  }

  const enrollmentMap = new Map<string, { classId: string; sectionId: string }>();
  for (const student of createdStudents) {
    enrollmentMap.set(student.id, { classId: student.classId, sectionId: student.sectionId });
  }

  for (const student of createdStudents) {
    const enrollment = enrollmentMap.get(student.id);
    if (!enrollment) continue;
    const subjectsForClass = examSubjectsByClass.get(enrollment.classId) ?? [];
    for (const es of subjectsForClass) {
      const teacherId = marksTeachersMap.get(`${enrollment.sectionId}:${es.classSubjectId}`) ?? null;
      const base = student.id.charCodeAt(0) + es.classSubjectId.charCodeAt(0);
      const marksObtained = buildMarks(base, 100);
      marksData.push({
        examSubjectId: es.id,
        studentId: student.id,
        marksObtained: new Prisma.Decimal(marksObtained),
        isAbsent: false,
        enteredByTeacherId: teacherId,
      });
    }
  }

  for (let i = 0; i < marksData.length; i += 500) {
    await prisma.mark.createMany({ data: marksData.slice(i, i + 500), skipDuplicates: true });
  }

  await prisma.exam.updateMany({
    where: { id: exam.id, isPublished: false },
    data: { isPublished: true },
  });
  await prisma.exam.updateMany({
    where: { id: exam.id, isLocked: false },
    data: { isLocked: true },
  });
  await publishResults(school.id, exam.id, { userId: adminUser.id, roleType: "ADMIN" });
  await recomputeRanking(school.id, exam.id, { userId: adminUser.id, roleType: "ADMIN" });
  await generateAdmitCardsForExam(school.id, exam.id);

  console.log("PHASE3_SEED_DONE");
  const totalTeachers = await prisma.teacher.count({ where: { schoolId: school.id, deletedAt: null } });
  const totalSubjects = await prisma.subject.count({ where: { schoolId: school.id } });
  const totalStudents = await prisma.student.count({ where: { schoolId: school.id, deletedAt: null } });
  console.log(JSON.stringify({
    schoolId: school.id,
    academicYearId: academicYear.id,
    examId: exam.id,
    teachersCreated,
    studentsCreated: createdStudents.length,
    subjectsCreated: totalSubjects,
    totalTeachers,
    totalStudents,
    adminEmail,
    adminPassword,
    studentEmail,
    studentPassword,
    sampleStudentId,
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
