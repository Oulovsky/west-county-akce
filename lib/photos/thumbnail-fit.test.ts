import { describe, expect, it } from "vitest";
import {
  computeFitInsideDimensions,
  fitsInsideWithoutCrop,
  preservesAspectRatio,
} from "@/lib/photos/thumbnail-fit";
import { POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE } from "@/lib/client-portal/poptavka-fotky-thumbnail-client";

describe("computeFitInsideDimensions", () => {
  it("zachová poměr stran u širokého rozvaděče", () => {
    const result = computeFitInsideDimensions(4000, 3000, 1200);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(900);
    expect(preservesAspectRatio(4000, 3000, result.width, result.height)).toBe(true);
    expect(fitsInsideWithoutCrop(4000, 3000, result.width, result.height)).toBe(true);
  });

  it("zachová poměr stran u vysokého snímku", () => {
    const result = computeFitInsideDimensions(2000, 5000, 1200);
    expect(result.height).toBe(1200);
    expect(result.width).toBe(480);
    expect(preservesAspectRatio(2000, 5000, result.width, result.height)).toBe(true);
  });

  it("nezvětší menší obrázek", () => {
    const result = computeFitInsideDimensions(800, 600, 1200);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.scale).toBe(1);
  });

  it("neořízne — obě strany jsou menší nebo rovny originálu", () => {
    const source = { width: 3000, height: 2000 };
    const result = computeFitInsideDimensions(
      source.width,
      source.height,
      POPTAVKA_FOTKA_THUMBNAIL_MAX_SIDE
    );
    expect(result.width).toBeLessThanOrEqual(source.width);
    expect(result.height).toBeLessThanOrEqual(source.height);
    expect(fitsInsideWithoutCrop(source.width, source.height, result.width, result.height)).toBe(
      true
    );
  });

  it("nepoužívá pevný čtverec — rozměry se liší podle poměru", () => {
    const wide = computeFitInsideDimensions(3200, 800, 1200);
    const tall = computeFitInsideDimensions(800, 3200, 1200);
    expect(wide.width).not.toBe(wide.height);
    expect(tall.width).not.toBe(tall.height);
    expect(wide.width).toBeGreaterThan(wide.height);
    expect(tall.height).toBeGreaterThan(tall.width);
  });
});
