import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { hashPassword } from "@/utils/password";

const MAX_BULK_IMPORT_ROWS = 5000;
const DEFAULT_PARENT_PASSWORD =
  process.env.DEFAULT_PARENT_PASSWORD ?? crypto.randomBytes(18).toString("hex");

const HEADER_KEYS = [
  "full_name",
  "registration_number",
  "admission_number",
  "date_of_birth",
  "gender",
  "blood_group",
  "parent_mobile",
  "parent_name",
  "class_name",
  "section_name",
] as const;

type HeaderKey = (typeof HEADER_KEYS)[number];

type ParsedRow = {
  rowNumber: number;
  data: Record<string, string>;
};

type NormalizedRow = {
  rowNumber: number;
  fullName: string;
  registrationNumber: string;
  admissionNumber?: string;
  dateOfBirth: Date;
  gender: string;
  bloodGroup?: string;
  parentMobile: string;
  parentName?: string;
  className: string;
  sectionName: string;
  raw: Record<string, string>;
};

type ImportError = {
  row: number;
  reason: string;
  data: Record<string, string>;
};

type ImportResult = {
  successCount: number;
  failureCount: number;
  failures: ImportError[];
  failedCsv: string;
};

type PreviewResult = {
  totalRows: number;
  validRows: number;
  invalidRows: ImportError[];
  failedCsv: string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "");
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.trim().length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function buildRows(rawRows: string[][]): ParsedRow[] {
  if (rawRows.length === 0) {
    throw new ApiError(400, "File is empty");
  }

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((value) => normalizeHeader(String(value)));
  const headerKeys = headers.map((header) => {
    const match = HEADER_KEYS.find((key) => normalizeHeader(key) === header);
    return match ?? null;
  });

  const required = [
    "full_name",
    "registration_number",
    "date_of_birth",
    "gender",
    "parent_mobile",
    "class_name",
    "section_name",
  ] as const;

  const missing = required.filter((key) => !headerKeys.includes(key));
  if (missing.length > 0) {
    throw new ApiError(400, `Missing required columns: ${missing.join(", ")}`);
  }

  if (dataRows.length > MAX_BULK_IMPORT_ROWS) {
    throw new ApiError(400, `Maximum ${MAX_BULK_IMPORT_ROWS} rows allowed`);
  }

  return dataRows.map((rowValues, index) => {
    const rowData: Record<string, string> = {};
    rowValues.forEach((value, idx) => {
      const key = headerKeys[idx];
      if (!key) return;
      rowData[key] = String(value ?? "").trim();
    });
    return { rowNumber: index + 2, data: rowData };
  });
}

function normalizePhone(input?: string) {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

async function resolveAcademicYearId(schoolId: string, academicYearId?: string | null) {
  if (academicYearId) {
    const existing = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
      select: { id: true },
    });
    if (!existing) {
      throw new ApiError(400, "Academic year not found for this school");
    }
    return existing.id;
  }

  const active = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!active) {
    throw new ApiError(400, "Active academic year not found");
  }
  return active.id;
}

function parseIsoDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addError(errors: ImportError[], rowNumber: number, message: string, data: Record<string, string>) {
  const existing = errors.find((entry) => entry.row === rowNumber);
  if (existing) {
    if (!existing.reason.includes(message)) {
      existing.reason = `${existing.reason}; ${message}`;
    }
    return;
  }
  errors.push({ row: rowNumber, reason: message, data });
}

function detectCsvDuplicates(parsedRows: ParsedRow[], errors: ImportError[]) {
  const registrationMap = new Map<string, ParsedRow[]>();
  const admissionMap = new Map<string, ParsedRow[]>();

  parsedRows.forEach((row) => {
    const registration = row.data.registration_number?.trim();
    if (registration) {
      const list = registrationMap.get(registration) ?? [];
      list.push(row);
      registrationMap.set(registration, list);
    }

    const admission = row.data.admission_number?.trim();
    if (admission) {
      const list = admissionMap.get(admission) ?? [];
      list.push(row);
      admissionMap.set(admission, list);
    }
  });

  for (const [, rows] of registrationMap.entries()) {
    if (rows.length > 1) {
      rows.forEach((row) =>
        addError(errors, row.rowNumber, "Duplicate registration_number in file", row.data)
      );
    }
  }

  for (const [, rows] of admissionMap.entries()) {
    if (rows.length > 1) {
      rows.forEach((row) =>
        addError(errors, row.rowNumber, "Duplicate admission_number in file", row.data)
      );
    }
  }
}

async function getParentRoleId() {
  const role = await prisma.role.findFirst({
    where: { roleType: "PARENT" },
    select: { id: true },
  });

  if (!role) {
    throw new ApiError(500, "PARENT role missing");
  }

  return role.id;
}

function buildFailedCsv(errors: ImportError[]) {
  const headers = [
    "full_name",
    "registration_number",
    "admission_number",
    "date_of_birth",
    "gender",
    "blood_group",
    "parent_mobile",
    "parent_name",
    "class_name",
    "section_name",
    "error",
  ];

  const rows = errors.map((item) => {
    const rowData = item.data ?? {};
    const values = headers.slice(0, -1).map((key) =>
      String(rowData[key] ?? "").replace(/"/g, '""')
    );
    values.push(String(item.reason ?? "").replace(/"/g, '""'));
    return values.map((value) => `"${value}"`).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function normalizeRow(row: ParsedRow, errors: ImportError[]) {
  const raw = row.data;
  const fullName = raw.full_name?.trim();
  const registrationNumber = raw.registration_number?.trim();
  const admissionNumber = raw.admission_number?.trim() || undefined;
  const dateOfBirth = raw.date_of_birth?.trim();
  const gender = raw.gender?.trim();
  const bloodGroup = raw.blood_group?.trim() || undefined;
  const parentMobile = normalizePhone(raw.parent_mobile);
  const parentName = raw.parent_name?.trim() || undefined;
  const className = raw.class_name?.trim();
  const sectionName = raw.section_name?.trim();

  if (!fullName) {
    addError(errors, row.rowNumber, "full_name is required", raw);
    return null;
  }
  if (!registrationNumber) {
    addError(errors, row.rowNumber, "registration_number is required", raw);
    return null;
  }
  if (!dateOfBirth) {
    addError(errors, row.rowNumber, "date_of_birth is required", raw);
    return null;
  }
  if (!gender) {
    addError(errors, row.rowNumber, "gender is required", raw);
    return null;
  }
  if (!parentMobile) {
    addError(errors, row.rowNumber, "parent_mobile is required", raw);
    return null;
  }
  if (!/^\d{10,15}$/.test(parentMobile)) {
    addError(errors, row.rowNumber, "Invalid parent_mobile", raw);
    return null;
  }

  const parsedDob = parseIsoDate(dateOfBirth);
  if (!parsedDob) {
    addError(errors, row.rowNumber, "Invalid date_of_birth format", raw);
    return null;
  }
  if (!className) {
    addError(errors, row.rowNumber, "class_name is required", raw);
    return null;
  }
  if (!sectionName) {
    addError(errors, row.rowNumber, "section_name is required", raw);
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    fullName,
    registrationNumber,
    admissionNumber,
    dateOfBirth: parsedDob,
    gender,
    bloodGroup,
    parentMobile,
    parentName,
    className,
    sectionName,
    raw,
  } as NormalizedRow;
}

async function importRow(
  schoolId: string,
  roleId: string,
  passwordHash: string,
  row: NormalizedRow,
  academicYearId: string
): Promise<{ created: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const existingRegistration = await tx.student.findFirst({
        where: { schoolId, registrationNumber: row.registrationNumber },
        select: { id: true },
      });
      if (existingRegistration) {
        throw new ApiError(409, "registration_number already exists");
      }

      if (row.admissionNumber) {
        const existingAdmission = await tx.student.findFirst({
          where: { schoolId, admissionNumber: row.admissionNumber },
          select: { id: true },
        });
        if (existingAdmission) {
          throw new ApiError(409, "admission_number already exists");
        }
      }

      const classRecord = await tx.class.findFirst({
        where: {
          schoolId,
          academicYearId,
          deletedAt: null,
          className: { equals: row.className, mode: "insensitive" },
        },
        select: { id: true, academicYearId: true },
      });

      if (!classRecord) {
        throw new ApiError(400, "Class not found");
      }

      const sectionRecord = await tx.section.findFirst({
        where: {
          classId: classRecord.id,
          deletedAt: null,
          sectionName: { equals: row.sectionName, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (!sectionRecord) {
        throw new ApiError(400, "Section not found in this class");
      }

      const student = await tx.student.create({
        data: {
          schoolId,
          registrationNumber: row.registrationNumber,
          admissionNumber: row.admissionNumber,
          fullName: row.fullName,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          bloodGroup: row.bloodGroup,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      let parent = await tx.parent.findFirst({
        where: { schoolId, mobile: row.parentMobile },
        select: { id: true, userId: true },
      });

      if (!parent) {
        parent = await tx.parent.create({
          data: {
            schoolId,
            fullName: row.parentName || "Parent",
            mobile: row.parentMobile,
            relationToStudent: "PARENT",
          },
          select: { id: true, userId: true },
        });
      }

      let parentUser = await tx.user.findFirst({
        where: { mobile: row.parentMobile },
        select: { id: true, schoolId: true, role: { select: { roleType: true } } },
      });

      if (parentUser && parentUser.schoolId !== schoolId) {
        throw new ApiError(409, "parent_mobile already used by another school");
      }

      if (parentUser?.role.roleType === "STUDENT") {
        throw new ApiError(409, "parent_mobile already used by a student account");
      }

      if (!parentUser) {
        parentUser = await tx.user.create({
          data: {
            schoolId,
            roleId,
            mobile: row.parentMobile,
            passwordHash,
            isActive: true,
            isMobileVerified: false,
          },
          select: { id: true, schoolId: true, role: { select: { roleType: true } } },
        });
      }

      if (!parent.userId) {
        await tx.parent.update({
          where: { id: parent.id },
          data: { userId: parentUser.id },
        });
      } else if (parent.userId !== parentUser.id) {
        throw new ApiError(409, "parent already linked to another user");
      }

      const existingLink = await tx.parentStudentLink.findFirst({
        where: { parentId: parent.id, studentId: student.id },
        select: { id: true },
      });

      if (!existingLink) {
        await tx.parentStudentLink.create({
          data: {
            parentId: parent.id,
            studentId: student.id,
            isPrimary: true,
          },
        });
      }

      await tx.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicYearId: classRecord.academicYearId,
          classId: classRecord.id,
          sectionId: sectionRecord.id,
        },
      });
    });

    return { created: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { created: false, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { created: false, error: "Duplicate record" };
      }
    }
    return { created: false, error: "Failed to import student" };
  }
}

export function buildStudentImportTemplate() {
  const header =
    "full_name,registration_number,admission_number,date_of_birth,gender,blood_group,parent_mobile,parent_name,class_name,section_name";
  const example =
    "Aru Singh,REG-001,ADM-001,2012-04-15,FEMALE,O+,9876543210,Sunita Singh,Class 5,A";
  return `${header}\n${example}`;
}

export async function previewStudentsFromCsv(
  schoolId: string,
  buffer: Buffer,
  academicYearId?: string | null
): Promise<PreviewResult> {
  const rawRows = parseCsv(buffer.toString("utf8"));
  const parsedRows = buildRows(rawRows);
  const errors: ImportError[] = [];
  const resolvedAcademicYearId = await resolveAcademicYearId(schoolId, academicYearId);

  const normalized = parsedRows
    .map((row) => normalizeRow(row, errors))
    .filter((row): row is NormalizedRow => Boolean(row));

  detectCsvDuplicates(parsedRows, errors);

  if (normalized.length > 0) {
    const registrationNumbers = normalized.map((row) => row.registrationNumber);
    const existing = await prisma.student.findMany({
      where: { schoolId, registrationNumber: { in: registrationNumbers } },
      select: { registrationNumber: true },
    });
    const existingSet = new Set(existing.map((item) => item.registrationNumber));
    normalized.forEach((row) => {
      if (existingSet.has(row.registrationNumber)) {
        addError(errors, row.rowNumber, "registration_number already exists", row.raw);
      }
    });

    for (const row of normalized) {
      const classRecord = await prisma.class.findFirst({
        where: {
          schoolId,
          academicYearId: resolvedAcademicYearId,
          deletedAt: null,
          className: { equals: row.className, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!classRecord) {
        addError(errors, row.rowNumber, "Class not found", row.raw);
        continue;
      }
      const sectionRecord = await prisma.section.findFirst({
        where: {
          classId: classRecord.id,
          deletedAt: null,
          sectionName: { equals: row.sectionName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!sectionRecord) {
        addError(errors, row.rowNumber, "Section not found in this class", row.raw);
      }
    }
  }

  const invalidRows = errors;
  const invalidRowSet = new Set(invalidRows.map((row) => row.row));
  const validRows = parsedRows.length - invalidRowSet.size;

  return {
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    failedCsv: buildFailedCsv(invalidRows),
  };
}

export async function importStudentsFromCsv(
  schoolId: string,
  buffer: Buffer,
  academicYearId?: string | null
): Promise<ImportResult> {
  const rawRows = parseCsv(buffer.toString("utf8"));
  const parsedRows = buildRows(rawRows);
  const errors: ImportError[] = [];
  const resolvedAcademicYearId = await resolveAcademicYearId(schoolId, academicYearId);

  const normalized = parsedRows
    .map((row) => normalizeRow(row, errors))
    .filter((row): row is NormalizedRow => Boolean(row));

  detectCsvDuplicates(parsedRows, errors);

  const invalidRowSet = new Set(errors.map((entry) => entry.row));

  const roleId = await getParentRoleId();
  const passwordHash = await hashPassword(DEFAULT_PARENT_PASSWORD);

  let successCount = 0;

  for (const row of normalized) {
    if (invalidRowSet.has(row.rowNumber)) {
      continue;
    }
    const result = await importRow(
      schoolId,
      roleId,
      passwordHash,
      row,
      resolvedAcademicYearId
    );
    if (result.created) {
      successCount += 1;
      continue;
    }
    addError(errors, row.rowNumber, result.error ?? "Failed to import student", row.raw);
  }

  return {
    successCount,
    failureCount: errors.length,
    failures: errors,
    failedCsv: buildFailedCsv(errors),
  };
}
