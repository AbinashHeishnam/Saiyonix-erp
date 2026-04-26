import type * as DocumentPicker from "expo-document-picker";
import { Alert, Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { getAuthTokens, resolvePublicUrl } from "@saiyonix/api";

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function guessMimeType(name?: string | null) {
  if (!name) return null;
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  return EXTENSION_MIME_MAP[ext] ?? null;
}

function getFileNameFromUrl(url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const name = clean.split("/").pop() ?? "";
  const decoded = decodeURIComponent(name);
  return decoded || null;
}

function getFileNameFromContentDisposition(value?: string | null) {
  if (!value) return null;
  const input = String(value);

  const utf8Match = input.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // ignore
    }
  }

  const match = input.match(/filename\s*=\s*([^;]+)/i);
  if (match?.[1]) {
    const raw = match[1].trim().replace(/^"|"$/g, "");
    return raw || null;
  }

  return null;
}

function sanitizeFileBaseName(value: string) {
  const base = value.replace(/\.[^/.]+$/, "");
  const safe = base.replace(/[^\w\-() ]+/g, "_").trim();
  return safe.slice(0, 80) || "attachment";
}

async function ensureDownloadDir() {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!base) return null;
  const dir = `${base}downloads/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch {
    return base;
  }
}

export function toUploadFile(asset: DocumentPicker.DocumentPickerAsset) {
  const safeName = asset.name ?? `upload-${Date.now()}`;
  const type = asset.mimeType ?? guessMimeType(safeName) ?? "application/octet-stream";
  return {
    uri: asset.uri,
    name: safeName,
    type,
  };
}

export async function openFileUrl(fileUrl?: string | null) {
  try {
    if (!fileUrl) return;
    const token = getAuthTokens().accessToken;
    const resolved = resolvePublicUrl(fileUrl, token) ?? fileUrl;
    if (!resolved) return;
    const canOpen = await Linking.canOpenURL(resolved);
    if (!canOpen) {
      Alert.alert("Unable to open file", "This file could not be opened on your device.");
      return;
    }
    await Linking.openURL(resolved);
  } catch {
    Alert.alert("Download failed", "Please try again or contact support if the issue persists.");
  }
}

function guessExtensionFromContentType(contentType?: string | null) {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("pdf")) return "pdf";
  if (type.includes("png")) return "png";
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("jpg")) return "jpg";
  if (type.includes("msword")) return "doc";
  if (type.includes("officedocument.wordprocessingml")) return "docx";
  if (type.includes("officedocument.spreadsheetml")) return "xlsx";
  if (type.includes("officedocument.presentationml")) return "pptx";
  return "bin";
}

export async function openSecureFileUrl(fileUrl?: string | null) {
  try {
    if (!fileUrl) return;
    const token = getAuthTokens().accessToken;
    const resolved = resolvePublicUrl(fileUrl, token) ?? fileUrl;
    if (!resolved) return;

    const downloadDir = await ensureDownloadDir();
    if (!downloadDir) {
      throw new Error("Storage not available");
    }

    const urlName = getFileNameFromUrl(fileUrl);
    const urlNameParts = (urlName ?? "").split(".");
    const extFromUrlName = urlNameParts.length > 1 ? urlNameParts[urlNameParts.length - 1].toLowerCase() : "";
    const baseFromUrl = sanitizeFileBaseName(urlName ?? "attachment");
    const initialExt = extFromUrlName || "bin";
    const initialLocalUri = `${downloadDir}saiyonix-${baseFromUrl}-${Date.now()}.${initialExt}`;

    const download = await FileSystem.downloadAsync(resolved, initialLocalUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (download.status < 200 || download.status >= 300) {
      throw new Error(`Failed to download file (${download.status})`);
    }

    const contentType =
      (download.headers as any)?.["content-type"] ??
      (download.headers as any)?.["Content-Type"] ??
      null;
    const contentDisposition =
      (download.headers as any)?.["content-disposition"] ??
      (download.headers as any)?.["Content-Disposition"] ??
      null;

    const nameFromDisposition = getFileNameFromContentDisposition(
      typeof contentDisposition === "string" ? contentDisposition : null
    );
    const dispositionParts = (nameFromDisposition ?? "").split(".");
    const extFromDisposition =
      dispositionParts.length > 1 ? dispositionParts[dispositionParts.length - 1].toLowerCase() : "";

    const extFromType = guessExtensionFromContentType(typeof contentType === "string" ? contentType : null);

    const finalExt =
      extFromDisposition && extFromDisposition !== "bin"
        ? extFromDisposition
        : extFromUrlName && extFromUrlName !== "bin"
          ? extFromUrlName
          : extFromType && extFromType !== "bin"
            ? extFromType
            : initialExt;

    const finalBase = sanitizeFileBaseName(nameFromDisposition ?? urlName ?? "attachment");
    const finalLocalUri = `${downloadDir}saiyonix-${finalBase}-${Date.now()}.${finalExt}`;
    const localUri = download.uri === finalLocalUri ? download.uri : finalLocalUri;
    if (download.uri !== finalLocalUri) {
      await FileSystem.moveAsync({ from: download.uri, to: finalLocalUri });
    }

    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      await Linking.openURL(contentUri);
      return;
    }

    await Linking.openURL(localUri);
  } catch (err) {
    console.error("File open failed", err);
    Alert.alert("Unable to open file", "The attachment was downloaded. If it doesn't open, please open it from your Files/Downloads app.");
  }
}
