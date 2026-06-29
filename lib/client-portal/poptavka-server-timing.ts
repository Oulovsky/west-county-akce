import "server-only";

type TimingMeta = Record<string, unknown>;

export function createPoptavkaStepTimer(scope: string, meta: TimingMeta = {}) {
  const startedAt = Date.now();
  let lastMark = startedAt;

  function log(step: string, extra: TimingMeta = {}) {
    const now = Date.now();
    const stepMs = now - lastMark;
    const totalMs = now - startedAt;
    lastMark = now;
    console.info(`[${scope}]`, {
      step,
      stepMs,
      totalMs,
      ...meta,
      ...extra,
    });
  }

  return {
    log,
    finish(extra: TimingMeta = {}) {
      log("done", extra);
    },
  };
}

export function summarizePhotoUploadBatch(files: File[]) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return {
    fileCount: files.length,
    totalBytes,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    largestMb:
      files.length > 0
        ? Math.round((Math.max(...files.map((f) => f.size)) / (1024 * 1024)) * 100) / 100
        : 0,
  };
}
