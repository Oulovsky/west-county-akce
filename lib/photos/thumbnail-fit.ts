/**
 * Vypočítá rozměry náhledu „fit inside“ — zachová poměr stran, bez ořezu.
 * maxSide je limit delší strany v pixelech (ne velikost souboru v bajtech).
 */
export function computeFitInsideDimensions(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0 || maxSide <= 0) {
    return { width: 1, height: 1, scale: 1 };
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/** Ověří, že fit inside zachová poměr stran (tolerance kvůli zaokrouhlení). */
export function preservesAspectRatio(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  tolerance = 0.02
): boolean {
  if (sourceWidth <= 0 || sourceHeight <= 0) return false;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  return Math.abs(sourceRatio - targetRatio) <= tolerance;
}

/** Fit inside nesmí ořezat — obě strany musí být <= originálu (při zmenšení). */
export function fitsInsideWithoutCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): boolean {
  if (targetWidth > sourceWidth || targetHeight > sourceHeight) {
    return targetWidth <= sourceWidth && targetHeight <= sourceHeight;
  }
  return true;
}
