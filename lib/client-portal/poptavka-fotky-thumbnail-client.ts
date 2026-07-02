"use client";

import { decodeImageFileToJpeg } from "@/lib/photos/photo-decode-client";

export const POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE = 1200;
export const POPTAVKA_FOTKA_THUMBNAIL_QUALITY = 0.82;

function thumbnailFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}-thumb.webp`;
}

async function encodeThumbnailWebP(
  file: File,
  maxSide: number,
  quality: number
): Promise<File | null> {
  const jpeg = await decodeImageFileToJpeg(file, { maxSide, quality });
  if (!jpeg || typeof document === "undefined") {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(jpeg);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return null;
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/webp", quality);
    });
    if (!blob || blob.size <= 0) {
      return null;
    }

    return new File([blob], thumbnailFileName(file.name), { type: "image/webp" });
  } catch {
    return null;
  }
}

/**
 * Vygeneruje WebP náhled v prohlížeči.
 * Režim „fit inside“ — zachová celý obraz a poměr stran, bez ořezu.
 * HEIC z iPhonu dekóduje přes decodeImageFileToJpeg (Safari) nebo selže tiše.
 */
export async function generateClientPhotoThumbnail(
  file: File,
  maxSide = POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE,
  quality = POPTAVKA_FOTKA_THUMBNAIL_QUALITY
): Promise<File | null> {
  if (typeof window === "undefined") {
    return null;
  }

  return encodeThumbnailWebP(file, maxSide, quality);
}

export async function appendClientPhotoThumbnailToFormData(
  formData: FormData,
  clientId: string,
  file: File
) {
  const thumbnail = await generateClientPhotoThumbnail(file);
  if (thumbnail) {
    formData.append(`photo_thumbnail_${clientId}`, thumbnail, thumbnail.name);
  }
}
