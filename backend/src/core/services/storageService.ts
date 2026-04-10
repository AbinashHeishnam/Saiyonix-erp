import path from "node:path";

const STORAGE_FILE_ROOT = path.join(process.cwd(), "storage");
const STORAGE_PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE_PATH ?? "/storage";

function normalizePublicBase(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildPaths(relativePath: string) {
  const publicBase = normalizePublicBase(STORAGE_PUBLIC_BASE);
  const publicUrl = `${publicBase}/${relativePath}`;
  const filePath = path.join(STORAGE_FILE_ROOT, ...relativePath.split("/"));
  return { filePath, publicUrl };
}

export function getAdmitCardPaths(examId: string, studentId: string, salt?: string | number) {
  const filename = salt ? `${studentId}_${salt}.pdf` : `${studentId}.pdf`;
  const relative = path.posix.join("admit-cards", examId, filename);
  return buildPaths(relative);
}

export function getReportCardPaths(examId: string, studentId: string) {
  const relative = path.posix.join("report-cards", examId, `${studentId}.pdf`);
  return buildPaths(relative);
}

export function getSignedUrl(publicUrl: string) {
  // Placeholder for signed URL logic (e.g., S3); return public URL for now.
  return publicUrl;
}
