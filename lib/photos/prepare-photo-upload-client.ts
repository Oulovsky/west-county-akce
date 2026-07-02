"use client";

import {
  isHeicPhotoFile,
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
} from "@/lib/photos/heic-support";
import { decodeImageFileToJpeg } from "@/lib/photos/photo-decode-client";
import {
  MAX_PHOTO_UPLOAD_SIZE_BYTES,
  PHOTO_UPLOAD_SIZE_MESSAGE,
  validatePhotoFileSelection,
} from "@/lib/photos/upload-limits";

export type PreparePhotoUploadResult =
  | { ok: true; file: File; convertedFromHeic: boolean }
  | { ok: false; message: string };

/**
 * Připraví soubor k uploadu: HEIC z iPhonu zkusí převést na JPEG v prohlížeči.
 * Ostatní formáty projdou beze změny po validaci výběru.
 */
export async function preparePhotoFileForUpload(file: File): Promise<PreparePhotoUploadResult> {
  const selection = validatePhotoFileSelection(file);
  if (!selection.ok) {
    return { ok: false, message: selection.message };
  }

  if (!isHeicPhotoFile(file)) {
    return { ok: true, file, convertedFromHeic: false };
  }

  const converted = await decodeImageFileToJpeg(file);
  if (!converted) {
    return { ok: false, message: PHOTO_HEIC_UNSUPPORTED_MESSAGE };
  }

  if (converted.size > MAX_PHOTO_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: PHOTO_UPLOAD_SIZE_MESSAGE };
  }

  return { ok: true, file: converted, convertedFromHeic: true };
}
