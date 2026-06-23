"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import {
  extractSkladKusIdFromInput,
  getSkladKusFuturePath,
} from "@/lib/sklad/kusLabels";

type CameraStatus = "idle" | "starting" | "scanning" | "error";

export function SkladScanClient() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("Kamera není spuštěná.");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);

  const previewKusId = useMemo(
    () =>
      extractSkladKusIdFromInput(
        value,
        typeof window === "undefined" ? "http://localhost" : window.location.origin
      ),
    [value]
  );

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const openKusFromInput = useCallback(
    (input: string): boolean => {
      const kusId = extractSkladKusIdFromInput(input, window.location.origin);
      if (!kusId) {
        setError("Zadej platnou URL /sklad/kus/[kus_id] nebo přímo kus_id.");
        return false;
      }

      setError(null);
      navigatingRef.current = true;
      stopCamera();
      router.push(getSkladKusFuturePath(kusId));
      return true;
    },
    [router, stopCamera]
  );

  const handleDetectedQr = useCallback(
    (payload: string) => {
      const kusId = extractSkladKusIdFromInput(payload, window.location.origin);
      if (!kusId || navigatingRef.current) return;

      navigatingRef.current = true;
      setScanMessage("QR načteno, otevírám kus…");
      stopCamera();
      router.push(getSkladKusFuturePath(kusId));
    },
    [router, stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || navigatingRef.current) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: "attemptBoth",
          });

          if (code?.data) {
            handleDetectedQr(code.data);
            return;
          }

          setScanMessage("Hledám QR kód…");
        }
      }
    }

    frameRef.current = window.requestAnimationFrame(scanFrame);
  }, [handleDetectedQr]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraMessage(null);
    setScanMessage("Spouštím kameru…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraMessage("Kamera není v tomto prohlížeči dostupná.");
      setScanMessage("Použij ruční vstup níže.");
      return;
    }

    try {
      setCameraStatus("starting");
      navigatingRef.current = false;
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stopCamera();
        setCameraStatus("error");
        setCameraMessage("Video náhled se nepodařilo připravit.");
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraStatus("scanning");
      setCameraMessage(null);
      setScanMessage("Hledám QR kód…");
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (err) {
      stopCamera();
      setCameraStatus("error");
      setScanMessage("Použij ruční vstup níže.");

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraMessage("Kamera není povolená. Povol přístup ke kameře v prohlížeči.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setCameraMessage("Na zařízení nebyla nalezena kamera.");
      } else {
        setCameraMessage("Kameru se nepodařilo spustit. Zkus ruční vstup.");
      }
    }
  }, [scanFrame, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openKusFromInput(value);
  }

  return (
    <div className="page-shell flex w-full flex-col gap-5">
      <section className="rounded-2xl border border-blue-900/50 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Interní QR workflow
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
          Sken skladu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          QR štítek skladu otevírá detail konkrétního kusu. Externí kamera nebo
          scanner může nejdřív ukázat URL; po otevření se zobrazí název položky,
          číslo kusu, pozice skladu a aktuální stav.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Kamera</h2>
            <p className="mt-1 text-sm text-slate-400">
              Namiř kameru na QR štítek. Po rozpoznání se detail kusu otevře automaticky.
            </p>
          </div>
          <div className="flex gap-2">
            {cameraStatus === "scanning" ? (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraStatus("idle");
                  setScanMessage("Kamera zastavená.");
                }}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                Zastavit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraStatus === "starting"}
              className="rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cameraStatus === "starting" ? "Spouštím…" : "Spustit kameru"}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
          <video
            ref={videoRef}
            className={[
              "aspect-[3/4] w-full object-cover sm:aspect-video",
              cameraStatus === "scanning" || cameraStatus === "starting"
                ? "block"
                : "hidden",
            ].join(" ")}
            muted
            playsInline
            autoPlay
          />
          {cameraStatus !== "scanning" && cameraStatus !== "starting" ? (
            <div className="flex min-h-64 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
              Kamera zatím neběží. Spusť ji tlačítkem nahoře, nebo použij ruční vstup.
            </div>
          ) : null}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          {scanMessage}
        </div>

        {cameraMessage ? (
          <div className="mt-3 rounded-xl border border-amber-900 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
            {cameraMessage}
          </div>
        ) : null}
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
      >
        <label htmlFor="scan-input" className="block text-sm font-semibold text-white">
          URL štítku nebo kus_id
        </label>
        <textarea
          id="scan-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="https://example.cz/sklad/kus/... nebo samotné kus_id"
          className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />

        {previewKusId ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
            Rozpoznaný kus:{" "}
            <code className="font-semibold text-slate-100">{previewKusId}</code>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-blue-600 bg-blue-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          Otevřít kus
        </button>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-300">
        <h2 className="font-semibold text-white">Poznámka k mobilu</h2>
        <p className="mt-2">
          Pokud QR obsahuje localhost, otevře se jen na stejném zařízení. Pro
          mobil v síti nastav při tisku štítků{" "}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-100">
            NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000
          </code>{" "}
          nebo použij produkční doménu.
        </p>
      </section>

      <Link
        href="/sklad"
        className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Zpět do skladu
      </Link>
    </div>
  );
}
