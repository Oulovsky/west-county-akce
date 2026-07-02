import { describe, expect, it } from "vitest";
import {
  heicFileToJpegName,
  isHeicPhotoFile,
  isHeicPhotoMime,
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
} from "@/lib/photos/heic-support";

describe("isHeicPhotoFile", () => {
  it("rozpozná image/heic a image/heif", () => {
    expect(isHeicPhotoFile({ name: "a.heic", type: "image/heic" })).toBe(true);
    expect(isHeicPhotoFile({ name: "a.heif", type: "image/heif" })).toBe(true);
  });

  it("rozpozná příponu .heic / .heif bez MIME", () => {
    expect(isHeicPhotoFile({ name: "IMG_1234.HEIC", type: "" })).toBe(true);
    expect(isHeicPhotoFile({ name: "photo.heif", type: "application/octet-stream" })).toBe(
      true
    );
  });

  it("nepovažuje JPEG za HEIC", () => {
    expect(isHeicPhotoFile({ name: "a.jpg", type: "image/jpeg" })).toBe(false);
  });
});

describe("heicFileToJpegName", () => {
  it("přejmenuje .heic na .jpg", () => {
    expect(heicFileToJpegName("rozvadec.HEIC")).toBe("rozvadec.jpg");
  });
});

describe("isHeicPhotoMime", () => {
  it("rozliší heic/heif MIME", () => {
    expect(isHeicPhotoMime("image/heic")).toBe(true);
    expect(isHeicPhotoMime("image/jpeg")).toBe(false);
  });
});

describe("PHOTO_HEIC_UNSUPPORTED_MESSAGE", () => {
  it("obsahuje návod pro iPhone", () => {
    expect(PHOTO_HEIC_UNSUPPORTED_MESSAGE).toContain("HEIC");
    expect(PHOTO_HEIC_UNSUPPORTED_MESSAGE).toContain("Nejkompatibilnější");
  });
});
