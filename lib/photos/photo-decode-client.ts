"use client";

import { computeFitInsideDimensions } from "@/lib/photos/thumbnail-fit";
import { heicFileToJpegName } from "@/lib/photos/heic-support";

export type DecodeImageToJpegOptions = {
  /** Omezí delší stranu; bez hodnoty zůstane plné rozlišení originálu. */
  maxSide?: number;
  quality?: number;
};

/**
 * Dekóduje obrázek v prohlížeči (včetně HEIC na Safari) a vrátí JPEG.
 * Fit inside — bez ořezu, zachová poměr stran.
 */
export async function decodeImageFileToJpeg(
  file: File,
  options: DecodeImageToJpegOptions = {}
): Promise<File | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const quality = options.quality ?? 0.92;

  try {
    const bitmap = await createImageBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      bitmap.close?.();
      return null;
    }

    const { width: targetWidth, height: targetHeight } =
      options.maxSide != null
        ? computeFitInsideDimensions(sourceWidth, sourceHeight, options.maxSide)
        : { width: sourceWidth, height: sourceHeight };

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
      canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
    });

    if (!blob || blob.size <= 0) {
      return null;
    }

    return new File([blob], heicFileToJpegName(file.name), { type: "image/jpeg" });
  } catch {
    return null;
  }
}
