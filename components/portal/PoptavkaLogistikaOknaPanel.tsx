"use client";

import {
  EMPTY_LOGISTIKA_OKNA,
  formatLogistikaOknoRange,
  type LogistikaOknoValues,
} from "@/lib/logistika-okna";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-amber-500/60";

type EditProps = {
  mode: "edit";
  values: LogistikaOknoValues;
  readOnly?: boolean;
  onChange: (key: keyof LogistikaOknoValues, value: string) => void;
};

type ReadOnlyProps = {
  mode: "read";
  values: LogistikaOknoValues;
};

type Props = EditProps | ReadOnlyProps;

export function emptyLogistikaOknaValues(): LogistikaOknoValues {
  return { ...EMPTY_LOGISTIKA_OKNA };
}

export default function PoptavkaLogistikaOknaPanel(props: Props) {
  const values = props.values;

  if (props.mode === "read") {
    const stavba = formatLogistikaOknoRange(values.stavba_okno_od, values.stavba_okno_do);
    const bourani = formatLogistikaOknoRange(values.bourani_okno_od, values.bourani_okno_do);

    if (!stavba && !bourani && !values.logistika_poznamka_klienta.trim()) {
      return null;
    }

    return (
      <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Kdy je možné stavět a bourat</h3>
          <p className="mt-1 text-xs text-slate-400">
            Časové okno zadané klientem — přesný termín realizace potvrdíme zvlášť.
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {stavba ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Okno pro stavbu</dt>
              <dd className="text-slate-100">{stavba}</dd>
            </div>
          ) : null}
          {bourani ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Okno pro bourání</dt>
              <dd className="text-slate-100">{bourani}</dd>
            </div>
          ) : null}
          {values.logistika_poznamka_klienta.trim() ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Poznámka k přístupu / omezení</dt>
              <dd className="whitespace-pre-wrap text-slate-100">
                {values.logistika_poznamka_klienta}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    );
  }

  const { readOnly = false, onChange } = props;

  return (
    <section className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-100">Kdy je možné stavět a bourat</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Nezadáváte přesný čas našeho příjezdu. Zadejte prosím časové okno, kdy je možné techniku
          stavět nebo bourat. Přesný čas realizace potvrdíme v objednávce nebo interně naplánujeme
          podle možností.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-300">Stavba možná od</span>
          <input
            type="datetime-local"
            name="stavba_okno_od"
            value={values.stavba_okno_od}
            onChange={(event) => onChange("stavba_okno_od", event.target.value)}
            disabled={readOnly}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Stavba možná do</span>
          <input
            type="datetime-local"
            name="stavba_okno_do"
            value={values.stavba_okno_do}
            onChange={(event) => onChange("stavba_okno_do", event.target.value)}
            disabled={readOnly}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Bourání možné od</span>
          <input
            type="datetime-local"
            name="bourani_okno_od"
            value={values.bourani_okno_od}
            onChange={(event) => onChange("bourani_okno_od", event.target.value)}
            disabled={readOnly}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Bourání možné do</span>
          <input
            type="datetime-local"
            name="bourani_okno_do"
            value={values.bourani_okno_do}
            onChange={(event) => onChange("bourani_okno_do", event.target.value)}
            disabled={readOnly}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-slate-300">Poznámka k přístupu / omezení</span>
          <textarea
            name="logistika_poznamka_klienta"
            value={values.logistika_poznamka_klienta}
            onChange={(event) => onChange("logistika_poznamka_klienta", event.target.value)}
            disabled={readOnly}
            rows={3}
            className={inputClassName}
          />
        </label>
      </div>
    </section>
  );
}
