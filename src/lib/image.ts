export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image is too large. Maximum size is 25 MB.";
  return null;
}

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type))
    return "Please choose a PDF, JPG, PNG or WebP file.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Document is too large. Maximum size is 10 MB.";
  return null;
}

/**
 * Decodes the image (rejects files that are not real images) and re-encodes it
 * as a resized JPEG, which also strips EXIF/location metadata.
 */
export async function resizeImage(file: Blob, maxSize: number, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let release: () => void;
  try {
    const decoded = await createImageBitmap(file);
    bitmap = decoded;
    release = () => decoded.close();
  } catch {
    const url = URL.createObjectURL(file);
    try {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This file could not be read as an image."));
        image.src = url;
      });
      release = () => URL.revokeObjectURL(url);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    release();
    throw new Error("Image processing is not supported in this browser.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  release();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image."))),
      "image/jpeg",
      quality,
    ),
  );
}
