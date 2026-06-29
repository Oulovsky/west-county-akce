import { TECHNIKA_SECTION_PHOTOS } from "@/lib/client-portal/poptavka-technika-podminky";
import type { TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-shared";
import { dedupeSavedSectionFotky } from "@/lib/client-portal/poptavka-fotky-dedup";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";

export type SavedSectionFotka = {
  id: string;
  typ: PoptavkaFotkaTyp;
  popis: string | null;
  original_filename: string | null;
  thumbnailSignedUrl: string | null;
  signedUrl: string | null;
};

export type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status?: "pending" | "uploading" | "failed";
  errorMessage?: string;
};

export type SectionPhotoState = {
  pending: PendingPhoto[];
  saved: SavedSectionFotka[];
};

export function emptySectionPhotoState(): SectionPhotoState {
  return { pending: [], saved: [] };
}

export function createInitialSectionPhotos(
  initialFotky: PoptavkaFotkaWithUrl[] = []
): Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> {
  const map: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> = {};

  for (const section of TECHNIKA_SECTION_PHOTOS) {
    map[section.key] = {
      ...emptySectionPhotoState(),
      saved: dedupeSavedSectionFotky(
        initialFotky
          .filter((row) => row.typ === section.typ)
          .map((row) => ({
            id: row.id,
            typ: row.typ,
            popis: row.popis,
            original_filename: row.original_filename,
            thumbnailSignedUrl: row.thumbnailSignedUrl,
            signedUrl: row.signedUrl,
          }))
      ),
    };
  }

  return map;
}
