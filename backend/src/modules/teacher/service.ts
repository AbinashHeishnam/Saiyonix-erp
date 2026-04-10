import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { listTimetableForTeacher } from "@/modules/timetableSlot/service";
import type {
  CreateTeacherInput,
  UpdateTeacherInput,
  UpdateTeacherProfileInput,
  UpdateTeacherStatusInput,
} from "@/modules/teacher/validation";

function toPublicUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/v1/files/secure")) return value;
  return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}

const teacherProfileSelect = {
  id: true,
  fullName: true,
  employeeId: true,
  designation: true,
  department: true,
  joiningDate: true,
  status: true,
  gender: true,
  phone: true,
  email: true,
  address: true,
  photoUrl: true,
  qualification: true,
  totalExperience: true,
  academicExperience: true,
  industryExperience: true,
  researchInterest: true,
  nationalPublications: true,
  internationalPublications: true,
  bookChapters: true,
  projects: true,
  teacherProfile: {
    select: {
      qualification: true,
      address: true,
      photoUrl: true,
      emergencyContactMobile: true,
    },
  },
} as const;

function calculateProfileCompletion(teacher: {
  qualification?: string | null;
  totalExperience?: number | null;
  academicExperience?: number | null;
  industryExperience?: number | null;
  researchInterest?: string | null;
  nationalPublications?: number | null;
  internationalPublications?: number | null;
  bookChapters?: number | null;
  projects?: number | null;
}) {
  const fields = [
    teacher.qualification,
    teacher.totalExperience,
    teacher.academicExperience,
    teacher.industryExperience,
    teacher.researchInterest,
    teacher.nationalPublications,
    teacher.internationalPublications,
    teacher.bookChapters,
    teacher.projects,
  ];

  const filled = fields.filter((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  }).length;

  return Math.round((filled / 9) * 100);
}

export type TeacherIdCardData = {
  school: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  teacher: {
    id: string;
    fullName: string;
    employeeId: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: Date | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
  };
};

function mapTeacherToIdCard(
  school: { name: string; logoUrl: string | null; address: string | null; phone: string | null },
  teacher: {
    id: string;
    fullName: string;
    employeeId: string;
    designation: string | null;
    department: string | null;
    joiningDate: Date | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
    teacherProfile: { photoUrl: string | null; address: string | null } | null;
  }
): TeacherIdCardData {
  const resolvedPhoto = teacher.photoUrl ?? teacher.teacherProfile?.photoUrl ?? null;
  const resolvedAddress = teacher.address ?? teacher.teacherProfile?.address ?? null;

  return {
    school,
    teacher: {
      id: teacher.id,
      fullName: teacher.fullName,
      employeeId: teacher.employeeId ?? null,
      designation: teacher.designation ?? null,
      department: teacher.department ?? null,
      joiningDate: teacher.joiningDate ?? null,
      phone: teacher.phone ?? null,
      email: teacher.email ?? null,
      address: resolvedAddress,
      photoUrl: toPublicUrl(resolvedPhoto),
    },
  };
}

export async function listTeacherIdCardsForAdmin(schoolId: string): Promise<TeacherIdCardData[]> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, address: true, phone: true },
  });

  if (!school) {
    throw new ApiError(404, "School not found");
  }

  const teachers = await prisma.teacher.findMany({
    where: { schoolId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      designation: true,
      department: true,
      joiningDate: true,
      phone: true,
      email: true,
      address: true,
      photoUrl: true,
      teacherProfile: { select: { photoUrl: true, address: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return teachers.map((teacher) => mapTeacherToIdCard(school, teacher));
}

export async function getTeacherIdCardForUser(
  schoolId: string,
  userId: string
): Promise<TeacherIdCardData> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, address: true, phone: true },
  });

  if (!school) {
    throw new ApiError(404, "School not found");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      designation: true,
      department: true,
      joiningDate: true,
      phone: true,
      email: true,
      address: true,
      photoUrl: true,
      teacherProfile: { select: { photoUrl: true, address: true } },
    },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return mapTeacherToIdCard(school, teacher);
}

export async function updateTeacherIdCardDetailsAdmin(
  schoolId: string,
  teacherId: string,
  payload: {
    fullName?: string;
    employeeId?: string;
    designation?: string;
    department?: string;
    joiningDate?: Date;
    phone?: string;
    email?: string;
    address?: string;
  }
) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  await prisma.teacher.update({
    where: { id: teacherId },
    data: {
      ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
      ...(payload.employeeId !== undefined ? { employeeId: payload.employeeId } : {}),
      ...(payload.designation !== undefined ? { designation: payload.designation } : {}),
      ...(payload.department !== undefined ? { department: payload.department } : {}),
      ...(payload.joiningDate !== undefined ? { joiningDate: payload.joiningDate } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.address !== undefined ? { address: payload.address } : {}),
    },
  });
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, address: true, phone: true },
  });
  const updated = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      designation: true,
      department: true,
      joiningDate: true,
      phone: true,
      email: true,
      address: true,
      photoUrl: true,
      teacherProfile: { select: { photoUrl: true, address: true } },
    },
  });
  if (!school || !updated) {
    throw new ApiError(404, "Teacher not found");
  }
  return mapTeacherToIdCard(school, updated);
}

export async function updateTeacherIdCardPhotoAdmin(
  schoolId: string,
  teacherId: string,
  photoUrl: string
) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: { id: true, userId: true },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  await prisma.teacher.update({
    where: { id: teacherId },
    data: { photoUrl },
  });
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, address: true, phone: true },
  });
  const updated = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      designation: true,
      department: true,
      joiningDate: true,
      phone: true,
      email: true,
      address: true,
      photoUrl: true,
      teacherProfile: { select: { photoUrl: true, address: true } },
    },
  });
  if (!school || !updated) {
    throw new ApiError(404, "Teacher not found");
  }
  return mapTeacherToIdCard(school, updated);
}

function mapPrismaError(error: unknown): never {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "P2002") {
    throw new ApiError(409, "Teacher with this employee ID already exists");
  }

  throw error;
}

export async function createTeacher(schoolId: string, payload: CreateTeacherInput) {
  try {
    return await prisma.teacher.create({
      data: {
        schoolId,
        employeeId: payload.employeeId,
        fullName: payload.fullName,
        designation: payload.designation,
        department: payload.department,
        joiningDate: payload.joiningDate,
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function getTeachers(
  schoolId: string,
  academicYearId?: string,
  pagination?: { skip: number; take: number }
) {
  const where = {
    schoolId,
    deletedAt: null,
  };

  const [items, total] = await prisma.$transaction([
    prisma.teacher.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.teacher.count({ where }),
  ]);

  return { items, total };
}

export async function getTeacherById(schoolId: string, id: string) {
  const teacher = await prisma.teacher.findFirst({
    where: {
      id,
      schoolId,
      deletedAt: null,
    },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
}

export async function updateTeacher(
  schoolId: string,
  id: string,
  payload: UpdateTeacherInput
) {
  await getTeacherById(schoolId, id);

  try {
    return await prisma.teacher.update({
      where: { id },
      data: {
        ...(payload.employeeId !== undefined ? { employeeId: payload.employeeId } : {}),
        ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
        ...(payload.designation !== undefined ? { designation: payload.designation } : {}),
        ...(payload.department !== undefined ? { department: payload.department } : {}),
        ...(payload.joiningDate !== undefined ? { joiningDate: payload.joiningDate } : {}),
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteTeacher(schoolId: string, id: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { id: true, userId: true },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacher.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    if (teacher.userId) {
      await tx.user.update({
        where: { id: teacher.userId },
        data: { isActive: false },
      });
    }

    return updated;
  });
}

export async function updateTeacherStatus(
  schoolId: string,
  id: string,
  payload: UpdateTeacherStatusInput
) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { id: true, userId: true },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacher.update({
      where: { id, schoolId },
      data: {
        status: payload.status,
      },
    });

    if (teacher.userId) {
      await tx.user.update({
        where: { id: teacher.userId },
        data: { isActive: payload.status === "ACTIVE" },
      });
    }

    return updated;
  });
}

export async function getTeacherTimetable(schoolId: string, id: string) {
  return listTimetableForTeacher(schoolId, id);
}

export async function getTeacherProfileByUserId(schoolId: string, userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: teacherProfileSelect,
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  const normalized = {
    ...teacher,
    photoUrl: toPublicUrl(teacher.photoUrl),
    teacherProfile: teacher.teacherProfile
      ? {
          ...teacher.teacherProfile,
          photoUrl: toPublicUrl(teacher.teacherProfile.photoUrl),
        }
      : teacher.teacherProfile,
  };

  return {
    teacher: normalized,
    profileCompletion: calculateProfileCompletion(teacher),
  };
}

export async function getTeacherProfileById(schoolId: string, teacherId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: teacherProfileSelect,
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  const normalized = {
    ...teacher,
    photoUrl: toPublicUrl(teacher.photoUrl),
    teacherProfile: teacher.teacherProfile
      ? {
          ...teacher.teacherProfile,
          photoUrl: toPublicUrl(teacher.teacherProfile.photoUrl),
        }
      : teacher.teacherProfile,
  };

  return {
    teacher: normalized,
    profileCompletion: calculateProfileCompletion(teacher),
  };
}

export async function updateTeacherProfileById(
  schoolId: string,
  teacherId: string,
  payload: UpdateTeacherProfileInput
) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  const updated = await prisma.teacher.update({
    where: { id: teacherId },
    data: {
      ...(payload.designation !== undefined ? { designation: payload.designation } : {}),
      ...(payload.qualification !== undefined ? { qualification: payload.qualification } : {}),
      ...(payload.totalExperience !== undefined
        ? { totalExperience: payload.totalExperience }
        : {}),
      ...(payload.academicExperience !== undefined
        ? { academicExperience: payload.academicExperience }
        : {}),
      ...(payload.industryExperience !== undefined
        ? { industryExperience: payload.industryExperience }
        : {}),
      ...(payload.researchInterest !== undefined
        ? { researchInterest: payload.researchInterest }
        : {}),
      ...(payload.nationalPublications !== undefined
        ? { nationalPublications: payload.nationalPublications }
        : {}),
      ...(payload.internationalPublications !== undefined
        ? { internationalPublications: payload.internationalPublications }
        : {}),
      ...(payload.bookChapters !== undefined ? { bookChapters: payload.bookChapters } : {}),
      ...(payload.projects !== undefined ? { projects: payload.projects } : {}),
    },
    select: teacherProfileSelect,
  });

  return {
    teacher: updated,
    profileCompletion: calculateProfileCompletion(updated),
  };
}

export async function getTeacherPublicProfile(id: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id, deletedAt: null },
    select: teacherProfileSelect,
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
}
