import type { Prisma, StudentStatus } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type { UpdateParentProfileInput } from "@/modules/parent/validation";

type ParentProfileStudent = {
  id: string;
  fullName: string;
  registrationNumber: string;
  admissionNumber: string | null;
  gender: string;
  dateOfBirth: Date;
  bloodGroup: string | null;
  status: StudentStatus;
  profile: {
    profilePhotoUrl: string | null;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactMobile: string | null;
    previousSchool: string | null;
    medicalInfo: Prisma.JsonValue | null;
  } | null;
};

function isFilled(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function calculateParentProfileCompletion(
  parent: {
    fullName: string | null;
    mobile: string | null;
    email: string | null;
    relationToStudent: string | null;
  },
  studentProfile?: {
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactMobile: string | null;
  } | null
) {
  const fields = [
    parent.fullName,
    parent.mobile,
    parent.email,
    parent.relationToStudent,
    studentProfile?.address ?? null,
    studentProfile?.emergencyContactName ?? null,
    studentProfile?.emergencyContactMobile ?? null,
  ];
  const filled = fields.filter(isFilled).length;
  return Math.round((filled / fields.length) * 100);
}

function buildParentUpdateData(payload: UpdateParentProfileInput) {
  const data: Record<string, unknown> = {};
  if (payload.fullName !== undefined) data.fullName = payload.fullName;
  if (payload.mobile !== undefined) data.mobile = payload.mobile;
  if (payload.email !== undefined) data.email = payload.email;
  if (payload.relationToStudent !== undefined) {
    data.relationToStudent = payload.relationToStudent;
  }
  return data;
}

function buildStudentProfileData(payload: UpdateParentProfileInput) {
  const data: Record<string, unknown> = {};
  if (payload.address !== undefined) data.address = payload.address;
  if (payload.emergencyContactName !== undefined) {
    data.emergencyContactName = payload.emergencyContactName;
  }
  if (payload.emergencyContactMobile !== undefined) {
    data.emergencyContactMobile = payload.emergencyContactMobile;
  }
  if (payload.previousSchool !== undefined) {
    data.previousSchool = payload.previousSchool;
  }
  if (payload.medicalInfo !== undefined) data.medicalInfo = payload.medicalInfo;
  return data;
}

async function getParentByUserId(schoolId: string, userId: string) {
  const parent = await prisma.parent.findFirst({
    where: { schoolId, userId },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      email: true,
      relationToStudent: true,
    },
  });

  if (!parent) {
    throw new ApiError(404, "Parent not found");
  }

  return parent;
}

async function getParentById(schoolId: string, parentId: string) {
  const parent = await prisma.parent.findFirst({
    where: { schoolId, id: parentId },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      email: true,
      relationToStudent: true,
    },
  });

  if (!parent) {
    throw new ApiError(404, "Parent not found");
  }

  return parent;
}

async function fetchLinkedStudents(parentId: string): Promise<ParentProfileStudent[]> {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId, student: { deletedAt: null } },
    select: {
      isPrimary: true,
      student: {
        select: {
          id: true,
          fullName: true,
          registrationNumber: true,
          admissionNumber: true,
          gender: true,
          dateOfBirth: true,
          bloodGroup: true,
          status: true,
          profile: {
            select: {
              profilePhotoUrl: true,
              address: true,
              emergencyContactName: true,
              emergencyContactMobile: true,
              previousSchool: true,
              medicalInfo: true,
            },
          },
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return links
    .map((link) => {
      if (!link.student) return null;
      return {
        id: link.student.id,
        fullName: link.student.fullName,
        registrationNumber: link.student.registrationNumber,
        admissionNumber: link.student.admissionNumber ?? null,
        gender: link.student.gender,
        dateOfBirth: link.student.dateOfBirth,
        bloodGroup: link.student.bloodGroup ?? null,
        status: link.student.status,
        profile: link.student.profile
          ? {
              profilePhotoUrl: link.student.profile.profilePhotoUrl ?? null,
              address: link.student.profile.address ?? null,
              emergencyContactName: link.student.profile.emergencyContactName ?? null,
              emergencyContactMobile: link.student.profile.emergencyContactMobile ?? null,
              previousSchool: link.student.profile.previousSchool ?? null,
              medicalInfo: link.student.profile.medicalInfo ?? null,
            }
          : null,
      };
    })
    .filter((student): student is ParentProfileStudent => student !== null);
}

export async function getParentProfileByUserId(schoolId: string, userId: string) {
  const parent = await getParentByUserId(schoolId, userId);
  const students = await fetchLinkedStudents(parent.id);
  const primaryProfile = students[0]?.profile ?? null;
  const completionPercentage = calculateParentProfileCompletion(parent, primaryProfile);

  return { parent, students, completionPercentage };
}

export async function getParentProfileById(schoolId: string, parentId: string) {
  const parent = await getParentById(schoolId, parentId);
  const students = await fetchLinkedStudents(parent.id);
  const primaryProfile = students[0]?.profile ?? null;
  const completionPercentage = calculateParentProfileCompletion(parent, primaryProfile);

  return { parent, students, completionPercentage };
}

async function updateParentProfileInternal(
  schoolId: string,
  parentId: string,
  payload: UpdateParentProfileInput
) {
  return await prisma.$transaction(async (tx) => {
    const parent = await tx.parent.findFirst({
      where: { id: parentId, schoolId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(404, "Parent not found");
    }

    const parentData = buildParentUpdateData(payload);
    if (Object.keys(parentData).length > 0) {
      await tx.parent.update({
        where: { id: parentId },
        data: parentData,
      });
    }

    const studentProfileData = buildStudentProfileData(payload);
    if (Object.keys(studentProfileData).length > 0) {
      const links = await tx.parentStudentLink.findMany({
        where: { parentId },
        select: { studentId: true },
      });

      for (const link of links) {
        await tx.studentProfile.upsert({
          where: { studentId: link.studentId },
          update: studentProfileData,
          create: { studentId: link.studentId, ...studentProfileData },
        });
      }
    }

    return getParentProfileById(schoolId, parentId);
  });
}

export async function updateParentProfileByUserId(
  schoolId: string,
  userId: string,
  payload: UpdateParentProfileInput
) {
  const parent = await getParentByUserId(schoolId, userId);
  return updateParentProfileInternal(schoolId, parent.id, payload);
}

export async function updateParentProfileById(
  schoolId: string,
  parentId: string,
  payload: UpdateParentProfileInput
) {
  await getParentById(schoolId, parentId);
  return updateParentProfileInternal(schoolId, parentId, payload);
}

export async function updateStudentPhotoByParentUserId(
  schoolId: string,
  userId: string,
  studentId: string,
  photoUrl: string
) {
  const parent = await getParentByUserId(schoolId, userId);
  const link = await prisma.parentStudentLink.findFirst({
    where: {
      parentId: parent.id,
      studentId,
      student: { schoolId, deletedAt: null },
    },
    select: { studentId: true },
  });

  if (!link) {
    throw new ApiError(403, "Forbidden: student not linked");
  }

  const profile = await prisma.studentProfile.findFirst({
    where: { studentId },
    select: { medicalInfo: true },
  });
  const info = profile?.medicalInfo as { idCard?: { photoLocked?: boolean } } | null;
  if (info?.idCard?.photoLocked) {
    throw new ApiError(403, "Photo changes are locked. Contact admin to reset.");
  }
  const nextInfo = {
    ...(profile?.medicalInfo && typeof profile.medicalInfo === "object" ? profile.medicalInfo : {}),
    idCard: {
      ...(info?.idCard ?? {}),
      photoLocked: true,
    },
  };

  await prisma.studentProfile.upsert({
    where: { studentId },
    update: { profilePhotoUrl: photoUrl, medicalInfo: nextInfo },
    create: { studentId, profilePhotoUrl: photoUrl, medicalInfo: nextInfo },
  });

  return { photoUrl };
}

export async function listParents(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = { schoolId };

  const [items, total] = await prisma.$transaction([
    prisma.parent.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        mobile: true,
        email: true,
        relationToStudent: true,
        _count: { select: { studentLinks: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.parent.count({ where }),
  ]);

  const mapped = items.map((item) => ({
    id: item.id,
    fullName: item.fullName,
    mobile: item.mobile,
    email: item.email,
    relationToStudent: item.relationToStudent,
    studentCount: item._count.studentLinks,
  }));

  return { items: mapped, total };
}
