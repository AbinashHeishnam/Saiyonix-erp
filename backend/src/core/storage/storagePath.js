import path from "node:path";
const STORAGE_ROOT = path.join(process.cwd(), "storage");
function sanitizeSegment(value) {
    const trimmed = value.trim().toLowerCase();
    const sanitized = trimmed.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-");
    const cleaned = sanitized.replace(/^\.+/, "").replace(/^-+/, "");
    if (!cleaned || cleaned.includes("..")) {
        throw new Error("Invalid path segment");
    }
    return cleaned;
}
export function getStoragePath(params) {
    const userType = sanitizeSegment(params.userType);
    const moduleName = sanitizeSegment(params.module);
    const userId = params.userId ? sanitizeSegment(params.userId) : "shared";
    const rootFolder = userType === "common" ? "common" : `${userType}s`;
    const folder = path.join(STORAGE_ROOT, rootFolder, userId, moduleName);
    const relativeUrl = path.posix.join("/storage", rootFolder, userId, moduleName);
    return { folder, relativeUrl };
}
export function buildStoredFileName(originalName) {
    const base = path.basename(originalName);
    const sanitized = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
    const trimmed = sanitized.replace(/^\.+/, "").replace(/^-+/, "").trim();
    const safe = trimmed.length > 0 ? trimmed : "file";
    const timestamp = Date.now();
    return `${timestamp}_${safe}`;
}
