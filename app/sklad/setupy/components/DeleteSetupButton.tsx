"use client";

import { useTransition } from "react";
import { deleteSetupAction } from "../setupActions";

type Props = {
  setupId: string;
};

export function DeleteSetupButton({ setupId }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Opravdu chcete smazat setup?")) return;
        startTransition(async () => {
          await deleteSetupAction(setupId);
        });
      }}
      className="min-h-12 w-full rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-900 disabled:opacity-60"
    >
      {pending ? "Mažu…" : "Smazat setup"}
    </button>
  );
}
