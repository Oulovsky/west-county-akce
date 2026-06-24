"use client";

import { useState } from "react";

type CopyField = "full" | "text" | "link" | "subject";

export default function PoptavkaOutboundMessagePanel({
  subject,
  fullText,
  bodyText,
  link,
  emailTo,
}: {
  subject: string;
  fullText: string;
  bodyText: string;
  link: string;
  emailTo: string | null;
}) {
  const [copied, setCopied] = useState<CopyField | null>(null);

  async function copyValue(field: CopyField, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const buttonClass =
    "rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800";

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-4 text-sm text-amber-50">
      <div>
        <p className="font-semibold text-amber-100">Ruční odeslání klientovi</p>
        <p className="mt-1 text-amber-100/80">
          E-mail nebyl odeslán automaticky. Zkopírujte text níže a pošlete klientovi ručně
          {emailTo ? ` na ${emailTo}` : " (e-mail klienta není v systému k dispozici)"}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void copyValue("full", fullText)}>
          {copied === "full" ? "Zkopírováno" : "Kopírovat celý e-mail"}
        </button>
        <button type="button" className={buttonClass} onClick={() => void copyValue("subject", subject)}>
          {copied === "subject" ? "Zkopírováno" : "Kopírovat předmět"}
        </button>
        <button type="button" className={buttonClass} onClick={() => void copyValue("text", bodyText)}>
          {copied === "text" ? "Zkopírováno" : "Kopírovat text"}
        </button>
        <button type="button" className={buttonClass} onClick={() => void copyValue("link", link)}>
          {copied === "link" ? "Zkopírováno" : "Kopírovat odkaz"}
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-slate-200">
        <div>
          <span className="text-slate-500">Předmět: </span>
          {subject}
        </div>
        {emailTo ? (
          <div>
            <span className="text-slate-500">Komu: </span>
            {emailTo}
          </div>
        ) : null}
        <div>
          <span className="text-slate-500">Odkaz: </span>
          <a href={link} className="text-blue-300 underline break-all">
            {link}
          </a>
        </div>
        <pre className="mt-2 whitespace-pre-wrap break-words text-slate-300">{bodyText}</pre>
      </div>
    </div>
  );
}
