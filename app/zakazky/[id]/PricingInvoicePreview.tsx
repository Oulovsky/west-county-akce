"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/invoice/InvoiceDocument";

type PricingInvoicePreviewProps = {
  data: InvoiceDocumentData;
};

export function PricingInvoicePreview({ data }: PricingInvoicePreviewProps) {
  const [open, setOpen] = useState(false);

  function printInvoice() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .invoice-print-root,
          .invoice-print-root * {
            visibility: visible !important;
          }

          .invoice-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: #fff !important;
          }

          .invoice-print-root .invoice-document {
            margin: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
            color: #000 !important;
          }

          .invoice-print-root .invoice-document,
          .invoice-print-root .invoice-document * {
            background: #fff !important;
            color: #000 !important;
          }

          .invoice-no-print {
            display: none !important;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      >
        Zobrazit fakturu
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Objednávka / cenové potvrzení" widthClassName="max-w-5xl">
        <div className="max-h-[80vh] space-y-4 overflow-y-auto">
          <div className="invoice-print-root">
            <InvoiceDocument data={data} />
          </div>

          <div className="invoice-no-print flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={printInvoice}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Vytisknout fakturu
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Zavřít
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
