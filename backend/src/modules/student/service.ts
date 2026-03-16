import { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { listTimetableForStudent } from "../timetableSlot/service";
import type {
  CreateStudentInput,
  EnrollmentInput,
  ParentInput,
  StudentProfileInput,
  UpdateStudentInput,
} from "./validation";

type PrismaError = { code?: string; meta?: { target?: string[] | string } };
type DbClient = Prisma.TransactionClient | typeof prisma;

type EnrollmentLookup = {
  id: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  rollNumber: number | null;
};

async function generateStudentNumbers(client: DbClient, schoolId: string) {
  const year = new Date().getFullYear();
  const last = await client.student.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    select: { admissionNumber: true },
  });

  let counter = 0;
  if (last?.admissionNumber) {
    const match = last.admissionNumber.match(/ADM-(\d{4})-(\d{4})/);
    if (match) {
      const lastYear = Number(match[1]);
      const lastCounter = Number(match[2]);
      if (Number.isFinite(lastYear) && Number.isFinite(lastCounter)) {
        counter = lastYear === year ? lastCounter : 0;
      }
    }
  }

  const next = counter + 1;
  const suffix = String(next).padStart(4, "0");

  return {
    admissionNumber: `ADM-${year}-${suffix}`,
    registrationNumber: `REG-${year}-${suffix}`,
  };
}

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as PrismaError).code ?? "")
      : "";

  if (code === "P2002") {
    const target = (error as PrismaError).meta?.target ?? [];
    const targetList = Array.isArray(target) ? target : [target];

    if (targetList.includes("registrationNumber")) {
      throw new ApiError(409, "Student with this registration number already exists");
    }
    if (targetList.includes("admissionNumber")) {
      throw new ApiError(409, "Student with this admission number already exists");
    }
    if (targetList.includes("studentId") && targetList.includes("academicYearId")) {
      throw new ApiError(409, "Student is already enrolled for this academic year");
    }
    if (targetList.includes("sectionId") && targetList.includes("rollNumber")) {
      throw new ApiError(409, "Roll number already exists in this section");
    }

    throw new ApiError(409, "Duplicate record");
  }

  if (code === "P2003") {
    throw new ApiError(400, "Invalid relation reference");
  }

  throw error;
}

async function ensureAcademicYearBelongsToSchool(schoolId: string, academicYearId: string) {
  const record = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });

  if (!record) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function ensureClassBelongsToSchool(schoolId: string, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { id: true, academicYearId: true },
  });

  if (!classRecord) {
    throw new ApiError(400, "Class not found for this school");
  }

  return classRecord;
}

async function ensureSectionBelongsToSchool(schoolId: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true, classId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function ensureParentBelongsToSchool(
  client: DbClient,
  schoolId: string,
  parentId: string
) {
  const parent = await client.parent.findFirst({
    where: { id: parentId, schoolId },
    select: { id: true },
  });

  if (!parent) {
    throw new ApiError(400, "Parent not found for this school");
  }

  return parent;
}

async function ensureStudentExists(schoolId: string, id: string) {
  const student = await prisma.student.findFirst({
    where: { id, schoolId, deletedAt: null },
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
}

async function ensureRollNumberAvailable(params: {
  sectionId: string;
  rollNumber?: number | null;
  excludeId?: string;
}) {
  if (!params.rollNumber) {
    return;
  }

  const existing = await prisma.studentEnrollment.findFirst({
    where: {
      sectionId: params.sectionId,
      rollNumber: params.rollNumber,
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Roll number already exists in this section");
  }
}

async function ensureEnrollmentIsValid(
  schoolId: string,
  enrollment: EnrollmentInput
) {
  await ensureAcademicYearBelongsToSchool(schoolId, enrollment.academicYearId);
  const classRecord = await ensureClassBelongsToSchool(schoolId, enrollment.classId);
  const section = await ensureSectionBelongsToSchool(schoolId, enrollment.sectionId);

  if (classRecord.academicYearId !== enrollment.academicYearId) {
    throw new ApiError(400, "Class does not belong to the selected academic year");
  }

  if (section.classId !== enrollment.classId) {
    throw new ApiError(400, "Section does not belong to the selected class");
  }
}

async function resolveParentId(
  client: DbClient,
  schoolId: string,
  parentId: string | undefined,
  parent: ParentInput | undefined
) {
  if (parentId) {
    const existing = await ensureParentBelongsToSchool(client, schoolId, parentId);
    return { parentId: existing.id, isPrimary: parent?.isPrimary };
  }

  if (!parent) {
    return { parentId: null, isPrimary: undefined };
  }

  const existingParent = await client.parent.findFirst({
    where: { schoolId, mobile: parent.mobile },
    select: { id: true },
  });

  if (existingParent) {
    return { parentId: existingParent.id, isPrimary: parent.isPrimary };
  }

  const created = await client.parent.create({
    data: {
      schoolId,
      fullName: parent.fullName,
      mobile: parent.mobile,
      email: parent.email,
      relationToStudent: parent.relationToStudent,
    },
    select: { id: true },
  });

  return { parentId: created.id, isPrimary: parent.isPrimary };
}

async function ensureParentLink(
  client: DbClient,
  params: {
  parentId: string;
  studentId: string;
  isPrimary?: boolean;
}) {
  const existing = await client.parentStudentLink.findFirst({
    where: { parentId: params.parentId, studentId: params.studentId },
    select: { id: true },
  });

  if (existing) {
    if (params.isPrimary !== undefined) {
      await client.parentStudentLink.update({
        where: { id: existing.id },
        data: { isPrimary: params.isPrimary },
      });
    }
    return;
  }

  try {
    await client.parentStudentLink.create({
      data: {
        parentId: params.parentId,
        studentId: params.studentId,
        isPrimary: params.isPrimary ?? false,
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

async function upsertStudentProfile(
  client: DbClient,
  studentId: string,
  profile: StudentProfileInput
) {
  const medicalInfo =
    profile.medicalInfo === undefined
      ? undefined
      : profile.medicalInfo === null
        ? Prisma.DbNull
        : (profile.medicalInfo as Prisma.InputJsonValue);

  const existing = await client.studentProfile.findFirst({
    where: { studentId },
    select: { id: true },
  });

  if (existing) {
    await client.studentProfile.update({
      where: { id: existing.id },
      data: {
        ...(profile.profilePhotoUrl !== undefined
          ? { profilePhotoUrl: profile.profilePhotoUrl }
          : {}),
        ...(profile.address !== undefined ? { address: profile.address } : {}),
        ...(profile.emergencyContactName !== undefined
          ? { emergencyContactName: profile.emergencyContactName }
          : {}),
        ...(profile.emergencyContactMobile !== undefined
          ? { emergencyContactMobile: profile.emergencyContactMobile }
          : {}),
        ...(profile.previousSchool !== undefined
          ? { previousSchool: profile.previousSchool }
          : {}),
        ...(medicalInfo !== undefined ? { medicalInfo } : {}),
      },
    });
    return;
  }

  await client.studentProfile.create({
    data: {
      studentId,
      profilePhotoUrl: profile.profilePhotoUrl,
      address: profile.address,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactMobile: profile.emergencyContactMobile,
      previousSchool: profile.previousSchool,
      medicalInfo,
    },
  });
}

async function getEnrollmentForStudent(
  client: DbClient,
  studentId: string,
  academicYearId: string
) {
  return client.studentEnrollment.findFirst({
    where: { studentId, academicYearId },
    select: {
      id: true,
      classId: true,
      sectionId: true,
      academicYearId: true,
      rollNumber: true,
    },
  });
}

export async function createStudent(schoolId: string, payload: CreateStudentInput) {
  await ensureEnrollmentIsValid(schoolId, payload.enrollment);
  await ensureRollNumberAvailable({
    sectionId: payload.enrollment.sectionId,
    rollNumber: payload.enrollment.rollNumber,
  });

  try {
    const studentId = await prisma.$transaction(async (tx) => {
      const parentInfo = await resolveParentId(
        tx,
        schoolId,
        payload.parentId,
        payload.parent
      );
      if (!parentInfo.parentId) {
        throw new ApiError(400, "Parent information is required");
      }

      const generated = await generateStudentNumbers(tx, schoolId);
      const admissionNumber = payload.admissionNumber ?? generated.admissionNumber;
      const registrationNumber =
        payload.registrationNumber ?? generated.registrationNumber;

      const student = await tx.student.create({
        data: {
          schoolId,
          registrationNumber,
          admissionNumber,
          fullName: payload.fullName,
          dateOfBirth: payload.dateOfBirth,
          gender: payload.gender,
          bloodGroup: payload.bloodGroup,
          status: payload.status,
        },
        select: { id: true },
      });

      if (payload.profile) {
        await upsertStudentProfile(tx, student.id, payload.profile);
      }

      await ensureParentLink(tx, {
        parentId: parentInfo.parentId,
        studentId: student.id,
        isPrimary: parentInfo.isPrimary,
      });

      await tx.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicYearId: payload.enrollment.academicYearId,
          classId: payload.enrollment.classId,
          sectionId: payload.enrollment.sectionId,
          rollNumber: payload.enrollment.rollNumber,
          isDetained: payload.enrollment.isDetained ?? false,
          promotionStatus: payload.enrollment.promotionStatus,
        },
      });

      return student.id;
    });
    return getStudentById(schoolId, studentId);
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listStudents(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = { schoolId, deletedAt: null };

  const [items, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      include: {
        profile: true,
        parentLinks: { include: { parent: true } },
        enrollments: {
          include: { academicYear: true, class: true, section: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.student.count({ where }),
  ]);

  return { items, total };
}

export async function getStudentById(schoolId: string, id: string) {
  const student = await prisma.student.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      profile: true,
      parentLinks: { include: { parent: true } },
      enrollments: {
        include: { academicYear: true, class: true, section: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
}

export async function updateStudent(
  schoolId: string,
  id: string,
  payload: UpdateStudentInput
) {
  await ensureStudentExists(schoolId, id);

  if (payload.enrollment && !payload.enrollment.academicYearId) {
    throw new ApiError(400, "academicYearId is required to update enrollment");
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (payload.profile) {
        await upsertStudentProfile(tx, id, payload.profile);
      }

      if (payload.parentId || payload.parent) {
        const parentInfo = await resolveParentId(
          tx,
          schoolId,
          payload.parentId,
          payload.parent
        );
        if (!parentInfo.parentId) {
          throw new ApiError(400, "Parent information is required");
        }
        await ensureParentLink(tx, {
          parentId: parentInfo.parentId,
          studentId: id,
          isPrimary: parentInfo.isPrimary,
        });
      }

      if (payload.enrollment) {
        const academicYearId = payload.enrollment.academicYearId;
        if (!academicYearId) {
          throw new ApiError(400, "academicYearId is required to update enrollment");
        }

        const existing = await getEnrollmentForStudent(tx, id, academicYearId);
        const classId = payload.enrollment.classId ?? existing?.classId;
        const sectionId = payload.enrollment.sectionId ?? existing?.sectionId;

        if (!classId || !sectionId) {
          throw new ApiError(400, "classId and sectionId are required for enrollment update");
        }

        const enrollmentPayload: EnrollmentInput = {
          academicYearId,
          classId,
          sectionId,
          rollNumber: payload.enrollment.rollNumber ?? existing?.rollNumber ?? undefined,
          isDetained: payload.enrollment.isDetained,
          promotionStatus: payload.enrollment.promotionStatus,
        };

        await ensureEnrollmentIsValid(schoolId, enrollmentPayload);
        await ensureRollNumberAvailable({
          sectionId: enrollmentPayload.sectionId,
          rollNumber: enrollmentPayload.rollNumber,
          excludeId: existing?.id,
        });

        if (existing) {
          await tx.studentEnrollment.update({
            where: { id: existing.id },
            data: {
              classId: enrollmentPayload.classId,
              sectionId: enrollmentPayload.sectionId,
              rollNumber: enrollmentPayload.rollNumber,
              ...(payload.enrollment.isDetained !== undefined
                ? { isDetained: payload.enrollment.isDetained }
                : {}),
              ...(payload.enrollment.promotionStatus !== undefined
                ? { promotionStatus: payload.enrollment.promotionStatus }
                : {}),
            },
          });
        } else {
          await tx.studentEnrollment.create({
            data: {
              studentId: id,
              academicYearId: enrollmentPayload.academicYearId,
              classId: enrollmentPayload.classId,
              sectionId: enrollmentPayload.sectionId,
              rollNumber: enrollmentPayload.rollNumber,
              isDetained: payload.enrollment.isDetained ?? false,
              promotionStatus: payload.enrollment.promotionStatus,
            },
          });
        }
      }

      await tx.student.update({
        where: { id },
        data: {
          ...(payload.registrationNumber !== undefined
            ? { registrationNumber: payload.registrationNumber }
            : {}),
          ...(payload.admissionNumber !== undefined
            ? { admissionNumber: payload.admissionNumber }
            : {}),
          ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
          ...(payload.dateOfBirth !== undefined
            ? { dateOfBirth: payload.dateOfBirth }
            : {}),
          ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
          ...(payload.bloodGroup !== undefined ? { bloodGroup: payload.bloodGroup } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return getStudentById(schoolId, id);
}

export async function deleteStudent(schoolId: string, id: string) {
  await ensureStudentExists(schoolId, id);

  return prisma.student.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function getStudentTimetable(schoolId: string, studentId: string) {
  return listTimetableForStudent(schoolId, studentId);
}
