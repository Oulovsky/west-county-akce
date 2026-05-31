import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

type ZakazkaScheduleCardProps = {
  data: {
    odjezd_ze_skladu?: string | null;
    sraz_na_miste?: string | null;
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

export function ZakazkaScheduleCard({ data, action, readOnly = false }: ZakazkaScheduleCardProps) {
  if (readOnly) {
    return (
      <Card className="mt-6">
        <div className="space-y-6">
          <div>
            <div className="text-lg font-semibold text-white">Termíny zakázky</div>
            <div className="mt-1 text-sm text-slate-400">Pouze pro čtení.</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Odjezd ze skladu">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.odjezd_ze_skladu)}</div>
            </Field>
            <Field label="Sraz na místě">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.sraz_na_miste)}</div>
            </Field>
            <Field label="Stavba od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.stavba_od)}</div>
            </Field>
            <Field label="Stavba do">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.stavba_do)}</div>
            </Field>
            <Field label="Akce od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.akce_od)}</div>
            </Field>
            <Field label="Akce do">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.akce_do)}</div>
            </Field>
            <Field label="Bourání od">
              <div className="mt-2 text-slate-300">{formatScheduleValue(data.bourani_od)}</div>
            </Field>
            <Field label="Bourání do">
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
            Úprava logistiky a časových bloků. Hlavní termín akce se opatrně propsává i do kalendáře přiřazených lidí.
          </div>
        </div>

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
              <div className="text-base font-semibold text-white">Stavba před akcí</div>
              <div className="mt-1 text-sm text-slate-400">
                Volitelné. Vyplň jen pokud stavba probíhá mimo hlavní blok akce.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Stavba od – datum">
                <input
                  type="date"
                  name="stavba_od_datum"
                  defaultValue={toDateInput(data.stavba_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Stavba od – čas">
                <input
                  type="time"
                  name="stavba_od_cas"
                  defaultValue={toTimeInput(data.stavba_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Stavba do – datum">
                <input
                  type="date"
                  name="stavba_do_datum"
                  defaultValue={toDateInput(data.stavba_do)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Stavba do – čas">
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
                Hlavní termín zakázky. Tento blok se propisuje i do původních datum/čas polí a do kalendáře lidí, pokud nemají ručně upravený vlastní čas.
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
              <div className="text-base font-semibold text-white">Bourání</div>
              <div className="mt-1 text-sm text-slate-400">
                Volitelné. Vyplň jen pokud bourání probíhá jako samostatný blok.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Bourání od – datum">
                <input
                  type="date"
                  name="bourani_od_datum"
                  defaultValue={toDateInput(data.bourani_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Bourání od – čas">
                <input
                  type="time"
                  name="bourani_od_cas"
                  defaultValue={toTimeInput(data.bourani_od)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Bourání do – datum">
                <input
                  type="date"
                  name="bourani_do_datum"
                  defaultValue={toDateInput(data.bourani_do)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Bourání do – čas">
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