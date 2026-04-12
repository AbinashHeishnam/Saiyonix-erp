import type * as DocumentPicker from "expo-document-picker";

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
