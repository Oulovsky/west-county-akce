import { uploadPoptavkaFotkyAction } from "@/app/portal/poptavky/actions";
import { TECHNIKA_SECTION_PHOTOS } from "@/lib/client-portal/poptavka-technika-podminky";
import type { TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";

type PendingSectionPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export async function uploadPendingSectionPhotosForPoptavka(
  poptavkaId: string,
  pendingBySection: Partial<Record<TechnikaSectionPhotoKey, PendingSectionPhoto[]>>
) {
  for (const section of TECHNIKA_SECTION_PHOTOS) {
    const photos = pendingBySection[section.key];
    if (!photos?.length) continue;

    const formData = new FormData();
    formData.set("poptavka_id", poptavkaId);
    for (const photo of photos) {
      formData.append("photo_files", photo.file, photo.file.name);
      formData.append("photo_types", section.typ);
      formData.append("photo_descriptions", "");
    }

    const result = await uploadPoptavkaFotkyAction(formData);
    if (!result.ok) {
      throw new Error(result.error ?? "upload_failed");
    }
  }
}
