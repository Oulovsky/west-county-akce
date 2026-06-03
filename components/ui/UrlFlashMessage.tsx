"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlFlashRule = {
  param: string;
  variant?: "success" | "error";
  /** Map URL param value → message. If missing, raw value is shown (errors). */
  messages?: Record<string, string>;
  decode?: boolean;
};

export type UrlFlashMessageProps = {
  rules: UrlFlashRule[];
  /** Query params removed from the URL after the flash is dismissed. */
  removeParams: string[];
  dismissMs?: number;
  errorDismissMs?: number;
  className?: string;
};

type ActiveFlash = {
  key: string;
  text: string;
  variant: "success" | "error";
};

function resolveFlashFromParams(
  searchParams: URLSearchParams,
  rules: UrlFlashRule[]
): ActiveFlash | null {
  for (const rule of rules) {
    const raw = searchParams.get(rule.param);
    if (!raw) continue;

    const value = rule.decode ? decodeURIComponent(raw) : raw;
    const text =
      rule.messages?.[raw] ??
      rule.messages?.[value] ??
      (rule.variant === "error" || !rule.messages ? value : null);

    if (!text) continue;

    return {
      key: `${rule.param}:${raw}`,
      text,
      variant: rule.variant ?? "success",
    };
  }
  return null;
}

const VARIANT_CLASS: Record<ActiveFlash["variant"], string> = {
  success: "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100",
  error: "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100",
};

/**
 * Reads flash params from the URL, shows a short message, then removes flash params
 * so a refresh does not show the message again.
 */
export function UrlFlashMessage({
  rules,
  removeParams,
  dismissMs = 5000,
  errorDismissMs = 8000,
  className = "",
}: UrlFlashMessageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const urlCleanedRef = useRef(false);

  const flashFromUrl = useMemo(
    () => resolveFlashFromParams(searchParams, rules),
    [searchParams, rules]
  );

  const [visibleFlash, setVisibleFlash] = useState<ActiveFlash | null>(null);
  const lastFlashKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flashFromUrl) return;
    if (flashFromUrl.key === lastFlashKeyRef.current) return;
    lastFlashKeyRef.current = flashFromUrl.key;
    urlCleanedRef.current = false;
    setVisibleFlash(flashFromUrl);
  }, [flashFromUrl]);

  const cleanUrl = useCallback(() => {
    if (urlCleanedRef.current) return;

    const next = new URLSearchParams(searchParams.toString());
    let changed = false;

    for (const param of removeParams) {
      if (next.has(param)) {
        next.delete(param);
        changed = true;
      }
    }

    if (!changed) {
      urlCleanedRef.current = true;
      return;
    }

    urlCleanedRef.current = true;
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, removeParams, router, searchParams]);

  useEffect(() => {
    if (!visibleFlash) return;

    const ms = visibleFlash.variant === "error" ? errorDismissMs : dismissMs;
    const timer = window.setTimeout(() => {
      setVisibleFlash(null);
      cleanUrl();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [visibleFlash, dismissMs, errorDismissMs, cleanUrl]);

  if (!visibleFlash) return null;

  return (
    <p
      role="status"
      className={[VARIANT_CLASS[visibleFlash.variant], className].filter(Boolean).join(" ")}
    >
      {visibleFlash.text}
    </p>
  );
}
