"use client";

import { useEffect, useState } from "react";
import { poptavkaFotkaPreviewUrl } from "@/lib/client-portal/poptavka-fotky-shared";

type PoptavkaFotkaImageProps = {
  fotkaId: string;
  poptavkaId?: string;
  alt: string;
  thumbnailSignedUrl?: string | null;
  signedUrl?: string | null;
  className?: string;
  aspectClassName?: string;
  lazyOriginalFallback?: boolean;
  onClickExpand?: boolean;
};

export default function PoptavkaFotkaImage({
  fotkaId,
  poptavkaId,
  alt,
  thumbnailSignedUrl = null,
  signedUrl = null,
  className = "aspect-square w-full bg-black/20 object-contain",
  aspectClassName,
  lazyOriginalFallback = true,
  onClickExpand = true,
}: PoptavkaFotkaImageProps) {
  const previewUrl = poptavkaFotkaPreviewUrl({ thumbnailSignedUrl, signedUrl });
  const [displayUrl, setDisplayUrl] = useState<string | null>(previewUrl);
  const [originalUrl, setOriginalUrl] = useState<string | null>(signedUrl);
  const [expanded, setExpanded] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setDisplayUrl(previewUrl);
    setOriginalUrl(signedUrl);
    setExpanded(false);
    setLoadError(false);
  }, [fotkaId, previewUrl, signedUrl]);

  useEffect(() => {
    if (previewUrl || !lazyOriginalFallback || !poptavkaId) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingOriginal(true);
      try {
        const params = new URLSearchParams({
          poptavka_id: poptavkaId,
          fotka_id: fotkaId,
        });
        const response = await fetch(`/api/portal/poptavka-fotky/original?${params.toString()}`);
        const payload = (await response.json()) as { ok: boolean; signedUrl?: string };
        if (cancelled) return;
        if (payload.ok && payload.signedUrl) {
          setDisplayUrl(payload.signedUrl);
          setOriginalUrl(payload.signedUrl);
        } else {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoadingOriginal(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewUrl, lazyOriginalFallback, poptavkaId, fotkaId]);

  async function handleExpand() {
    if (!onClickExpand) return;
    if (originalUrl) {
      setExpanded(true);
      return;
    }
    if (!poptavkaId) return;

    setLoadingOriginal(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({
        poptavka_id: poptavkaId,
        fotka_id: fotkaId,
      });
      const response = await fetch(`/api/portal/poptavka-fotky/original?${params.toString()}`);
      const payload = (await response.json()) as { ok: boolean; signedUrl?: string };
      if (payload.ok && payload.signedUrl) {
        setOriginalUrl(payload.signedUrl);
        setExpanded(true);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoadingOriginal(false);
    }
  }

  if (!displayUrl && !loadingOriginal) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-[10px] text-slate-500 ${aspectClassName ?? className}`}
      >
        {loadError ? "Náhled nedostupný" : "Náhled"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`relative block w-full ${onClickExpand ? "cursor-zoom-in" : "cursor-default"}`}
        onClick={() => void handleExpand()}
        disabled={!onClickExpand}
        aria-label={onClickExpand ? `Zobrazit originál: ${alt}` : undefined}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className={`flex items-center justify-center bg-white/5 text-[10px] text-slate-400 ${aspectClassName ?? className}`}
          >
            Načítám…
          </div>
        )}
        {loadingOriginal && displayUrl ? (
          <div className="absolute inset-0 flex items-end justify-end p-1">
            <span className="rounded bg-black/50 px-1 py-0.5 text-[9px] text-slate-200">…</span>
          </div>
        ) : null}
      </button>

      {expanded && originalUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
        >
          <img
            src={originalUrl}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
    </>
  );
}
