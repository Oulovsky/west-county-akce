"use client";

import { submitPoptavkaAction } from "@/app/portal/poptavky/actions";

export default function PoptavkaSubmitButton({
  poptavkaId,
}: {
  poptavkaId: string;
}) {
  return (
    <form
      action={submitPoptavkaAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Odeslat poptávku WEST COUNTY ke kontrole? Po odeslání ji už nebudete moci upravovat."
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="poptavka_id" value={poptavkaId} />
      <button
        type="submit"
        className="rounded-xl border border-emerald-500/60 bg-emerald-500/20 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30"
      >
        Odeslat poptávku
      </button>
    </form>
  );
}
