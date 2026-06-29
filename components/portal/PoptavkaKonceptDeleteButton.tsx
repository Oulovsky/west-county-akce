"use client";

import { useState } from "react";
import { deletePoptavkaDraftAction } from "@/app/portal/poptavky/actions";
import { rethrowIfNextRedirect } from "@/lib/next/isRedirectError";

export default function PoptavkaKonceptDeleteButton({ poptavkaId }: { poptavkaId: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Opravdu chcete smazat tento rozpracovaný koncept? Tato akce je nevratná."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deletePoptavkaDraftAction(poptavkaId);
    } catch (error) {
      rethrowIfNextRedirect(error);
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
    >
      {deleting ? "Mažu…" : "Smazat koncept"}
    </button>
  );
}
