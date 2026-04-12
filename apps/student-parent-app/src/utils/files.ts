import type * as DocumentPicker from "expo-document-picker";
import { Alert, Linking } from "react-native";
import { resolvePublicUrl } from "@saiyonix/api";

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
    const resolved = resolvePublicUrl(fileUrl);
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
