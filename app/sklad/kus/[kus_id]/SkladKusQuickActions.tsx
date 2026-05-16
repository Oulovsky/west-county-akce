"use client";

import { useState } from "react";
import type { ZakazkaKusStav } from "@/lib/sklad/types";

const PENDING_ACTION_MESSAGE =
  "Akce se provádí v loading scan režimu konkrétní zakázky.";

const ACTIONS = [
  {
    label: "Naložit",
    className: "border-blue-600 bg-blue-600 hover:bg-blue-500",
  },
  {
    label: "Vrátit",
    className: "border-emerald-600 bg-emerald-600 hover:bg-emerald-500",
  },
  {
    label: "Poškozeno",
    className: "border-amber-600 bg-amber-600 hover:bg-amber-500",
  },
  {
    label: "Blokovat",
    className: "border-red-700 bg-red-700 hover:bg-red-600",
  },
] satisfies Array<{
  label: string;
  className: string;
}>;

type Props = {
  assignmentId: string | null;
  currentZakazkaKusStav: ZakazkaKusStav | null;
};

export function SkladKusQuickActions({
  assignmentId,
  currentZakazkaKusStav,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);

  function handleAction(action: (typeof ACTIONS)[number]) {
    const context = assignmentId
      ? `Aktuální stav vazby: ${currentZakazkaKusStav ?? "—"}.`
      : "Kus zatím nemá aktivní vazbu na zakázku.";
    setMessage(`${action.label}: ${PENDING_ACTION_MESSAGE} ${context}`);
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-white">Rychlé akce</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tento detail je informační. Loading vzniká až scanem v kontextu zakázky.
          {assignmentId ? " Vazba na zakázku je načtená." : " Aktivní zakázka zatím není přiřazená."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleAction(action)}
            className={[
              "min-h-16 rounded-2xl border px-5 py-4 text-lg font-black text-white shadow-lg shadow-black/25 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
              action.className,
            ].join(" ")}
          >
            {action.label}
          </button>
        ))}
      </div>

      {message ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100"
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
