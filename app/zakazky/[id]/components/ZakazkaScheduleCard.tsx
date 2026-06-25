import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import {
  formatLogistikaOknoRange,
  hasZakazkaRealizaceBourani,
  hasZakazkaRealizaceStavba,
} from "@/lib/logistika-okna";

type ZakazkaScheduleCardProps = {
  data: {
    odjezd_ze_skladu?: string | null;
    sraz_na_miste?: string | null;
    stavba_okno_od?: string | null;
    stavba_okno_do?: string | null;
    bourani_okno_od?: string | null;
    bourani_okno_do?: string | null;
    stavba_od?: string | null;
    stavba_do?: string | null;
    akce_od?: string | null;
    akce_do?: string | null;
    bourani_od?: string | null;
    bourani_do?: string | null;
  };
  action: (formData: FormData) => Promise<void>;
  readOnly?: boolean;
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  return value.slice(11, 16);
}

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500";

function formatScheduleValue(value?: string | null) {
  if (!value) return "—";
  const date = toDateInput(value);
  const time = toTimeInput(value);
  if (!date) return value;
  if (!time) return date;
  return `${date} ${time}`;
}

function ClientOknoReadOnly({
  label,
  od,
  doValue,
}: {
  label: string;
  od?: string | null;
  doValue?: string | null;
}) {
  const text = formatLogistikaOknoRange(od, doValue);
  if (!text) return null;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">{label}</div>
      <div className="mt-1 text-slate-200">{text}</div>
      <div className="mt-1 text-xs text-slate-500">Klientské okno — nezobrazuje se zaměstnancům jako nástup.</div>
    </div>
  );
}

function RealizaceWarning({
  oknoOd,
  oknoDo,
  hasRealizace,
  label,
}: {
  oknoOd?: string | null;
  oknoDo?: string | null;
  hasRealizace: boolean;
  label: string;
}) {
  if (!oknoOd && !oknoDo) return null;
  if (hasRealizace) return null;
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      {label} — není zvolen konkrétní čas realizace. Zaměstnanci uvidí upozornění, dokud čas
      nenastavíte.
    </p>
  );
}

export function ZakazkaScheduleCard({ data, action, readOnly = false }: ZakazkaScheduleCardProps) {
  const hasStavbaOkno = Boolean(data.stavba_okno_od || data.stavba_okno_do);
  const hasBouraniOkno = Boolean(data.bourani_okno_od || data.bourani_okno_do);

  if (readOnly) {
    return (
      <Card className="mt-6">
        <div className="space-y-6">
          <div>
            <div className="text-lg font-semibold text-white">Termíny zakázky</div>
            <div className="mt-1 text-sm text-slate-400">Pouze pro čtení.</div>
          </div>

          {(hasStavbaOkno || hasBouraniOkno) && (
            <div className="space-y-3">
              <ClientOknoReadOnly
                label="Klientské okno stavby"
                od={data.stavba_okno_od}
                doValue={data.stavba_okno_do}
              />
              <ClientOknoReadOnly
                label="Klientské okno bourání"
                od={data.bourani_okno_od}
                doValue={data.bourani_okno_do}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Odjezd ze skladu">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.odjezd_ze_skladu)}</div>
            </Field>
            <Field label="Sraz na místě">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.sraz_na_miste)}</div>
            </Field>
            <Field label="Realizace stavby od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.stavba_od)}</div>
            </Field>
            <Field label="Realizace stavby do">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.stavba_do)}</div>
            </Field>
            <Field label="Akce od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.akce_od)}</div>
            </Field>
            <Field label="Akce do">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.akce_do)}</div>
            </Field>
            <Field label="Realizace bourání od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.bourani_od)}</div>
            </Field>
            <Field label="Realizace bourání do">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.bourani_do)}</div>
            </Field>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <div className="space-y-6">
        <div>
          <div className="text-lg font-semibold text-white">Termíny zakázky</div>
          <div className="mt-1 text-sm text-slate-400">
            Klientské okno je jen reference. Pro zaměstnance nastavte konkrétní realizační časy
            stavby a bourání.
          </div>
        </div>

        {(hasStavbaOkno || hasBouraniOkno) && (
          <div className="space-y-3">
            <ClientOknoReadOnly
              label="Klientské okno stavby"
              od={data.stavba_okno_od}
              doValue={data.stavba_okno_do}
            />
            <ClientOknoReadOnly
              label="Klientské okno bourání"
              od={data.bourani_okno_od}
              doValue={data.bourani_okno_do}
            />
          </div>
        )}

        <form action={action} className="space-y-6">
          <Card className="space-y-4 border-slate-700 bg-slate-950/40">
            <div>
              <div className="text-base font-semibold text-white">Logistika</div>
              <div className="mt-1 text-sm text-slate-400">
                Volitelné referenční časy pro odjezd a sraz.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Odjezd ze skladu – datum">
                <input
                  type="date"
                  name="odjezd_ze_skladu_datum"
                  defaultValue={toDateInput(data.odjezd_ze_skladu)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Odjezd ze skladu – čas">
                <input
                  type="time"
                  name="odjezd_ze_skladu_cas"
                  defaultValue={toTimeInput(data.odjezd_ze_skladu)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Sraz na místě – datum">
                <input
                  type="date"
                  name="sraz_na_miste_datum"
                  defaultValue={toDateInput(data.sraz_na_miste)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Sraz na místě – čas">
                <input
                  type="time"
                  name="sraz_na_miste_cas"
                  defaultValue={toTimeInput(data.sraz_na_miste)}
                  className={inputClassName}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-slate-950/40">
            <div>
              <div className="text-base font-semibold text-white">Realizace stavby (pro zaměstnance)</div>
              <div className="mt-1 text-sm text-slate-400">
                Konkrétní čas nástupu / práce na stavbě. Kalendář a mobil používají tyto časy.
              </div>
            </div>

            <RealizaceWarning
              oknoOd={data.stavba_okno_od}
              oknoDo={data.stavba_okno_do}
              hasRealizace={hasZakazkaRealizaceStavba(data)}
              label="Stavba"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Realizace stavby od – datum">
                <input
                  type="date"
                  name="stavba_od_datum"
                  defaultValue={toDateInput(data.stavba_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace stavby od – čas">
                <input
                  type="time"
                  name="stavba_od_cas"
                  defaultValue={toTimeInput(data.stavba_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace stavby do – datum">
                <input
                  type="date"
                  name="stavba_do_datum"
                  defaultValue={toDateInput(data.stavba_do)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace stavby do – čas">
                <input
                  type="time"
                  name="stavba_do_cas"
                  defaultValue={toTimeInput(data.stavba_do)}
                  className={inputClassName}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-slate-950/40">
            <div>
              <div className="text-base font-semibold text-white">V den akce</div>
              <div className="mt-1 text-sm text-slate-400">
                Hlavní termín zakázky. Tento blok se propisuje i do původních datum/čas polí a do
                kalendáře lidí, pokud nemají ručně upravený vlastní čas.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Akce od – datum">
                <input
                  type="date"
                  name="akce_od_datum"
                  defaultValue={toDateInput(data.akce_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Akce od – čas">
                <input
                  type="time"
                  name="akce_od_cas"
                  defaultValue={toTimeInput(data.akce_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Akce do – datum">
                <input
                  type="date"
                  name="akce_do_datum"
                  defaultValue={toDateInput(data.akce_do)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Akce do – čas">
                <input
                  type="time"
                  name="akce_do_cas"
                  defaultValue={toTimeInput(data.akce_do)}
                  className={inputClassName}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-slate-950/40">
            <div>
              <div className="text-base font-semibold text-white">Realizace bourání (pro zaměstnance)</div>
              <div className="mt-1 text-sm text-slate-400">
                Konkrétní čas bourání / odjezdu lidí z místa.
              </div>
            </div>

            <RealizaceWarning
              oknoOd={data.bourani_okno_od}
              oknoDo={data.bourani_okno_do}
              hasRealizace={hasZakazkaRealizaceBourani(data)}
              label="Bourání"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Realizace bourání od – datum">
                <input
                  type="date"
                  name="bourani_od_datum"
                  defaultValue={toDateInput(data.bourani_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace bourání od – čas">
                <input
                  type="time"
                  name="bourani_od_cas"
                  defaultValue={toTimeInput(data.bourani_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace bourání do – datum">
                <input
                  type="date"
                  name="bourani_do_datum"
                  defaultValue={toDateInput(data.bourani_do)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Realizace bourání do – čas">
                <input
                  type="time"
                  name="bourani_do_cas"
                  defaultValue={toTimeInput(data.bourani_do)}
                  className={inputClassName}
                />
              </Field>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Uložit termíny
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
