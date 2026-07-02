"use client";

import {
  computeFitInsideDimensions,
  preservesAspectRatio,
} from "@/lib/photos/thumbnail-fit";

export const POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE = 1200;
export const POPTAVKA_FOTKA_THUMBNAIL_QUALITY = 0.82;

function thumbnailFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}-thumb.webp`;
}

/**
 * Vygeneruje WebP náhled v prohlížeči (canvas / createImageBitmap).
 * Režim „fit inside“ — zachová celý obraz a poměr stran, bez ořezu.
 * Při neúspěchu vrátí null — server pak uloží jen originál.
 */
export async function generateClientPhotoThumbnail(
  file: File,
  maxSide = POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE,
  quality = POPTAVKA_FOTKA_THUMBNAIL_QUALITY
): Promise<File | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    if (width <= 0 || height <= 0) {
      bitmap.close?.();
      return null;
    }

    const { width: targetWidth, height: targetHeight } = computeFitInsideDimensions(
      width,
      height,
      maxSide
    );

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return null;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
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

export { computeFitInsideDimensions, preservesAspectRatio };

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
