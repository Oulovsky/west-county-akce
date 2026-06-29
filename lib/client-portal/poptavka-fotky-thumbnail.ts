import "server-only";

import sharp from "sharp";

export const POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE = 1200;
export const POPTAVKA_FOTKA_THUMBNAIL_QUALITY = 82;

export async function generatePoptavkaPhotoThumbnail(input: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}> {
  const pipeline = sharp(input, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let resized = pipeline;
  if (width > 0 && height > 0) {
    resized = pipeline.resize({
      width: width >= height ? POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE : undefined,
      height: height > width ? POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const buffer = await resized.webp({ quality: POPTAVKA_FOTKA_THUMBNAIL_QUALITY }).toBuffer();
  return {
    buffer,
    mimeType: "image/webp",
    sizeBytes: buffer.length,
  };
}
