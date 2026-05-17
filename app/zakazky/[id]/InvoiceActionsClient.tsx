"use client";

import { useTransition } from "react";
import {
  archiveZakazkaAction,
  issueInvoiceAction,
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
