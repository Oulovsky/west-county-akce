"use client";

import { UrlFlashMessage, type UrlFlashRule } from "@/components/ui/UrlFlashMessage";

export const OBSAH_URL_FLASH_RULES: UrlFlashRule[] = [
  {
    param: "obsah",
    variant: "success",
    messages: {
      created: "Obsah vytvořen a vložen do case.",
      inserted: "Kus vložen do case.",
      removed: "Kus odebrán z case.",
    },
  },
  {
    param: "obsahError",
    variant: "error",
    decode: true,
  },
];

export const OBSAH_URL_FLASH_REMOVE_PARAMS = ["obsah", "obsahError", "obsahMode"] as const;

type ObsahUrlFlashProps = {
  className?: string;
};

export function ObsahUrlFlash({ className }: ObsahUrlFlashProps) {
  return (
    <UrlFlashMessage
      rules={OBSAH_URL_FLASH_RULES}
      removeParams={[...OBSAH_URL_FLASH_REMOVE_PARAMS]}
      className={className}
    />
  );
}
