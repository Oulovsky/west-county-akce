"use client";

import { useTransition } from "react";
import { deleteSetupAction } from "../setupActions";

type Props = {
  setupId: string;
};

const buttonClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-red-800 bg-red-950 px-4 text-sm font-black text-red-100 whitespace-nowrap transition hover:bg-red-900 disabled:opacity-60";

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
      className={buttonClass}
    >
      {pending ? "Mažu…" : "Smazat setup"}
    </button>
  );
}
