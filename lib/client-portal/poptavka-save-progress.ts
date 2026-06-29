export type PoptavkaSaveProgressPhase =
  | "validate"
  | "basic"
  | "place_technika"
  | "sestava"
  | "photos"
  | "finalize"
  | "done";

export type PoptavkaSaveProgressState = {
  percent: number;
  label: string;
  phase: PoptavkaSaveProgressPhase;
  photoUploaded?: number;
  photoTotal?: number;
};

const PHASE_BASE: Record<PoptavkaSaveProgressPhase, number> = {
  validate: 10,
  basic: 25,
  place_technika: 45,
  sestava: 65,
  photos: 85,
  finalize: 95,
  done: 100,
};

export function progressForPhase(
  phase: PoptavkaSaveProgressPhase,
  label: string,
  options?: { photoUploaded?: number; photoTotal?: number }
): PoptavkaSaveProgressState {
  let percent = PHASE_BASE[phase];

  if (
    phase === "photos" &&
    options?.photoTotal &&
    options.photoTotal > 0 &&
    options.photoUploaded != null
  ) {
    const photoSpan = PHASE_BASE.photos - PHASE_BASE.sestava;
    const ratio = Math.min(1, options.photoUploaded / options.photoTotal);
    percent = Math.round(PHASE_BASE.sestava + photoSpan * ratio);
  }

  return {
    percent,
    label,
    phase,
    photoUploaded: options?.photoUploaded,
    photoTotal: options?.photoTotal,
  };
}

export const SAVE_PROGRESS_LABELS = {
  validate: "Kontroluji formulář…",
  basic: "Ukládám základní údaje…",
  place_technika: "Ukládám místo a technické údaje…",
  sestava: "Ukládám konfiguraci sestavy…",
  finalize: "Dokončuji poptávku…",
  finalizeEmail: "Odesíláme potvrzovací e-mail…",
  done: "Hotovo",
} as const;

export function photoUploadLabel(uploaded: number, total: number) {
  return `Nahrávám fotky ${uploaded}/${total}…`;
}
