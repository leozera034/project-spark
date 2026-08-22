const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SOFT_TARGET_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Reduz fotos grandes antes do upload para poupar dados móveis e acelerar o
 * cardápio. O arquivo original nunca é alterado. Se o navegador não oferecer
 * Canvas/ImageBitmap, mantém o arquivo original desde que ele caiba no limite.
 */
export async function optimizeCatalogImage(file: File): Promise<File> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("UPLOAD_INVALID_TYPE");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("UPLOAD_TOO_LARGE");

  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
    return file;
  }

  try {
    const largest = Math.max(bitmap.width, bitmap.height);
    const scale = largest > MAX_EDGE ? MAX_EDGE / largest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (scale === 1 && file.size <= SOFT_TARGET_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.84);
    });

    if (!blob) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
      return file;
    }
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "produto";
    const optimized = new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    // Para imagem pequena sem resize, só troca se de fato economizar bytes.
    if (scale === 1 && optimized.size >= file.size) return file;
    return optimized;
  } finally {
    bitmap.close?.();
  }
}
