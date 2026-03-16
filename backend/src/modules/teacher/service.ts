import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { listTimetableForTeacher } from "../timetableSlot/service";
import type {
  CreateTeacherInput,
  UpdateTeacherInput,
  UpdateTeacherStatusInput,
} from "./validation";

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
  await getTeacherById(schoolId, id);

  return prisma.teacher.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function updateTeacherStatus(
  schoolId: string,
  id: string,
  payload: UpdateTeacherStatusInput
) {
  await getTeacherById(schoolId, id);

  return prisma.teacher.update({
    where: { id, schoolId },
    data: {
      status: payload.status,
    },
  });
}

export async function getTeacherTimetable(schoolId: string, id: string) {
  return listTimetableForTeacher(schoolId, id);
}
