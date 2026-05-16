"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/modal";
import {
  getSkladKusQrPayload,
  getSkladKusFuturePath,
  type SkladKusLabelPayload,
} from "@/lib/sklad/kusLabels";

type Props = {
  open: boolean;
  labels: SkladKusLabelPayload[];
  onClose: () => void;
  autoPrintOnOpen?: boolean;
};

const LABEL_WIDTH_MM = 62;
const LABEL_HEIGHT_MM = 29;

function emptyText(value: number | string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text || "—";
}

function labelPositionText(label: SkladKusLabelPayload): string {
  const position = emptyText(label.position);
  if (position !== "—") return `Pozice ${position}`;

  const sector = emptyText(label.sector);
  if (sector !== "—") return `Pozice ${sector}`;

  return "Pozice —";
}

function SkladKusPrintableLabel({
  label,
  qrSvg,
}: {
  label: SkladKusLabelPayload;
  qrSvg: string | undefined;
}) {
  return (
    <article
      className="sklad-kus-label flex border border-neutral-300 bg-white p-[1.7mm] text-black"
      style={{
        width: `${LABEL_WIDTH_MM}mm`,
        height: `${LABEL_HEIGHT_MM}mm`,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      aria-label={`Štítek kusu ${label.kusId}`}
    >
      <div className="flex h-full w-[23mm] shrink-0 items-center justify-center">
        {qrSvg ? (
          <div
            className="h-[22.2mm] w-[22.2mm]"
            aria-label={`QR kusu ${label.kusId}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : (
          <div className="h-[22.2mm] w-[22.2mm] animate-pulse bg-neutral-200" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between pl-[2mm]">
        <div className="min-w-0">
          <div
            className="text-[10px] font-black uppercase leading-[1.02] tracking-[-0.03em]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {label.itemName}
          </div>
          <div className="mt-[0.8mm] text-[10.8px] font-black leading-none tracking-[-0.02em]">
            Kus #{emptyText(label.poradoveCislo)}
          </div>
        </div>

        <div className="min-w-0 border-t-2 border-black pt-[1mm]">
          <div className="truncate text-[16px] font-black leading-[0.92] tracking-[-0.06em]">
            {labelPositionText(label)}
          </div>
        </div>
      </div>
    </article>
  );
}

export function KusLabelPrintDialog({
  open,
  labels,
  onClose,
  autoPrintOnOpen = false,
}: Props) {
  const [qrSvgs, setQrSvgs] = useState<Record<string, string>>({});
  const autoPrintFiredRef = useRef(false);

  const normalizedLabels = useMemo(
    () => labels.filter((label) => label.kusId.trim()),
    [labels]
  );

  useEffect(() => {
    if (!open) {
      autoPrintFiredRef.current = false;
      return;
    }

    let alive = true;

    async function buildQrCodes() {
      const pairs = await Promise.all(
        normalizedLabels.map(async (label) => {
          const qrPayload = getSkladKusQrPayload(label.kusId, window.location.origin);
          const svg = await QRCode.toString(qrPayload, {
            type: "svg",
            errorCorrectionLevel: "M",
            margin: 0,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
          return [label.kusId, svg] as const;
        })
      );

      if (!alive) return;
      setQrSvgs(Object.fromEntries(pairs));
    }

    setQrSvgs({});
    void buildQrCodes();

    return () => {
      alive = false;
    };
  }, [open, normalizedLabels]);

  const ready =
    normalizedLabels.length > 0 &&
    normalizedLabels.every((label) => Boolean(qrSvgs[label.kusId]));

  useEffect(() => {
    if (!open || !autoPrintOnOpen || !ready || autoPrintFiredRef.current) return;
    autoPrintFiredRef.current = true;
    window.setTimeout(() => window.print(), 50);
  }, [autoPrintOnOpen, open, ready]);

  if (!open) return null;

  const firstLabel = normalizedLabels[0];
  const firstFuturePath = firstLabel ? getSkladKusFuturePath(firstLabel.kusId) : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Náhled QR štítku"
      widthClassName="max-w-3xl"
    >
      <style>{`
        .sklad-kus-label svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        @media print {
          @page {
            size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
            margin: 0;
          }

          html,
          body {
            width: ${LABEL_WIDTH_MM}mm;
            min-height: ${LABEL_HEIGHT_MM}mm;
            margin: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .sklad-kus-label-print-root,
          .sklad-kus-label-print-root * {
            visibility: visible !important;
          }

          .sklad-kus-label-dialog-chrome {
            display: none !important;
          }

          .sklad-kus-label-print-root {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: ${LABEL_WIDTH_MM}mm !important;
            background: #fff !important;
          }

          .sklad-kus-print-sheet {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .sklad-kus-label {
            width: ${LABEL_WIDTH_MM}mm !important;
            height: ${LABEL_HEIGHT_MM}mm !important;
            border: 0 !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }

          .sklad-kus-label:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="sklad-kus-label-dialog-chrome mb-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
        <div>
          Formát: Brother DK-11209, 62x29 mm landscape, černobílý tisk přes
          prohlížeč.
        </div>
        <div>
          QR otevírá detail konkrétního kusu. Cílová cesta:{" "}
          <code className="text-slate-100">{firstFuturePath || "/sklad/kus/[kus_id]"}</code>
        </div>
        <div>
          Pro sken z mobilu nastav{" "}
          <code className="text-slate-100">NEXT_PUBLIC_APP_URL</code> na IP počítače
          v síti nebo produkční doménu; jinak se použije aktuální origin prohlížeče.
        </div>
      </div>

      <div className="sklad-kus-label-print-root">
        <div className="sklad-kus-print-sheet flex flex-wrap gap-4 rounded-xl bg-white p-4">
          {normalizedLabels.map((label) => (
            <SkladKusPrintableLabel
              key={label.kusId}
              label={label}
              qrSvg={qrSvgs[label.kusId]}
            />
          ))}
        </div>
      </div>

      <div className="sklad-kus-label-dialog-chrome mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Zavřít
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ready}
          className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ready ? "Tisknout" : "Připravuji QR…"}
        </button>
      </div>
    </Modal>
  );
}
