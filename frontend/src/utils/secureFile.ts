import { API_BASE_URL, API_ORIGIN } from "../services/api/client";

function shouldUseSecureFetch(url: string) {
  if (!url) return false;
  if (url.startsWith("/storage") || url.startsWith("/uploads")) return true;
  if (url.startsWith("r2://")) return true;
  if (url.startsWith(API_ORIGIN) && (url.includes("/storage/") || url.includes("/uploads/"))) {
    return true;
  }
  if (url.startsWith("/api/v1/files/secure") || url.startsWith(`${API_ORIGIN}/api/v1/files/secure`)) {
    return true;
  }
  return false;
}

function normalizeFileUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (fileUrl.startsWith(API_ORIGIN)) {
    return fileUrl.replace(API_ORIGIN, "");
  }
  return fileUrl;
}

function buildSecureUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (!shouldUseSecureFetch(fileUrl)) {
    return fileUrl;
  }

  const normalized = normalizeFileUrl(fileUrl);
  const base = normalized.startsWith("/api/v1/files/secure")
    ? `${API_ORIGIN}${normalized}`
    : `${API_BASE_URL}/files/secure?fileUrl=${encodeURIComponent(normalized)}`;
  return base;
}

export async function getSecureFileUrl(fileUrl: string): Promise<string> {
  try {
    return buildSecureUrl(fileUrl);
  } catch (err) {
    console.error("Secure file load failed:", err);
    return "";
  }
}

export async function downloadSecureFile(
  fileUrl: string,
  _fileName?: string
) {
  try {
    if (!fileUrl) return;
    const url = buildSecureUrl(fileUrl);
    if (!url) return;
    window.open(url, "_blank", "noopener");
  } catch (err) {
    console.error("Secure file download failed:", err);
  }
}
