import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";

type BulkPhotoError = {
  filename: string;
  reason: string;
};

type BulkPhotoResult = {
  totalFiles: number;
  processed: number;
  studentUpdated: number;
  teacherUpdated: number;
  skipped: number;
  errors: BulkPhotoError[];
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg"]);
const MAX_ZIP_BYTES = 25 * 1024 * 1024;

function sanitizeEntryName(entryName: string) {
  return path.basename(entryName);
}

function resolveUploadPath(kind: "students" | "teachers", id: string) {
  return path.join("uploads", kind, `${id}.jpg`);
}

async function ensureUploadDirExists(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function processBulkPhotoZip(
  schoolId: string,
  buffer: Buffer
): Promise<BulkPhotoResult> {
  if (!buffer?.length) {
    throw new ApiError(400, "Empty ZIP file");
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    throw new ApiError(413, "ZIP file too large");
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);

  const candidateIds = entries.map((entry) =>
    path.parse(sanitizeEntryName(entry.entryName)).name
  );

  const studentIds = await prisma.student.findMany({
    where: {
      id: { in: candidateIds },
      schoolId,
      deletedAt: null,
    },
    select: { id: true },
  });
  const teacherIds = await prisma.teacher.findMany({
    where: {
      id: { in: candidateIds },
      schoolId,
      deletedAt: null,
    },
    select: { id: true },
  });

  const studentSet = new Set(studentIds.map((s) => s.id));
  const teacherSet = new Set(teacherIds.map((t) => t.id));

  const result: BulkPhotoResult = {
    totalFiles: entries.length,
    processed: 0,
    studentUpdated: 0,
    teacherUpdated: 0,
    skipped: 0,
    errors: [],
  };

  const studentDir = path.join("uploads", "students");
  const teacherDir = path.join("uploads", "teachers");

  await ensureUploadDirExists(studentDir);
  await ensureUploadDirExists(teacherDir);

  for (const entry of entries) {
    const filename = sanitizeEntryName(entry.entryName);
    const { name: fileId, ext } = path.parse(filename);
    const normalizedExt = ext.toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(normalizedExt)) {
      result.skipped += 1;
      result.errors.push({
        filename,
        reason: "Unsupported file extension",
      });
      continue;
    }

    if (!fileId) {
      result.skipped += 1;
      result.errors.push({
        filename,
        reason: "Invalid filename",
      });
      continue;
    }

    const fileData = entry.getData();

    if (studentSet.has(fileId)) {
      const relativePath = resolveUploadPath("students", fileId);
      await fs.writeFile(relativePath, fileData);
      await prisma.studentProfile.upsert({
        where: { studentId: fileId },
        update: { profilePhotoUrl: `/${relativePath}` },
        create: { studentId: fileId, profilePhotoUrl: `/${relativePath}` },
      });
      result.studentUpdated += 1;
      result.processed += 1;
      continue;
    }

    if (teacherSet.has(fileId)) {
      const relativePath = resolveUploadPath("teachers", fileId);
      await fs.writeFile(relativePath, fileData);
      await prisma.teacher.update({
        where: { id: fileId, schoolId },
        data: { photoUrl: `/${relativePath}` },
      });
      result.teacherUpdated += 1;
      result.processed += 1;
      continue;
    }

    result.skipped += 1;
    result.errors.push({
      filename,
      reason: "No matching student or teacher found",
    });
  }

  return result;
}
