export function safeStartUiFilenamePart(value: string) {
  const cleaned = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return cleaned.slice(0, 46) || "artwork";
}

export function startUiImageExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}
