import "dotenv/config";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { lookup as lookupMime } from "mime-types";

import prisma from "../src/config/prisma";
import { buildR2FileUrl, isR2Configured, uploadFile } from "../src/services/storage/r2.service";

type MigrateStatus = "migrated" | "skipped" | "missing" | "failed" | "dry-run";

type LogEntry = {
  model: string;
  id: string;
  field: string;
  fieldPath?: string;
  originalUrl: string;
  status: MigrateStatus;
  newUrl?: string;
  reason?: string;
  error?: string;
};

type FieldStats = {
  legacyFound: number;
  migrated: number;
  skipped: number;
  missing: number;
  failed: number;
  dryRun: number;
};

type ScriptStats = {
  scanned: number;
  legacyFound: number;
  migrated: number;
  skipped: number;
  missing: number;
  failed: number;
  dryRun: number;
};

type JsonObject = Record<string, unknown>;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const baseDir = process.cwd();
const logEntries: LogEntry[] = [];
const fieldStats = new Map<string, FieldStats>();
const stats: ScriptStats = {
  scanned: 0,
  legacyFound: 0,
  migrated: 0,
  skipped: 0,
  missing: 0,
  failed: 0,
  dryRun: 0,
};

function isLocalUrl(value: string) {
  return value.startsWith("/storage/") || value.startsWith("/uploads/");
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildR2Key(localUrl: string) {
  if (localUrl.startsWith("/storage/")) {
    return path.posix.normalize(localUrl.replace(/^\/storage\//, "").replace(/^\/+/, ""));
  }
  if (localUrl.startsWith("/uploads/")) {
    return path.posix.normalize(localUrl.replace(/^\/uploads\//, "").replace(/^\/+/, ""));
  }
  return "";
}

function buildAbsolutePath(localUrl: string) {
  return path.join(baseDir, localUrl.replace(/^\//, ""));
}

function bumpFieldStat(key: string, update: Partial<FieldStats>) {
  const current: FieldStats = fieldStats.get(key) ?? {
    legacyFound: 0,
    migrated: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    dryRun: 0,
  };
  const next: FieldStats = {
    legacyFound: current.legacyFound + (update.legacyFound ?? 0),
    migrated: current.migrated + (update.migrated ?? 0),
    skipped: current.skipped + (update.skipped ?? 0),
    missing: current.missing + (update.missing ?? 0),
    failed: current.failed + (update.failed ?? 0),
    dryRun: current.dryRun + (update.dryRun ?? 0),
  };
  fieldStats.set(key, next);
}

async function migrateSingleUrl(params: {
  model: string;
  id: string;
  field: string;
  fieldPath?: string;
  value: string;
}): Promise<{ status: MigrateStatus; newUrl?: string }> {
  const originalUrl = safeDecode(params.value.trim());

  if (!originalUrl) {
    return { status: "skipped" };
  }

  if (originalUrl.startsWith("r2://")) {
    return { status: "skipped" };
  }

  if (!isLocalUrl(originalUrl)) {
    return { status: "skipped" };
  }

  stats.legacyFound += 1;
  bumpFieldStat(`${params.model}.${params.field}`, { legacyFound: 1 });

  const absolutePath = buildAbsolutePath(originalUrl);
  if (!fs.existsSync(absolutePath)) {
    logEntries.push({
      model: params.model,
      id: params.id,
      field: params.field,
      fieldPath: params.fieldPath,
      originalUrl,
      status: "missing",
      reason: "file-not-found",
    });
    stats.missing += 1;
    bumpFieldStat(`${params.model}.${params.field}`, { missing: 1 });
    return { status: "missing" };
  }

  if (dryRun) {
    logEntries.push({
      model: params.model,
      id: params.id,
      field: params.field,
      fieldPath: params.fieldPath,
      originalUrl,
      status: "dry-run",
    });
    stats.dryRun += 1;
    bumpFieldStat(`${params.model}.${params.field}`, { dryRun: 1 });
    return { status: "dry-run" };
  }

  const key = buildR2Key(originalUrl);
  if (!key || key.includes("..")) {
    logEntries.push({
      model: params.model,
      id: params.id,
      field: params.field,
      fieldPath: params.fieldPath,
      originalUrl,
      status: "failed",
      reason: "invalid-key",
    });
    stats.failed += 1;
    bumpFieldStat(`${params.model}.${params.field}`, { failed: 1 });
    return { status: "failed" };
  }

  try {
    const buffer = await fsp.readFile(absolutePath);
    const contentType = (lookupMime(absolutePath) || "application/octet-stream") as string;
    const uploadResult = await uploadFile(buffer, key, contentType);
    const newUrl = buildR2FileUrl(uploadResult.bucket, uploadResult.key);

    logEntries.push({
      model: params.model,
      id: params.id,
      field: params.field,
      fieldPath: params.fieldPath,
      originalUrl,
      status: "migrated",
      newUrl,
    });
    stats.migrated += 1;
    bumpFieldStat(`${params.model}.${params.field}`, { migrated: 1 });
    return { status: "migrated", newUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logEntries.push({
      model: params.model,
      id: params.id,
      field: params.field,
      fieldPath: params.fieldPath,
      originalUrl,
      status: "failed",
      error: message,
    });
    stats.failed += 1;
    bumpFieldStat(`${params.model}.${params.field}`, { failed: 1 });
    return { status: "failed" };
  }
}

async function processStringField(model: string, field: string) {
  const client = (prisma as any)[model];
  if (!client?.findMany) {
    console.warn(`[skip] Prisma model not found: ${model}`);
    return;
  }

  let cursor: string | undefined = undefined;
  let processed = 0;
  while (true) {
    const rows = await client.findMany({
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, [field]: true },
    });

    if (!rows.length) break;

    for (const row of rows) {
      stats.scanned += 1;
      processed += 1;
      if (limit && processed > limit) return;
      const value = row[field];
      if (typeof value !== "string") {
        stats.skipped += 1;
        bumpFieldStat(`${model}.${field}`, { skipped: 1 });
        continue;
      }

      const result = await migrateSingleUrl({
        model,
        id: row.id,
        field,
        value,
      });

      if (result.status === "migrated" && result.newUrl && !dryRun) {
        try {
          await client.update({
            where: { id: row.id },
            data: { [field]: result.newUrl },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          logEntries.push({
            model,
            id: row.id,
            field,
            originalUrl: value,
            status: "failed",
            error: `db-update-failed: ${message}`,
          });
          stats.failed += 1;
          bumpFieldStat(`${model}.${field}`, { failed: 1 });
        }
      } else if (result.status === "skipped") {
        stats.skipped += 1;
        bumpFieldStat(`${model}.${field}`, { skipped: 1 });
      }
    }

    cursor = rows[rows.length - 1]?.id;
  }
}

function mapAttachmentItem(
  item: unknown,
  handler: (url: string, fieldPath: string) => Promise<{ status: MigrateStatus; newUrl?: string }>
): Promise<{ updatedItem: unknown; didChange: boolean; hadLocal: boolean }> {
  if (typeof item === "string") {
    return handler(item, "attachments[]").then((result) => {
      if (result.status === "migrated" && result.newUrl) {
        return { updatedItem: result.newUrl, didChange: true, hadLocal: true };
      }
      if (result.status === "skipped") {
        return { updatedItem: item, didChange: false, hadLocal: false };
      }
      return { updatedItem: item, didChange: false, hadLocal: true };
    });
  }

  if (item && typeof item === "object") {
    const obj = { ...(item as JsonObject) };
    const fileUrl = typeof obj.fileUrl === "string" ? obj.fileUrl : null;
    if (!fileUrl) {
      return Promise.resolve({ updatedItem: item, didChange: false, hadLocal: false });
    }
    return handler(fileUrl, "attachments[].fileUrl").then((result) => {
      if (result.status === "migrated" && result.newUrl) {
        obj.fileUrl = result.newUrl;
        return { updatedItem: obj, didChange: true, hadLocal: true };
      }
      if (result.status === "skipped") {
        return { updatedItem: item, didChange: false, hadLocal: false };
      }
      return { updatedItem: item, didChange: false, hadLocal: true };
    });
  }

  return Promise.resolve({ updatedItem: item, didChange: false, hadLocal: false });
}

async function processAttachmentsField(model: string, field: string) {
  const client = (prisma as any)[model];
  if (!client?.findMany) {
    console.warn(`[skip] Prisma model not found: ${model}`);
    return;
  }

  let cursor: string | undefined = undefined;
  let processed = 0;
  while (true) {
    const rows = await client.findMany({
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, [field]: true },
    });

    if (!rows.length) break;

    for (const row of rows) {
      stats.scanned += 1;
      processed += 1;
      if (limit && processed > limit) return;
      const value = row[field];
      if (!Array.isArray(value)) {
        stats.skipped += 1;
        bumpFieldStat(`${model}.${field}`, { skipped: 1 });
        continue;
      }

      let didChange = false;
      let hadLocal = false;
      const updated: unknown[] = [];

      for (const item of value) {
        const result = await mapAttachmentItem(item, async (url, fieldPath) => {
          const migration = await migrateSingleUrl({
            model,
            id: row.id,
            field,
            fieldPath,
            value: url,
          });
          return migration;
        });
        updated.push(result.updatedItem);
        if (result.didChange) didChange = true;
        if (result.hadLocal) hadLocal = true;
      }

      if (!hadLocal) {
        stats.skipped += 1;
        bumpFieldStat(`${model}.${field}`, { skipped: 1 });
        continue;
      }

      if (didChange && !dryRun) {
        try {
          await client.update({
            where: { id: row.id },
            data: { [field]: updated },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          logEntries.push({
            model,
            id: row.id,
            field,
            originalUrl: "[attachments]",
            status: "failed",
            error: `db-update-failed: ${message}`,
          });
          stats.failed += 1;
          bumpFieldStat(`${model}.${field}`, { failed: 1 });
        }
      }
    }

    cursor = rows[rows.length - 1]?.id;
  }
}

async function main() {
  const startedAt = new Date();
  if (!dryRun && !isR2Configured()) {
    throw new Error("R2 is not configured. Set R2_* env vars or run with --dry-run.");
  }

  const work: Array<() => Promise<void>> = [
    () => processStringField("school", "logoUrl"),
    () => processStringField("studentProfile", "profilePhotoUrl"),
    () => processStringField("studentLeave", "attachmentUrl"),
    () => processStringField("teacher", "photoUrl"),
    () => processStringField("teacherProfile", "photoUrl"),
    () => processStringField("teacherLeave", "attachmentUrl"),
    () => processStringField("note", "fileUrl"),
    () => processAttachmentsField("assignment", "attachments"),
    () => processStringField("assignmentSubmission", "submissionUrl"),
    () => processStringField("message", "attachmentUrl"),
    () => processStringField("chatMessage", "fileUrl"),
    () => processStringField("certificateRequest", "fileUrl"),
    () => processStringField("admitCard", "generatedPdfUrl"),
    () => processStringField("reportCard", "generatedPdfUrl"),
    () => processStringField("reportCard", "principalSignatureUrl"),
    () => processAttachmentsField("noticeBoard", "attachments"),
    () => processAttachmentsField("circular", "attachments"),
    () => processStringField("fileMeta", "fileUrl"),
    () => processStringField("documentVault", "fileUrl"),
    () => processStringField("receipt", "pdfUrl"),
    () => processStringField("certificate", "certificateUrl"),
  ];

  for (const task of work) {
    await task();
  }

  const finishedAt = new Date();
  const logPayload = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    dryRun,
    limit: limit ?? null,
    stats,
    fieldStats: Object.fromEntries(fieldStats.entries()),
    entries: logEntries,
  };

  const logName = `migrate-local-to-r2.${startedAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const logPath = path.join(baseDir, "scripts", logName);
  await fsp.writeFile(logPath, JSON.stringify(logPayload, null, 2), "utf-8");

  console.log("Migration complete", {
    dryRun,
    logPath,
    stats,
  });
}

main()
  .catch((error) => {
    console.error("Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
