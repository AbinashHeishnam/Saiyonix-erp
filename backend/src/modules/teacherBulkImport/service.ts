import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import { teacherImportFileSchema } from "./validation";

type ImportError = {
  row: number;
  message: string;
};

type ImportResult = {
  processed: number;
  created: number;
  failed: number;
  errors: ImportError[];
};

type PreviewResult = {
  processed: number;
  failed: number;
  errors: ImportError[];
};

async function isEmployeeIdTaken(schoolId: string, employeeId: string) {
  const existing = await prisma.teacher.findFirst({
    where: { schoolId, employeeId, deletedAt: null },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function importTeachers(schoolId: string, rows: unknown): Promise<ImportResult> {
  const parsedFile = teacherImportFileSchema.safeParse(rows);
  if (!parsedFile.success) {
    throw new ApiError(400, "Invalid teacher import payload");
  }

  const result: ImportResult = {
    processed: parsedFile.data.length,
    created: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < parsedFile.data.length; index += 1) {
    const rowIndex = index + 1;
    const row = parsedFile.data[index];

    try {
      if (await isEmployeeIdTaken(schoolId, row.employeeId)) {
        result.failed += 1;
        result.errors.push({
          row: rowIndex,
          message: "Employee ID already exists for this school",
        });
        continue;
      }

      await prisma.teacher.create({
        data: {
          schoolId,
          fullName: row.fullName,
          employeeId: row.employeeId,
          gender: row.gender,
          designation: row.designation,
          department: row.department,
          joiningDate: row.joiningDate ? new Date(row.joiningDate) : undefined,
          qualification: row.qualification,
          phone: row.phone,
          email: row.email,
          address: row.address,
          photoUrl: row.photoUrl,
        },
      });

      result.created += 1;
    } catch (error) {
      result.failed += 1;
      const message =
        error instanceof Error ? error.message : "Failed to import teacher";
      result.errors.push({ row: rowIndex, message });
    }
  }

  return result;
}

export async function previewTeachers(
  schoolId: string,
  rows: unknown
): Promise<PreviewResult> {
  const parsedFile = teacherImportFileSchema.safeParse(rows);
  if (!parsedFile.success) {
    throw new ApiError(400, "Invalid teacher import payload");
  }

  const result: PreviewResult = {
    processed: parsedFile.data.length,
    failed: 0,
    errors: [],
  };

  const seen = new Map<string, number[]>();
  parsedFile.data.forEach((row, index) => {
    const list = seen.get(row.employeeId) ?? [];
    list.push(index + 1);
    seen.set(row.employeeId, list);
  });

  for (const [, rowsWithId] of seen.entries()) {
    if (rowsWithId.length > 1) {
      rowsWithId.forEach((rowIndex) => {
        result.errors.push({
          row: rowIndex,
          message: "Duplicate employeeId in import file",
        });
      });
    }
  }

  const employeeIds = Array.from(seen.keys());
  if (employeeIds.length > 0) {
    const existing = await prisma.teacher.findMany({
      where: { schoolId, employeeId: { in: employeeIds }, deletedAt: null },
      select: { employeeId: true },
    });
    const existingSet = new Set(existing.map((item) => item.employeeId));
    parsedFile.data.forEach((row, index) => {
      if (existingSet.has(row.employeeId)) {
        result.errors.push({
          row: index + 1,
          message: "Employee ID already exists for this school",
        });
      }
    });
  }

  result.failed = result.errors.length;
  return result;
}
