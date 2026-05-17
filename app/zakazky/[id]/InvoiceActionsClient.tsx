"use client";

import { useTransition } from "react";
import {
  archiveZakazkaAction,
  cancelInvoiceAction,
  issueInvoiceAction,
  markInvoicePaidAction,
  sendInvoiceEmailAction,
} from "./invoice-actions";

type InvoiceActionsClientProps = {
  zakazkaId: string;
  invoiceId?: string | null;
  printHref?: string | null;
  pdfHref?: string | null;
};

export function InvoiceActionsClient({
  zakazkaId,
  invoiceId,
  printHref,
  pdfHref,
}: InvoiceActionsClientProps) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        window.alert(result.error ?? "Akce se nepovedla.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => issueInvoiceAction(zakazkaId))}
        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Vystavit fakturu
      </button>

      {invoiceId && printHref ? (
        <a
          href={printHref}
          target="_blank"
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          Vytisknout fakturu
        </a>
      ) : null}

      {invoiceId && pdfHref ? (
        <a
          href={pdfHref}
          className="rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/25"
        >
          Stáhnout PDF
        </a>
      ) : null}

      {invoiceId ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => sendInvoiceEmailAction(zakazkaId, invoiceId))}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Odeslat fakturu klientovi
        </button>
      ) : null}

      {invoiceId ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const amountRaw = window.prompt("Částka úhrady v Kč (prázdné = celkem podle faktury):", "");
            if (amountRaw === null) return;
            const note = window.prompt("Poznámka k úhradě (volitelné):", "") ?? "";
            const trimmedAmount = amountRaw.trim();
            const amount = trimmedAmount ? Number(trimmedAmount.replace(",", ".")) : null;
            if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
              window.alert("Částka úhrady musí být číslo 0 nebo vyšší.");
              return;
            }
            run(() => markInvoicePaidAction(zakazkaId, invoiceId, amount, note));
          }}
          className="rounded-xl border border-lime-500/40 bg-lime-500/15 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:bg-lime-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Označit jako uhrazeno
        </button>
      ) : null}

      {invoiceId ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const reason = window.prompt("Důvod storna faktury:");
            if (reason === null) return;
            if (!reason.trim()) {
              window.alert("Storno faktury vyžaduje důvod.");
              return;
            }
            run(() => cancelInvoiceAction(zakazkaId, invoiceId, reason));
          }}
          className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Stornovat fakturu
        </button>
      ) : null}

      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => archiveZakazkaAction(zakazkaId))}
        className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Archivovat
      </button>
    </div>
  );
}
