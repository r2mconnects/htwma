export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image is too large. Maximum size is 8 MB.";
  return null;
}

/**
 * Decodes the image (rejects files that are not real images) and re-encodes it
 * as a resized JPEG, which also strips EXIF/location metadata.
 */
export async function resizeImage(file: Blob, maxSize: number, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This file could not be read as an image.");
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image."))), "image/jpeg", quality),
  );
}
