import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_UPLOAD_SIZE_BYTES,
  MAX_PHOTO_UPLOAD_SIZE_MB,
  mapStorageUploadErrorMessage,
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
  PHOTO_UPLOAD_ACCEPT,
  validatePhotoFileSelection,
  validatePhotoUploadFile,
} from "@/lib/photos/upload-limits";
import { REQUIRED_SECTION_PHOTO_KEYS, TECHNIKA_SECTION_PHOTOS } from "@/lib/client-portal/poptavka-technika-podminky";

describe("MAX_PHOTO_UPLOAD_SIZE", () => {
  it("je 20 MB v bajtech, ne rozměr obrázku", () => {
    expect(MAX_PHOTO_UPLOAD_SIZE_MB).toBe(20);
    expect(MAX_PHOTO_UPLOAD_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });
});

describe("validatePhotoUploadFile", () => {
  it("projde soubor do 20 MB", () => {
    const result = validatePhotoUploadFile({
      name: "rozvadec.jpg",
      type: "image/jpeg",
      size: MAX_PHOTO_UPLOAD_SIZE_BYTES,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mimeType).toBe("image/jpeg");
  });

  it("zastaví soubor nad 20 MB před uploadem", () => {
    const result = validatePhotoUploadFile({
      name: "velka.jpg",
      type: "image/jpeg",
      size: MAX_PHOTO_UPLOAD_SIZE_BYTES + 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "file_too_large",
      message: "Fotka je příliš velká. Maximální velikost jedné fotky je 20 MB.",
    });
  });

  it("odmítne nepovolený MIME typ", () => {
    const result = validatePhotoUploadFile({
      name: "soubor.pdf",
      type: "application/pdf",
      size: 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_type");
  });

  it("povolí jpeg, png, webp a heic při výběru", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ] as const) {
      expect(validatePhotoFileSelection({ name: "a.bin", type, size: 100 }).ok).toBe(
        true
      );
    }
  });

  it("accept atribut zahrnuje heic/heif", () => {
    expect(PHOTO_UPLOAD_ACCEPT).toContain("image/heic");
    expect(PHOTO_UPLOAD_ACCEPT).toContain(".heic");
    expect(PHOTO_UPLOAD_ACCEPT).toContain(".heif");
  });
});

describe("validatePhotoUploadFile (server / storage)", () => {
  it("odmítne HEIC bez konverze srozumitelnou hláškou", () => {
    const result = validatePhotoUploadFile({
      name: "iphone.heic",
      type: "image/heic",
      size: 1024,
    });
    expect(result).toEqual({
      ok: false,
      code: "heic_unsupported",
      message: PHOTO_HEIC_UNSUPPORTED_MESSAGE,
    });
  });

  it("projde JPEG po konverzi z iPhonu", () => {
    const result = validatePhotoUploadFile({
      name: "iphone.jpg",
      type: "image/jpeg",
      size: 1024,
    });
    expect(result.ok).toBe(true);
  });
});

describe("mapStorageUploadErrorMessage", () => {
  it("převede Supabase limit na lidskou hlášku", () => {
    expect(mapStorageUploadErrorMessage("Payload too large")).toBe(
      "Fotka překročila limit 20 MB."
    );
    expect(mapStorageUploadErrorMessage("maximum allowed size exceeded")).toBe(
      "Fotka překročila limit 20 MB."
    );
  });

  it("neznámou chybu nepřepisuje", () => {
    expect(mapStorageUploadErrorMessage("network error")).toBeNull();
  });
});

describe("parkování bez uploadu fotek", () => {
  it("technické sekce nenabízejí misto_akce / parkování", () => {
    expect(TECHNIKA_SECTION_PHOTOS.some((section) => section.key === "misto_akce")).toBe(
      false
    );
    expect(REQUIRED_SECTION_PHOTO_KEYS).not.toContain("misto_akce");
  });

  it("parkování vyžaduje jen ostatní technické sekce", () => {
    expect(REQUIRED_SECTION_PHOTO_KEYS).toEqual([
      "rozvadec",
      "prijezd",
      "plocha_stage",
      "povrch_pristup",
      "jina",
    ]);
  });
});
