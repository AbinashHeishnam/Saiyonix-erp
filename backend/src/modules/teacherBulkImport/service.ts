import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logger } from "@/utils/logger";
import {
  teacherBulkImportRowSchema,
  type TeacherBulkImportRowInput,
} from "@/modules/teacherBulkImport/validation";

const MAX_BULK_IMPORT_ROWS = 500;
const DEFAULT_TEACHER_PASSWORD =
  process.env.DEFAULT_TEACHER_PASSWORD ?? crypto.randomBytes(18).toString("hex");

const HEADER_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "gender",
  "qualification",
  "experienceYears",
  "address",
] as const;

type HeaderKey = (typeof HEADER_KEYS)[number];

type ParsedRow = {
  rowNumber: number;
  data: Record<string, string>;
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
};

type PreviewResult = {
  totalRows: number;
  validRows: number;
  invalidRows: ImportError[];
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

  if (!headerKeys.includes("firstName") || !headerKeys.includes("lastName")) {
    throw new ApiError(400, "Missing required columns: firstName, lastName");
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
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  return digits.length ? digits : undefined;
}

function normalizeEmail(input?: string) {
  if (!input) return undefined;
  return input.trim().toLowerCase();
}

function normalizeGender(input?: string) {
  if (!input) return undefined;
  const value = input.trim().toUpperCase();
  if (value === "MALE" || value === "M") return "MALE";
  if (value === "FEMALE" || value === "F") return "FEMALE";
  if (value === "OTHER" || value === "O") return "OTHER";
  return undefined;
}

function addError(
  errors: ImportError[],
  rowNumber: number,
  message: string,
  data: Record<string, string>
) {
  const existing = errors.find((entry) => entry.row === rowNumber);
  if (existing) {
    if (!existing.reason.includes(message)) {
      existing.reason = `${existing.reason}; ${message}`;
    }
    return;
  }
  errors.push({ row: rowNumber, reason: message, data });
}

function mapValidationMessage(messages: string[]) {
  if (messages.some((msg) => msg.toLowerCase().includes("required"))) {
    return "Required field missing";
  }
  return "Invalid data format";
}

function validateRow(row: ParsedRow, errors: ImportError[]) {
  const raw = row.data;
  const normalized: TeacherBulkImportRowInput = {
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    email: normalizeEmail(raw.email),
    phone: normalizePhone(raw.phone),
    gender: normalizeGender(raw.gender),
    qualification: raw.qualification?.trim() || undefined,
    experienceYears: raw.experienceYears?.trim() || undefined,
    address: raw.address?.trim() || undefined,
  };

  const result = teacherBulkImportRowSchema.safeParse(normalized);
  if (!result.success) {
    const message = mapValidationMessage(
      result.error.issues.map((issue) => issue.message)
    );
    addError(errors, row.rowNumber, message, row.data);
    return null;
  }

  return result.data;
}

function generateEmployeeId(rowNumber: number) {
  return `T-${Date.now()}-${rowNumber}-${uuidv4().slice(0, 6)}`;
}

async function getTeacherRoleId() {
  const role = await prisma.role.findUnique({
    where: { roleType: "TEACHER" },
    select: { id: true },
  });

  if (!role) {
    throw new ApiError(500, "TEACHER role missing");
  }

  return role.id;
}

type DbClient = typeof prisma;

async function ensureUniqueUser(
  tx: DbClient,
  params: { email?: string; phone?: string }
) {
  if (!params.email && !params.phone) {
    return;
  }

  const existing = await tx.user.findFirst({
    where: {
      OR: [
        ...(params.email ? [{ email: params.email }] : []),
        ...(params.phone ? [{ mobile: params.phone }] : []),
      ],
    },
    select: { email: true, mobile: true },
  });

  if (
    (existing?.email && params.email && existing.email === params.email) ||
    (existing?.mobile && params.phone && existing.mobile === params.phone)
  ) {
    throw new ApiError(409, "Duplicate email or phone");
  }
}

function normalizeForDuplicateCheck(row: ParsedRow) {
  const email = normalizeEmail(row.data.email);
  const phone = normalizePhone(row.data.phone);
  return { email, phone };
}

function detectCsvDuplicates(parsedRows: ParsedRow[], errors: ImportError[]) {
  const emailMap = new Map<string, ParsedRow[]>();
  const phoneMap = new Map<string, ParsedRow[]>();

  parsedRows.forEach((row) => {
    const { email, phone } = normalizeForDuplicateCheck(row);
    if (email) {
      const list = emailMap.get(email) ?? [];
      list.push(row);
      emailMap.set(email, list);
    }
    if (phone) {
      const list = phoneMap.get(phone) ?? [];
      list.push(row);
      phoneMap.set(phone, list);
    }
  });

  for (const [, rows] of emailMap.entries()) {
    if (rows.length > 1) {
      rows.forEach((row) =>
        addError(errors, row.rowNumber, "Duplicate in file", row.data)
      );
    }
  }

  for (const [, rows] of phoneMap.entries()) {
    if (rows.length > 1) {
      rows.forEach((row) =>
        addError(errors, row.rowNumber, "Duplicate in file", row.data)
      );
    }
  }
}

export function buildTeacherImportTemplate() {
  const header =
    "firstName,lastName,email,phone,gender,qualification,experienceYears,address";
  const example =
    "John,Doe,john@example.com,9876543210,Male,B.Ed,5,Imphal East";
  return `${header}\n${example}`;
}

export async function previewTeachersFromCsv(
  schoolId: string,
  buffer: Buffer
): Promise<PreviewResult> {
  const rawRows = parseCsv(buffer.toString("utf8"));
  const parsedRows = buildRows(rawRows);

  const errors: ImportError[] = [];

  parsedRows.forEach((row) => {
    validateRow(row, errors);
  });
  detectCsvDuplicates(parsedRows, errors);

  const invalidRows = errors;
  const validRows =
    parsedRows.length - new Set(invalidRows.map((row) => row.row)).size;

  return {
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
  };
}

export async function importTeachersFromCsv(
  schoolId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rawRows = parseCsv(buffer.toString("utf8"));
  const parsedRows = buildRows(rawRows);

  const importId = uuidv4();
  const errors: ImportError[] = [];
  const normalizedRows = parsedRows
    .map((row) => ({
      rowNumber: row.rowNumber,
      data: validateRow(row, errors),
      raw: row.data,
    }))
    .filter((row) => row.data);

  detectCsvDuplicates(parsedRows, errors);
  const invalidRowSet = new Set(errors.map((entry) => entry.row));

  const roleId = await getTeacherRoleId();
  const passwordHash = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, 10);

  let successCount = 0;

  for (const row of normalizedRows) {
    if (invalidRowSet.has(row.rowNumber)) {
      continue;
    }
    const data = row.data as TeacherBulkImportRowInput;
    try {
      await prisma.$transaction(async (tx) => {
        await ensureUniqueUser(tx as DbClient, {
          email: data.email,
          phone: data.phone,
        });

        const user = await tx.user.create({
          data: {
            schoolId,
            roleId,
            email: data.email,
            mobile: data.phone,
            passwordHash,
            mustChangePassword: true,
            isMobileVerified: false,
            isActive: true,
          },
          select: { id: true },
        });

        const teacher = await tx.teacher.create({
          data: {
            schoolId,
            userId: user.id,
            employeeId: generateEmployeeId(row.rowNumber),
            fullName: `${data.firstName} ${data.lastName}`.trim(),
            gender: data.gender,
            qualification: data.qualification,
            phone: data.phone,
            email: data.email,
            address: data.address,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        if (data.qualification || data.address) {
          await tx.teacherProfile.create({
            data: {
              teacherId: teacher.id,
              qualification: data.qualification,
              address: data.address,
            },
          });
        }
      });

      successCount += 1;
    } catch (error) {
      let message = "Failed to import teacher";
      if (error instanceof ApiError) {
        message = error.message;
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          message = "Email or phone already exists";
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      addError(errors, row.rowNumber, message, row.raw);
    }
  }

  logger.info("[teacherBulkImport] completed", {
    importId,
    totalRows: parsedRows.length,
    successCount,
    failureCount: errors.length,
    timestamp: new Date().toISOString(),
    schoolId,
  });

  return {
    successCount,
    failureCount: errors.length,
    failures: errors,
  };
}
