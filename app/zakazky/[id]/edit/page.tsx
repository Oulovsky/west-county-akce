import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ id: string }>;
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function toTimeInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function toDateTimeParts(value?: string | null) {
  if (!value) {
    return {
      date: "",
      time: "12:00",
    };
  }

  const iso = String(value);
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16) || "12:00",
  };
}

export default async function EditZakazkyPage({ params }: PageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", id)
    .single();

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  if (!data) {
    return <div>Zakázka nenalezena</div>;
  }

  const odjezdZeSkladu = toDateTimeParts(data.odjezd_ze_skladu);
  const srazNaMiste = toDateTimeParts(data.sraz_na_miste);

  const stavbaOd = toDateTimeParts(data.stavba_od);
  const stavbaDo = toDateTimeParts(data.stavba_do);

  const akceOd = data.akce_od
    ? toDateTimeParts(data.akce_od)
    : {
        date: toDateInputValue(data.datum_od),
        time: toTimeInputValue(data.cas_od) || "12:00",
      };

  const akceDo = data.akce_do
    ? toDateTimeParts(data.akce_do)
    : {
        date: toDateInputValue(data.datum_do),
        time: toTimeInputValue(data.cas_do) || "12:00",
      };

  const bouraniOd = toDateTimeParts(data.bourani_od);
  const bouraniDo = toDateTimeParts(data.bourani_do);

  async function updateZakazka(formData: FormData) {
    "use server";

    const nazev = String(formData.get("nazev") ?? "");
    const misto = String(formData.get("misto") ?? "");
    const typObsluhy = String(formData.get("typ_obsluhy") ?? "s_obsluhou");
    const poznamka = String(formData.get("poznamka") ?? "");

    const odjezdZeSkladuDatum = String(formData.get("odjezd_ze_skladu_datum") ?? "");
    const odjezdZeSkladuCas = String(formData.get("odjezd_ze_skladu_cas") ?? "");

    const srazNaMisteDatum = String(formData.get("sraz_na_miste_datum") ?? "");
    const srazNaMisteCas = String(formData.get("sraz_na_miste_cas") ?? "");

    const stavbaOdDatum = String(formData.get("stavba_od_datum") ?? "");
    const stavbaOdCas = String(formData.get("stavba_od_cas") ?? "");
    const stavbaDoDatum = String(formData.get("stavba_do_datum") ?? "");
    const stavbaDoCas = String(formData.get("stavba_do_cas") ?? "");

    const akceOdDatum = String(formData.get("akce_od_datum") ?? "");
    const akceOdCas = String(formData.get("akce_od_cas") ?? "");
    const akceDoDatum = String(formData.get("akce_do_datum") ?? "");
    const akceDoCas = String(formData.get("akce_do_cas") ?? "");

    const bouraniOdDatum = String(formData.get("bourani_od_datum") ?? "");
    const bouraniOdCas = String(formData.get("bourani_od_cas") ?? "");
    const bouraniDoDatum = String(formData.get("bourani_do_datum") ?? "");
    const bouraniDoCas = String(formData.get("bourani_do_cas") ?? "");

    function combineDateAndTime(dateValue: string, timeValue: string) {
      if (!dateValue || !timeValue) return null;
      return `${dateValue}T${timeValue}:00`;
    }

    function deriveLegacyDate(value: string | null) {
      return value ? value.slice(0, 10) : null;
    }

    function deriveLegacyTime(value: string | null) {
      return value ? value.slice(11, 16) : null;
    }

    const odjezdZeSkladu = combineDateAndTime(odjezdZeSkladuDatum, odjezdZeSkladuCas);
    const srazNaMiste = combineDateAndTime(srazNaMisteDatum, srazNaMisteCas);

    const stavbaOd = combineDateAndTime(stavbaOdDatum, stavbaOdCas);
    const stavbaDo = combineDateAndTime(stavbaDoDatum, stavbaDoCas);

    const akceOd = combineDateAndTime(akceOdDatum, akceOdCas);
    const akceDo = combineDateAndTime(akceDoDatum, akceDoCas);

    const bouraniOd = combineDateAndTime(bouraniOdDatum, bouraniOdCas);
    const bouraniDo = combineDateAndTime(bouraniDoDatum, bouraniDoCas);

    if (!nazev || !misto || !akceOd || !akceDo) {
      throw new Error("Vyplň název, místo, akce od a akce do.");
    }

    if (new Date(akceOd).getTime() >= new Date(akceDo).getTime()) {
      throw new Error("Konec akce musí být později než začátek akce.");
    }

    if (stavbaOd && stavbaDo && new Date(stavbaOd).getTime() >= new Date(stavbaDo).getTime()) {
      throw new Error("Konec stavby musí být později než začátek stavby.");
    }

    if (
      bouraniOd &&
      bouraniDo &&
      new Date(bouraniOd).getTime() >= new Date(bouraniDo).getTime()
    ) {
      throw new Error("Konec bourání musí být později než začátek bourání.");
    }

    const { error } = await supabase
      .from("zakazky")
      .update({
        nazev,
        misto,
        typ_obsluhy: typObsluhy,
        odjezd_ze_skladu: odjezdZeSkladu,
        sraz_na_miste: srazNaMiste,
        stavba_od: stavbaOd,
        stavba_do: stavbaDo,
        akce_od: akceOd,
        akce_do: akceDo,
        bourani_od: bouraniOd,
        bourani_do: bouraniDo,
        datum_od: deriveLegacyDate(akceOd),
        datum_do: deriveLegacyDate(akceDo),
        cas_od: deriveLegacyTime(akceOd),
        cas_do: deriveLegacyTime(akceDo),
        poznamka,
      })
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(`Uložení zakázky selhalo: ${error.message}`);
    }

    revalidatePath(`/zakazky/${id}`);
    revalidatePath(`/zakazky/${id}/edit`);
    revalidatePath("/zakazky");
    revalidatePath("/kalendar");

    redirect(`/zakazky/${id}`);
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Editace zakázky"
        description="Uprav základní informace, logistiku a časové bloky zakázky."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">{data.cislo_zakazky || "Bez čísla"}</Badge>
              <Badge variant="default">ID: {data.zakazka_id}</Badge>
            </div>

            <div className="text-sm text-slate-400">
              Po uložení budeš přesměrován zpět na detail zakázky.
            </div>
          </div>

          <Link href={`/zakazky/${id}`}>
            <Button variant="secondary">Zpět na detail</Button>
          </Link>
        </div>
      </Card>

      <form action={updateZakazka}>
        <Card>
          <div className="grid gap-6">
            <Field label="Název akce">
              <Input
                name="nazev"
                defaultValue={data.nazev ?? ""}
                placeholder="Např. Den bezpečnostních sborů"
              />
            </Field>

            <Field label="Místo">
              <Input
                name="misto"
                defaultValue={data.misto ?? ""}
                placeholder="Např. Bečov"
              />
            </Field>

            <Field label="Typ obsluhy">
              <select
                name="typ_obsluhy"
                defaultValue={data.typ_obsluhy ?? "s_obsluhou"}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="s_obsluhou">S obsluhou</option>
                <option value="bez_obsluhy">Bez obsluhy</option>
              </select>
            </Field>

            <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
              <div>
                <div className="text-lg font-semibold text-white">Logistika</div>
                <div className="mt-1 text-sm text-slate-400">
                  Volitelné referenční časy pro odjezd a sraz.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Odjezd ze skladu – datum">
                  <Input
                    type="date"
                    name="odjezd_ze_skladu_datum"
                    defaultValue={odjezdZeSkladu.date}
                  />
                </Field>

                <Field label="Odjezd ze skladu – čas">
                  <Input
                    type="time"
                    name="odjezd_ze_skladu_cas"
                    defaultValue={odjezdZeSkladu.time}
                  />
                </Field>

                <Field label="Sraz na místě – datum">
                  <Input
                    type="date"
                    name="sraz_na_miste_datum"
                    defaultValue={srazNaMiste.date}
                  />
                </Field>

                <Field label="Sraz na místě – čas">
                  <Input
                    type="time"
                    name="sraz_na_miste_cas"
                    defaultValue={srazNaMiste.time}
                  />
                </Field>
              </div>
            </Card>

            <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
              <div>
                <div className="text-lg font-semibold text-white">Stavba před akcí</div>
                <div className="mt-1 text-sm text-slate-400">
                  Volitelné. Vyplň jen pokud stavba probíhá mimo hlavní blok akce.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Stavba od – datum">
                  <Input
                    type="date"
                    name="stavba_od_datum"
                    defaultValue={stavbaOd.date}
                  />
                </Field>

                <Field label="Stavba od – čas">
                  <Input
                    type="time"
                    name="stavba_od_cas"
                    defaultValue={stavbaOd.time}
                  />
                </Field>

                <Field label="Stavba do – datum">
                  <Input
                    type="date"
                    name="stavba_do_datum"
                    defaultValue={stavbaDo.date}
                  />
                </Field>

                <Field label="Stavba do – čas">
                  <Input
                    type="time"
                    name="stavba_do_cas"
                    defaultValue={stavbaDo.time}
                  />
                </Field>
              </div>
            </Card>

            <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
              <div>
                <div className="text-lg font-semibold text-white">V den akce</div>
                <div className="mt-1 text-sm text-slate-400">
                  Hlavní termín zakázky. Tento blok se propisuje i do původních datum/cas polí.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Akce od – datum">
                  <Input
                    type="date"
                    name="akce_od_datum"
                    defaultValue={akceOd.date}
                  />
                </Field>

                <Field label="Akce od – čas">
                  <Input
                    type="time"
                    name="akce_od_cas"
                    defaultValue={akceOd.time}
                  />
                </Field>

                <Field label="Akce do – datum">
                  <Input
                    type="date"
                    name="akce_do_datum"
                    defaultValue={akceDo.date}
                  />
                </Field>

                <Field label="Akce do – čas">
                  <Input
                    type="time"
                    name="akce_do_cas"
                    defaultValue={akceDo.time}
                  />
                </Field>
              </div>
            </Card>

            <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
              <div>
                <div className="text-lg font-semibold text-white">Bourání</div>
                <div className="mt-1 text-sm text-slate-400">
                  Volitelné. Vyplň jen pokud bourání probíhá jako samostatný blok.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bourání od – datum">
                  <Input
                    type="date"
                    name="bourani_od_datum"
                    defaultValue={bouraniOd.date}
                  />
                </Field>

                <Field label="Bourání od – čas">
                  <Input
                    type="time"
                    name="bourani_od_cas"
                    defaultValue={bouraniOd.time}
                  />
                </Field>

                <Field label="Bourání do – datum">
                  <Input
                    type="date"
                    name="bourani_do_datum"
                    defaultValue={bouraniDo.date}
                  />
                </Field>

                <Field label="Bourání do – čas">
                  <Input
                    type="time"
                    name="bourani_do_cas"
                    defaultValue={bouraniDo.time}
                  />
                </Field>
              </div>
            </Card>

            <Field label="Poznámka" hint="Volitelné">
              <Textarea
                name="poznamka"
                defaultValue={data.poznamka ?? ""}
                rows={6}
                className="resize-y"
                placeholder="Volitelná poznámka k zakázce"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit">Uložit</Button>

              <Link href={`/zakazky/${id}`}>
                <Button variant="secondary" type="button">
                  Zrušit
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}