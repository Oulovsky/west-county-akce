"use client";

import {
  approvePoptavkaAction,
  convertPoptavkaToZakazkaAction,
  rejectPoptavkaAction,
  returnPoptavkaToRevisionAction,
  updatePoptavkaInterniPoznamkaAction,
} from "@/app/zakazky/poptavky/actions";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  missing_reason: "Vyplňte důvod nebo poznámku.",
  invalid_state: "Akce není pro aktuální stav poptávky dostupná.",
  save_failed: "Uložení se nezdařilo.",
  not_found: "Poptávka nenalezena.",
  missing_klient: "Poptávka nemá přiřazeného klienta.",
  missing_akce_datum: "Chybí termín akce pro vytvoření zakázky.",
  create_failed: "Vytvoření zakázky se nezdařilo.",
  link_failed: "Zakázka byla vytvořena, ale dokončení vazby selhalo. Zkuste akci znovu.",
};

export default function PoptavkaInboxActions({
  poptavkaId,
  stav,
  canAct,
  canConvert,
  zakazkaId,
  errorCode,
  readOnly = false,
}: {
  poptavkaId: string;
  stav: PoptavkaStav;
  canAct: boolean;
  canConvert?: boolean;
  zakazkaId?: string | null;
  errorCode?: string | null;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return zakazkaId ? (
      <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-xl font-semibold text-white">Interní zakázka</h2>
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-4 text-sm text-blue-100">
          <p className="text-slate-300">Poptávka byla převedena do interní zakázky.</p>
          <Link
            href={`/zakazky/${zakazkaId}`}
            className="mt-3 inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-600/30"
          >
            Otevřít zakázku →
          </Link>
        </div>
      </section>
    ) : null;
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-blue-500/40 focus:ring-2";

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">První reakce na poptávku</h2>
        <p className="mt-1 text-sm text-slate-400">
          Rozhodněte, zda poptávka zajímá, potřebuje doplnění, nebo ji nelze realizovat.
        </p>
      </div>

      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {ERROR_MESSAGES[errorCode]}
        </p>
      ) : null}

      {zakazkaId ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-4 text-sm text-blue-100">
          <div className="font-semibold text-white">Interní zakázka</div>
          <p className="mt-1 text-slate-300">
            Poptávka byla převedena do interní zakázky.
          </p>
          <Link
            href={`/zakazky/${zakazkaId}`}
            className="mt-3 inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-600/30"
          >
            Otevřít zakázku →
          </Link>
        </div>
      ) : null}

      {canConvert ? (
        <form
          action={convertPoptavkaToZakazkaAction}
          onSubmit={(event) => {
            const confirmed = window.confirm(
              "Vytvořit interní zakázku z této schválené poptávky? Převedou se údaje, setupy a technické podklady."
            );
            if (!confirmed) event.preventDefault();
          }}
          className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-950/10 p-4"
        >
          <h3 className="font-semibold text-blue-100">Vytvořit zakázku</h3>
          <input type="hidden" name="poptavka_id" value={poptavkaId} />
          <p className="text-sm leading-relaxed text-slate-400">
            Ze schválené poptávky vznikne interní zakázka s plánem techniky. Konkrétní skladové kusy
            se neřadí — ty vzniknou až při scanování. Závazná objednávka klientem bude řešena v
            dalším kroku workflow.
          </p>
          <button
            type="submit"
            className="rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-600/30"
          >
            Vytvořit zakázku
          </button>
        </form>
      ) : null}

      {!canAct ? (
        <p className="text-sm text-slate-400">
          Poptávka je ve stavu <strong className="text-slate-200">{stav}</strong>. Stavové akce
          nejsou dostupné.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form action={returnPoptavkaToRevisionAction} className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
            <h3 className="font-semibold text-amber-100">Zajímá nás — požádat o doplnění</h3>
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <p className="text-sm leading-relaxed text-slate-400">
              Poptávka vás zajímá, ale potřebujete od klienta doplnit technické údaje nebo upřesnit
              zadání. Klient dostane žádost e-mailem nebo ručně přes připravený text.
            </p>
            <label className="block text-sm text-slate-300">
              Co má klient doplnit
              <textarea
                name="duvod"
                required
                rows={4}
                className={inputClass}
                placeholder="Co má klient doplnit nebo upravit…"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border border-amber-500/40 bg-amber-600/20 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-600/30"
            >
              Požádat o doplnění
            </button>
          </form>

          <form action={rejectPoptavkaAction} className="space-y-3 rounded-xl border border-red-500/20 bg-red-950/10 p-4">
            <h3 className="font-semibold text-red-100">Nezajímá / odmítnout</h3>
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <p className="text-sm leading-relaxed text-slate-400">
              Poptávku nelze nebo nechcete realizovat. Klient dostane informaci s důvodem odmítnutí.
            </p>
            <label className="block text-sm text-slate-300">
              Důvod pro klienta
              <textarea
                name="duvod"
                required
                rows={4}
                className={inputClass}
                placeholder="Důvod, který uvidí klient…"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-50 hover:bg-red-600/30"
            >
              Odmítnout poptávku
            </button>
          </form>

          <form
            action={approvePoptavkaAction}
            onSubmit={(event) => {
              const confirmed = window.confirm(
                "Schválit poptávku k převodu? Zakázka se zatím nevytvoří — změní se pouze interní stav. Závazná objednávka klientem bude řešena v dalším kroku workflow."
              );
              if (!confirmed) event.preventDefault();
            }}
            className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4"
          >
            <h3 className="font-semibold text-emerald-100">Schválit k převodu</h3>
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <p className="text-sm leading-relaxed text-slate-400">
              Interně schválí poptávku pro další práci a případný převod na zakázku. Nejde o závaznou
              objednávku ani finální potvrzení klientem — ty budou řešeny v dalším kroku workflow.
            </p>
            <button
              type="submit"
              className="rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-600/30"
            >
              Schválit k převodu
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export function PoptavkaInterniPoznamkaForm({
  poptavkaId,
  defaultValue,
  readOnly = false,
}: {
  poptavkaId: string;
  defaultValue: string;
  readOnly?: boolean;
}) {
  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-blue-500/40 focus:ring-2";

  if (readOnly) {
    if (!defaultValue.trim()) return null;
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-xl font-semibold text-white">Interní poznámka</h2>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{defaultValue}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="text-xl font-semibold text-white">Interní poznámka</h2>
      <p className="mt-1 text-sm text-slate-400">Viditelná pouze pro interní tým. Klient ji neuvidí.</p>
      <form action={updatePoptavkaInterniPoznamkaAction} className="mt-4 space-y-3">
        <input type="hidden" name="poptavka_id" value={poptavkaId} />
        <textarea
          name="interni_poznamka"
          defaultValue={defaultValue}
          rows={5}
          className={inputClass}
          placeholder="Interní poznámky k poptávce…"
        />
        <button
          type="submit"
          className="rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-600/30"
        >
          Uložit interní poznámku
        </button>
      </form>
    </section>
  );
}
