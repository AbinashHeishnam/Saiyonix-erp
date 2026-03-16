import * as XLSX from "xlsx";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import {
  studentBulkImportRowSchema,
  type StudentBulkImportRowInput,
} from "./validation";

type PrismaError = { code?: string; meta?: { target?: string[] | string } };

type ParsedRow = {
  rowNumber: number;
  data: StudentBulkImportRowInput;
};

type NormalizedRow = {
  rowNumber: number;
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  parentName: string;
  parentMobile: string;
  parentEmail?: string;
  relationToStudent?: string;
  bloodGroup?: string;
  address?: string;
  registrationNumber?: string;
  admissionNumber?: string;
  rollNumber?: number;
  photoPath?: string;
};

type ImportError = {
  rowNumber: number;
  errors: string[];
};

type ImportResult = {
  totalRows: number;
  processed: number;
  created: number;
  failed: number;
  errors: ImportError[];
};

type PreviewResult = {
  totalRows: number;
  processed: number;
  failed: number;
  errors: ImportError[];
};

type FileType = "csv" | "xlsx";

type ImportOptions = {
  batchSize: number;
};

const MAX_BULK_IMPORT_ROWS = 5000;

const headerAliases: Record<string, keyof StudentBulkImportRowInput> = {
  "full name": "fullName",
  "fullname": "fullName",
  "student name": "fullName",
  "name": "fullName",
  "date of birth": "dateOfBirth",
  "dateofbirth": "dateOfBirth",
  "dob": "dateOfBirth",
  "gender": "gender",
  "academic year id": "academicYearId",
  "academicyearid": "academicYearId",
  "class id": "classId",
  "classid": "classId",
  "section id": "sectionId",
  "sectionid": "sectionId",
  "parent name": "parentName",
  "parentname": "parentName",
  "guardian name": "parentName",
  "parent mobile": "parentMobile",
  "parentmobile": "parentMobile",
  "parent phone": "parentMobile",
  "parent email": "parentEmail",
  "relation": "relationToStudent",
  "relation to student": "relationToStudent",
  "blood group": "bloodGroup",
  "address": "address",
  "registration number": "registrationNumber",
  "registrationnumber": "registrationNumber",
  "admission number": "admissionNumber",
  "admissionnumber": "admissionNumber",
  "roll number": "rollNumber",
  "rollnumber": "rollNumber",
  "photo path": "photoPath",
  "photo": "photoPath",
};

const requiredHeaders: (keyof StudentBulkImportRowInput)[] = [
  "fullName",
  "dateOfBirth",
  "gender",
  "academicYearId",
  "classId",
  "sectionId",
  "parentName",
  "parentMobile",
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, " ");
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

function parseFile(buffer: Buffer, fileType: FileType) {
  if (fileType === "csv") {
    return parseCsv(buffer.toString("utf8"));
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
}

function buildRows(rawRows: string[][]): ParsedRow[] {
  if (rawRows.length === 0) {
    throw new ApiError(400, "File is empty");
  }

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((value) => normalizeHeader(String(value)));
  const headerKeys = headers.map((header) => headerAliases[header]);

  const missingHeaders = requiredHeaders.filter(
    (required) => !headerKeys.includes(required)
  );

  if (missingHeaders.length > 0) {
    throw new ApiError(
      400,
      `Missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  return dataRows.map((rowValues, index) => {
    const rowData: Record<string, string> = {};

    rowValues.forEach((value, idx) => {
      const key = headerKeys[idx];
      if (!key) {
        return;
      }
      rowData[key] = String(value ?? "").trim();
    });

    return {
      rowNumber: index + 2,
      data: rowData as StudentBulkImportRowInput,
    };
  });
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("/")) {
    const [day, month, year] = trimmed.split("/").map((part) => Number(part));
    if (!day || !month || !year) {
      return null;
    }
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeRows(rows: ParsedRow[]) {
  const errors: ImportError[] = [];
  const normalized: NormalizedRow[] = [];

  for (const row of rows) {
    const result = studentBulkImportRowSchema.safeParse(row.data);
    if (!result.success) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: result.error.issues.map((issue) => issue.message),
      });
      continue;
    }

    const dateOfBirth = parseDate(result.data.dateOfBirth);
    if (!dateOfBirth) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: ["Invalid dateOfBirth"],
      });
      continue;
    }

    const rollNumber = result.data.rollNumber
      ? Number(result.data.rollNumber)
      : undefined;

    if (rollNumber !== undefined && Number.isNaN(rollNumber)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: ["Invalid rollNumber"],
      });
      continue;
    }

    normalized.push({
      rowNumber: row.rowNumber,
      fullName: result.data.fullName,
      dateOfBirth,
      gender: result.data.gender,
      academicYearId: result.data.academicYearId,
      classId: result.data.classId,
      sectionId: result.data.sectionId,
      parentName: result.data.parentName,
      parentMobile: result.data.parentMobile,
      parentEmail: result.data.parentEmail,
      relationToStudent: result.data.relationToStudent,
      bloodGroup: result.data.bloodGroup,
      address: result.data.address,
      registrationNumber: result.data.registrationNumber,
      admissionNumber: result.data.admissionNumber,
      rollNumber: rollNumber ?? undefined,
      photoPath: result.data.photoPath,
    });
  }

  return { normalized, errors };
}

function addError(errors: ImportError[], rowNumber: number, message: string) {
  const existing = errors.find((entry) => entry.rowNumber === rowNumber);
  if (existing) {
    existing.errors.push(message);
    return;
  }
  errors.push({ rowNumber, errors: [message] });
}

function detectDuplicates(
  rows: NormalizedRow[],
  errors: ImportError[]
) {
  const registrationMap = new Map<string, NormalizedRow[]>();
  const admissionMap = new Map<string, NormalizedRow[]>();

  for (const row of rows) {
    if (row.registrationNumber) {
      const list = registrationMap.get(row.registrationNumber) ?? [];
      list.push(row);
      registrationMap.set(row.registrationNumber, list);
    }
    if (row.admissionNumber) {
      const list = admissionMap.get(row.admissionNumber) ?? [];
      list.push(row);
      admissionMap.set(row.admissionNumber, list);
    }
  }

  for (const [value, list] of registrationMap.entries()) {
    if (list.length > 1) {
      list.forEach((row) =>
        addError(errors, row.rowNumber, `Duplicate registrationNumber: ${value}`)
      );
    }
  }

  for (const [value, list] of admissionMap.entries()) {
    if (list.length > 1) {
      list.forEach((row) =>
        addError(errors, row.rowNumber, `Duplicate admissionNumber: ${value}`)
      );
    }
  }
}

function chunkRows<T>(rows: T[], batchSize: number) {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}

async function loadSchoolLookup(schoolId: string) {
  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: { id: true, code: true },
  });

  if (!school) {
    throw new ApiError(400, "School not found");
  }

  return school;
}

async function validateReferences(schoolId: string, rows: NormalizedRow[]) {
  const academicYearIds = Array.from(
    new Set(rows.map((row) => row.academicYearId))
  );
  const classIds = Array.from(new Set(rows.map((row) => row.classId)));
  const sectionIds = Array.from(new Set(rows.map((row) => row.sectionId)));

  const [academicYears, classes, sections] = await Promise.all([
    prisma.academicYear.findMany({
      where: { schoolId, id: { in: academicYearIds } },
      select: { id: true },
    }),
    prisma.class.findMany({
      where: { schoolId, deletedAt: null, id: { in: classIds } },
      select: { id: true, academicYearId: true },
    }),
    prisma.section.findMany({
      where: {
        id: { in: sectionIds },
        deletedAt: null,
        class: { schoolId, deletedAt: null },
      },
      select: { id: true, classId: true },
    }),
  ]);

  const academicYearSet = new Set(academicYears.map((item) => item.id));
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const sectionMap = new Map(sections.map((item) => [item.id, item]));

  return { academicYearSet, classMap, sectionMap };
}

async function resolveExistingDuplicates(
  schoolId: string,
  rows: NormalizedRow[],
  errors: ImportError[]
) {
  const registrationNumbers = rows
    .map((row) => row.registrationNumber)
    .filter((value): value is string => Boolean(value));
  const admissionNumbers = rows
    .map((row) => row.admissionNumber)
    .filter((value): value is string => Boolean(value));

  if (registrationNumbers.length > 0) {
    const existing = await prisma.student.findMany({
      where: { schoolId, registrationNumber: { in: registrationNumbers } },
      select: { registrationNumber: true },
    });
    const existingSet = new Set(existing.map((item) => item.registrationNumber));
    rows.forEach((row) => {
      if (row.registrationNumber && existingSet.has(row.registrationNumber)) {
        addError(errors, row.rowNumber, "Registration number already exists");
      }
    });
  }

  if (admissionNumbers.length > 0) {
    const existing = await prisma.student.findMany({
      where: { schoolId, admissionNumber: { in: admissionNumbers } },
      select: { admissionNumber: true },
    });
    const existingSet = new Set(
      existing.map((item) => item.admissionNumber).filter(Boolean)
    );
    rows.forEach((row) => {
      if (row.admissionNumber && existingSet.has(row.admissionNumber)) {
        addError(errors, row.rowNumber, "Admission number already exists");
      }
    });
  }
}

async function resolveExistingRollNumbers(rows: NormalizedRow[], errors: ImportError[]) {
  const bySection = new Map<string, Set<number>>();
  rows.forEach((row) => {
    if (row.rollNumber) {
      const set = bySection.get(row.sectionId) ?? new Set();
      set.add(row.rollNumber);
      bySection.set(row.sectionId, set);
    }
  });

  for (const [sectionId, rollSet] of bySection.entries()) {
    const existing = await prisma.studentEnrollment.findMany({
      where: {
        sectionId,
        rollNumber: { in: Array.from(rollSet) },
      },
      select: { rollNumber: true },
    });
    const existingSet = new Set(existing.map((item) => item.rollNumber).filter(Boolean));

    rows.forEach((row) => {
      if (row.sectionId === sectionId && row.rollNumber) {
        if (existingSet.has(row.rollNumber)) {
          addError(errors, row.rowNumber, "Roll number already exists in section");
        }
      }
    });
  }
}

async function buildSequenceGenerator(schoolId: string, rows: NormalizedRow[]) {
  const school = await loadSchoolLookup(schoolId);
  const prefixReg = `${school.code}-REG-`;
  const prefixAdm = `${school.code}-ADM-`;

  const existing = await prisma.student.findMany({
    where: { schoolId },
    select: { registrationNumber: true, admissionNumber: true },
  });

  const extractMax = (values: (string | null)[], prefix: string) => {
    let max = 0;
    values.forEach((value) => {
      if (!value || !value.startsWith(prefix)) {
        return;
      }
      const numeric = Number(value.slice(prefix.length));
      if (!Number.isNaN(numeric)) {
        max = Math.max(max, numeric);
      }
    });
    return max;
  };

  const maxReg = extractMax(
    existing.map((item) => item.registrationNumber),
    prefixReg
  );
  const maxAdm = extractMax(
    existing.map((item) => item.admissionNumber ?? null),
    prefixAdm
  );

  let regCounter = maxReg + 1;
  let admCounter = maxAdm + 1;

  const pad = (value: number) => String(value).padStart(4, "0");

  rows.forEach((row) => {
    if (!row.registrationNumber) {
      row.registrationNumber = `${prefixReg}${pad(regCounter)}`;
      regCounter += 1;
    }
    if (!row.admissionNumber) {
      row.admissionNumber = `${prefixAdm}${pad(admCounter)}`;
      admCounter += 1;
    }
  });
}

async function assignRollNumbers(rows: NormalizedRow[]) {
  const sectionIds = Array.from(new Set(rows.map((row) => row.sectionId)));
  const rollMap = new Map<string, number>();

  for (const sectionId of sectionIds) {
    const existing = await prisma.studentEnrollment.aggregate({
      where: { sectionId },
      _max: { rollNumber: true },
    });
    rollMap.set(sectionId, (existing._max.rollNumber ?? 0) + 1);
  }

  rows.forEach((row) => {
    if (!row.rollNumber) {
      const current = rollMap.get(row.sectionId) ?? 1;
      row.rollNumber = current;
      rollMap.set(row.sectionId, current + 1);
    }
  });
}

function mapBulkImportError(error: unknown): string[] {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as PrismaError).code ?? "")
      : "";

  if (code === "P2002") {
    const target = (error as PrismaError).meta?.target ?? [];
    const targetList = Array.isArray(target) ? target : [target];

    if (targetList.includes("registrationNumber")) {
      return ["Registration number already exists"];
    }
    if (targetList.includes("admissionNumber")) {
      return ["Admission number already exists"];
    }
    if (targetList.includes("sectionId") && targetList.includes("rollNumber")) {
      return ["Roll number already exists in section"];
    }

    return ["Duplicate record"];
  }

  if (code === "P2003") {
    return ["Invalid relation reference"];
  }

  return ["Failed to import row due to transactional error"];
}

async function createRowWithChecks(
  schoolId: string,
  row: NormalizedRow
): Promise<{ created: boolean; errors?: string[] }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const errors: string[] = [];

      const existingRegistration = await tx.student.findFirst({
        where: { schoolId, registrationNumber: row.registrationNumber! },
        select: { id: true },
      });
      if (existingRegistration) {
        errors.push("Registration number already exists");
      }

      if (row.admissionNumber) {
        const existingAdmission = await tx.student.findFirst({
          where: { schoolId, admissionNumber: row.admissionNumber },
          select: { id: true },
        });
        if (existingAdmission) {
          errors.push("Admission number already exists");
        }
      }

      if (row.rollNumber) {
        const existingRoll = await tx.studentEnrollment.findFirst({
          where: {
            sectionId: row.sectionId,
            rollNumber: row.rollNumber,
          },
          select: { id: true },
        });
        if (existingRoll) {
          errors.push("Roll number already exists in section");
        }
      }

      if (errors.length > 0) {
        return { created: false, errors };
      }

      let parentId: string | null = null;
      const existingParent = await tx.parent.findFirst({
        where: { schoolId, mobile: row.parentMobile },
        select: { id: true },
      });

      if (existingParent) {
        parentId = existingParent.id;
      } else {
        const createdParent = await tx.parent.create({
          data: {
            schoolId,
            fullName: row.parentName,
            mobile: row.parentMobile,
            email: row.parentEmail,
            relationToStudent: row.relationToStudent,
          },
          select: { id: true },
        });
        parentId = createdParent.id;
      }

      const student = await tx.student.create({
        data: {
          schoolId,
          registrationNumber: row.registrationNumber!,
          admissionNumber: row.admissionNumber,
          fullName: row.fullName,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          bloodGroup: row.bloodGroup,
        },
        select: { id: true },
      });

      if (row.address || row.photoPath) {
        await tx.studentProfile.create({
          data: {
            studentId: student.id,
            address: row.address,
            profilePhotoUrl: row.photoPath,
          },
        });
      }

      const existingLink = await tx.parentStudentLink.findFirst({
        where: { parentId: parentId!, studentId: student.id },
        select: { id: true },
      });

      if (!existingLink) {
        await tx.parentStudentLink.create({
          data: {
            parentId: parentId!,
            studentId: student.id,
            isPrimary: true,
          },
        });
      }

      await tx.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicYearId: row.academicYearId,
          classId: row.classId,
          sectionId: row.sectionId,
          rollNumber: row.rollNumber,
        },
      });

      return { created: true };
    });
  } catch (error) {
    return { created: false, errors: mapBulkImportError(error) };
  }
}

export async function importStudentsFromFile(
  schoolId: string,
  buffer: Buffer,
  fileType: FileType,
  options: ImportOptions
): Promise<ImportResult> {
  const rawRows = parseFile(buffer, fileType);
  const parsedRows = buildRows(rawRows);

  if (parsedRows.length > MAX_BULK_IMPORT_ROWS) {
    throw new ApiError(413, `Too many rows. Maximum allowed is ${MAX_BULK_IMPORT_ROWS}.`);
  }

  const { normalized, errors } = normalizeRows(parsedRows);

  if (normalized.length === 0) {
    return {
      totalRows: parsedRows.length,
      processed: 0,
      created: 0,
      failed: errors.length,
      errors,
    };
  }

  detectDuplicates(normalized, errors);

  const { academicYearSet, classMap, sectionMap } = await validateReferences(
    schoolId,
    normalized
  );

  normalized.forEach((row) => {
    if (!academicYearSet.has(row.academicYearId)) {
      addError(errors, row.rowNumber, "Academic year not found for this school");
    }

    const classRecord = classMap.get(row.classId);
    if (!classRecord) {
      addError(errors, row.rowNumber, "Class not found for this school");
    } else if (classRecord.academicYearId !== row.academicYearId) {
      addError(errors, row.rowNumber, "Class does not belong to academic year");
    }

    const sectionRecord = sectionMap.get(row.sectionId);
    if (!sectionRecord) {
      addError(errors, row.rowNumber, "Section not found for this school");
    } else if (sectionRecord.classId !== row.classId) {
      addError(errors, row.rowNumber, "Section does not belong to class");
    }
  });

  await resolveExistingDuplicates(schoolId, normalized, errors);
  await resolveExistingRollNumbers(normalized, errors);

  const errorRowSet = new Set(errors.map((entry) => entry.rowNumber));
  const validRows = normalized.filter((row) => !errorRowSet.has(row.rowNumber));

  if (validRows.length === 0) {
    return {
      totalRows: parsedRows.length,
      processed: 0,
      created: 0,
      failed: errors.length,
      errors,
    };
  }

  await buildSequenceGenerator(schoolId, validRows);
  await assignRollNumbers(validRows);

  const batches = chunkRows(validRows, options.batchSize);
  let created = 0;

  for (const batch of batches) {
    for (const row of batch) {
      const result = await createRowWithChecks(schoolId, row);
      if (result.created) {
        created += 1;
        continue;
      }

      const rowErrors =
        result.errors && result.errors.length > 0
          ? result.errors
          : ["Failed to import row due to transactional error"];
      rowErrors.forEach((message) => addError(errors, row.rowNumber, message));
    }
  }

  const failed = errors.length;

  return {
    totalRows: parsedRows.length,
    processed: validRows.length,
    created,
    failed,
    errors,
  };
}

export async function previewStudentsFromFile(
  schoolId: string,
  buffer: Buffer,
  fileType: FileType
): Promise<PreviewResult> {
  const rawRows = parseFile(buffer, fileType);
  const parsedRows = buildRows(rawRows);

  if (parsedRows.length > MAX_BULK_IMPORT_ROWS) {
    throw new ApiError(413, `Too many rows. Maximum allowed is ${MAX_BULK_IMPORT_ROWS}.`);
  }

  const { normalized, errors } = normalizeRows(parsedRows);

  if (normalized.length === 0) {
    return {
      totalRows: parsedRows.length,
      processed: 0,
      failed: errors.length,
      errors,
    };
  }

  detectDuplicates(normalized, errors);

  const { academicYearSet, classMap, sectionMap } = await validateReferences(
    schoolId,
    normalized
  );

  normalized.forEach((row) => {
    if (!academicYearSet.has(row.academicYearId)) {
      addError(errors, row.rowNumber, "Academic year not found for this school");
    }

    const classRecord = classMap.get(row.classId);
    if (!classRecord) {
      addError(errors, row.rowNumber, "Class not found for this school");
    } else if (classRecord.academicYearId !== row.academicYearId) {
      addError(errors, row.rowNumber, "Class does not belong to academic year");
    }

    const sectionRecord = sectionMap.get(row.sectionId);
    if (!sectionRecord) {
      addError(errors, row.rowNumber, "Section not found for this school");
    } else if (sectionRecord.classId !== row.classId) {
      addError(errors, row.rowNumber, "Section does not belong to class");
    }
  });

  await resolveExistingDuplicates(schoolId, normalized, errors);
  await resolveExistingRollNumbers(normalized, errors);

  const errorRowSet = new Set(errors.map((entry) => entry.rowNumber));
  const validRows = normalized.filter((row) => !errorRowSet.has(row.rowNumber));

  return {
    totalRows: parsedRows.length,
    processed: validRows.length,
    failed: errors.length,
    errors,
  };
}
