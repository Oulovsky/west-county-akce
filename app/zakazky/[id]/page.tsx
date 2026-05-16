import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PeoplePool from "./PeoplePool";
import { combineDateAndTime, recomputeZakazkaTechnikaFromTemplates } from "./helpers";
import { ZakazkaBasicLookCard } from "./components/ZakazkaBasicLookCard";
import { ZakazkaScheduleCard } from "./components/ZakazkaScheduleCard";
import { ZakazkaTemplatesCard } from "./components/ZakazkaTemplatesCard";
import { ZakazkaHeaderCard } from "./components/ZakazkaHeaderCard";

import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import { Card } from "@/components/ui/card";

type PageProps = {
  params: Promise<{ id: string }>;
};

type TemplateRow = {
  id: string;
  name: string;
};

type ZakazkaTemplateRow = {
  id: string;
  template_id: string;
  quantity: number | string;
  templates:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type TechnikaSummaryRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number | string;
};

type TechnikaSummaryRawRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string;
  skladove_polozky:
    | {
        nazev: string | null;
      }
    | {
        nazev: string | null;
      }[]
    | null;
};

type LoadingPlanRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
};

type LoadingKusAssignmentRow = {
  id: string;
  kus_id: string;
  stav: string;
  is_rezerva: boolean | null;
};

type LoadingKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
};

type LoadingPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string | null;
  pozice: number | string | null;
  sklad_blok_id: string | null;
};

type LoadingBlokRow = {
  sklad_blok_id: string;
  nazev: string | null;
  poradi: number | null;
};

type LoadingStatusItem = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  plan: number;
  nalozeno: number;
  rezerva: number;
  vraceno: number;
  poskozeno: number;
  zbyvaNalozit: number;
  zbyvaVratit: number;
};

type LoadingStatusGroup = {
  okruhId: string;
  okruhNazev: string;
  poradi: number;
  items: LoadingStatusItem[];
  totals: Omit<LoadingStatusItem, "skladova_polozka_id" | "nazev" | "pozice">;
};

function getSkladovaPolozkaNazev(
  value: TechnikaSummaryRawRow["skladove_polozky"]
) {
  if (Array.isArray(value)) {
    return value[0]?.nazev ?? "-";
  }

  return value?.nazev ?? "-";
}

function toCount(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

function formatPosition(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function buildLoadingStatusGroups(
  planRows: LoadingPlanRow[],
  assignments: LoadingKusAssignmentRow[],
  kusRows: LoadingKusRow[],
  polozky: LoadingPolozkaRow[],
  bloky: LoadingBlokRow[]
): LoadingStatusGroup[] {
  const planByPolozka = new Map<string, number>();
  for (const row of planRows) {
    const polozkaId = row.skladova_polozka_id;
    if (!polozkaId) continue;
    planByPolozka.set(polozkaId, (planByPolozka.get(polozkaId) ?? 0) + toCount(row.mnozstvi));
  }

  const kusToPolozka = new Map(
    kusRows.map((row) => [row.kus_id, row.skladova_polozka_id])
  );
  const countsByPolozka = new Map<
    string,
    Pick<LoadingStatusItem, "nalozeno" | "rezerva" | "vraceno" | "poskozeno">
  >();

  for (const assignment of assignments) {
    const polozkaId = kusToPolozka.get(assignment.kus_id);
    if (!polozkaId) continue;

    const counts = countsByPolozka.get(polozkaId) ?? {
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
    };

    if (assignment.stav === "nalozeno") {
      counts.nalozeno += 1;
      if (assignment.is_rezerva) counts.rezerva += 1;
    } else if (assignment.stav === "vraceno") {
      counts.vraceno += 1;
    } else if (assignment.stav === "poskozeno") {
      counts.poskozeno += 1;
    }

    countsByPolozka.set(polozkaId, counts);
  }

  const polozkaIds = new Set([...planByPolozka.keys(), ...countsByPolozka.keys()]);
  const polozkaMap = new Map(polozky.map((row) => [row.skladova_polozka_id, row]));
  const blokMap = new Map(bloky.map((row) => [row.sklad_blok_id, row]));
  const groupMap = new Map<string, LoadingStatusGroup>();

  for (const polozkaId of polozkaIds) {
    const polozka = polozkaMap.get(polozkaId);
    const blok = polozka?.sklad_blok_id ? blokMap.get(polozka.sklad_blok_id) : null;
    const okruhId = blok?.sklad_blok_id ?? "__bez_okruhu";
    const okruhNazev = blok?.nazev?.trim() || "Bez okruhu";
    const counts = countsByPolozka.get(polozkaId) ?? {
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
    };
    const plan = planByPolozka.get(polozkaId) ?? 0;
    const bezRezervy = Math.max(counts.nalozeno - counts.rezerva, 0);
    const item: LoadingStatusItem = {
      skladova_polozka_id: polozkaId,
      nazev: polozka?.nazev?.trim() || polozkaId,
      pozice: polozka?.pozice ?? null,
      plan,
      nalozeno: counts.nalozeno,
      rezerva: counts.rezerva,
      vraceno: counts.vraceno,
      poskozeno: counts.poskozeno,
      zbyvaNalozit: Math.max(plan - bezRezervy, 0),
      zbyvaVratit: Math.max(counts.nalozeno + counts.poskozeno, 0),
    };

    const group = groupMap.get(okruhId) ?? {
      okruhId,
      okruhNazev,
      poradi: blok?.poradi ?? 999999,
      items: [],
      totals: {
        plan: 0,
        nalozeno: 0,
        rezerva: 0,
        vraceno: 0,
        poskozeno: 0,
        zbyvaNalozit: 0,
        zbyvaVratit: 0,
      },
    };

    group.items.push(item);
    group.totals.plan += item.plan;
    group.totals.nalozeno += item.nalozeno;
    group.totals.rezerva += item.rezerva;
    group.totals.vraceno += item.vraceno;
    group.totals.poskozeno += item.poskozeno;
    group.totals.zbyvaNalozit += item.zbyvaNalozit;
    group.totals.zbyvaVratit += item.zbyvaVratit;
    groupMap.set(okruhId, group);
  }

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const aPos = Number(a.pozice);
        const bPos = Number(b.pozice);
        if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos) {
          return aPos - bPos;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.poradi !== b.poradi) return a.poradi - b.poradi;
      return a.okruhNazev.localeCompare(b.okruhNazev, "cs");
    });
}

function LoadingMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-white">{formatCount(value)}</div>
    </div>
  );
}

function LoadingStatusCard({ groups }: { groups: LoadingStatusGroup[] }) {
  const totals = groups.reduce(
    (acc, group) => {
      acc.plan += group.totals.plan;
      acc.nalozeno += group.totals.nalozeno;
      acc.rezerva += group.totals.rezerva;
      acc.vraceno += group.totals.vraceno;
      acc.poskozeno += group.totals.poskozeno;
      acc.zbyvaNalozit += group.totals.zbyvaNalozit;
      acc.zbyvaVratit += group.totals.zbyvaVratit;
      return acc;
    },
    {
      plan: 0,
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
      zbyvaNalozit: 0,
      zbyvaVratit: 0,
    }
  );

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Stav nakládky</h2>
          <p className="mt-1 text-sm text-slate-400">
            Plán z techniky zakázky a fyzická realita ze scanů kusů.
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
          Zakázka zatím nemá plánovanou ani naskenovanou techniku.
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <LoadingMetric label="Plán" value={totals.plan} />
            <LoadingMetric label="Naloženo" value={totals.nalozeno} />
            <LoadingMetric label="Rezerva" value={totals.rezerva} />
            <LoadingMetric label="Vráceno" value={totals.vraceno} />
            <LoadingMetric label="Poškozeno" value={totals.poskozeno} />
            <LoadingMetric label="Zbývá naložit" value={totals.zbyvaNalozit} />
            <LoadingMetric label="Zbývá vrátit" value={totals.zbyvaVratit} />
          </div>

          <div className="mt-6 space-y-4">
            {groups.map((group) => (
              <section
                key={group.okruhId}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Okruh
                    </div>
                    <h3 className="mt-1 text-xl font-black text-white">{group.okruhNazev}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
                    <LoadingMetric label="Plán" value={group.totals.plan} />
                    <LoadingMetric label="Naloženo" value={group.totals.nalozeno} />
                    <LoadingMetric label="Chybí" value={group.totals.zbyvaNalozit} />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.items.map((item) => (
                    <div
                      key={item.skladova_polozka_id}
                      className="rounded-2xl border border-slate-800 bg-[#081225] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-lg font-black leading-tight text-white">
                            {item.nazev}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-400">
                            Pozice: {formatPosition(item.pozice)}
                          </div>
                        </div>
                        <div
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-black",
                            item.zbyvaNalozit > 0
                              ? "border-amber-700 bg-amber-950 text-amber-100"
                              : item.zbyvaVratit > 0
                                ? "border-blue-700 bg-blue-950 text-blue-100"
                                : "border-emerald-700 bg-emerald-950 text-emerald-100",
                          ].join(" ")}
                        >
                          {item.zbyvaNalozit > 0
                            ? "Chybí"
                            : item.zbyvaVratit > 0
                              ? "V oběhu"
                              : "Uzavřeno"}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        <LoadingMetric label="Plán" value={item.plan} />
                        <LoadingMetric label="Naloženo" value={item.nalozeno} />
                        <LoadingMetric label="Rezerva" value={item.rezerva} />
                        <LoadingMetric label="Vráceno" value={item.vraceno} />
                        <LoadingMetric label="Poškozeno" value={item.poskozeno} />
                        <LoadingMetric label="Zbývá naložit" value={item.zbyvaNalozit} />
                        <LoadingMetric label="Zbývá vrátit" value={item.zbyvaVratit} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

type RealizaceRow = {
  realizace_id: string;
  zakazka_id: string;
  nazev: string | null;
  poradi: number | string | null;
  stage_typ: string | null;
  stage_sirka: number | string | null;
  stage_hloubka: number | string | null;
  sound_typ: string | null;
  lights_typ: string | null;
  led_typ: string | null;
  led_sirka: number | string | null;
  led_vyska: number | string | null;
  led_rohy: boolean | null;
  kamery: number | string | null;
  dron: boolean | null;
};

export default async function ZakazkaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  async function addTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const templateId = String(formData.get("templateId") ?? "").trim();
    const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);

    if (!templateId) {
      throw new Error("Nebyla vybrĂˇna sestava.");
    }

    const { error } = await supabase.from("zakazka_templates").insert({
      zakazka_id: id,
      template_id: templateId,
      quantity,
    });

    if (error) {
      throw new Error(error.message);
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function removeTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const rowId = String(formData.get("rowId") ?? "").trim();

    if (!rowId) {
      throw new Error("ChybĂ­ ID vazby sestavy.");
    }

    const { error } = await supabase
      .from("zakazka_templates")
      .delete()
      .eq("id", rowId)
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(error.message);
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function changeTemplateQuantity(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const rowId = String(formData.get("rowId") ?? "").trim();
    const direction = String(formData.get("direction") ?? "").trim();

    if (!rowId) {
      throw new Error("ChybĂ­ ID vazby sestavy.");
    }

    if (direction !== "plus" && direction !== "minus") {
      throw new Error("NeplatnĂ˝ smÄ›r zmÄ›ny mnoĹľstvĂ­.");
    }

    const { data: row, error: rowError } = await supabase
      .from("zakazka_templates")
      .select("quantity")
      .eq("id", rowId)
      .single();

    if (rowError) {
      throw new Error(rowError.message);
    }

    const qty = Number(row?.quantity ?? 1);

    if (direction === "minus" && qty <= 1) {
      const { error: deleteError } = await supabase
        .from("zakazka_templates")
        .delete()
        .eq("id", rowId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    } else {
      const { error: updateError } = await supabase
        .from("zakazka_templates")
        .update({ quantity: direction === "plus" ? qty + 1 : qty - 1 })
        .eq("id", rowId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function updateZakazkaSchedule(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const akceOd = combineDateAndTime(
      String(formData.get("akce_od_datum") ?? ""),
      String(formData.get("akce_od_cas") ?? "")
    );

    const akceDo = combineDateAndTime(
      String(formData.get("akce_do_datum") ?? ""),
      String(formData.get("akce_do_cas") ?? "")
    );

    if (!akceOd || !akceDo) {
      throw new Error("VyplĹ zaÄŤĂˇtek a konec akce.");
    }

    const { error } = await supabase
      .from("zakazky")
      .update({
        akce_od: akceOd,
        akce_do: akceDo,
      })
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${id}`);
  }

  async function cancelZakazka() {
    "use server";
    const supabase = await createClient();

    const { error } = await supabase.rpc("zrusit_zakazku", { p_zakazka_id: id });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/zakazky");
  }

  const { data, error } = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", id)
    .single();

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  if (!data) {
    return <div>ZakĂˇzka nenalezena</div>;
  }

  const { data: realizace, error: realizaceError } = await supabase
    .from("zakazka_realizace")
    .select("*")
    .eq("zakazka_id", id);

  if (realizaceError) {
    return <div>Chyba: {realizaceError.message}</div>;
  }

  const { data: templates, error: templatesError } = await supabase
    .from("templates")
    .select("id, name");

  if (templatesError) {
    return <div>Chyba: {templatesError.message}</div>;
  }

  const { data: zakazkaTemplates, error: zakazkaTemplatesError } = await supabase
    .from("zakazka_templates")
    .select("id, template_id, quantity, templates(id, name)")
    .eq("zakazka_id", id);

  if (zakazkaTemplatesError) {
    return <div>Chyba: {zakazkaTemplatesError.message}</div>;
  }

  const { data: technikaSummaryRaw, error: technikaSummaryError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(nazev)")
    .eq("zakazka_id", id);

  if (technikaSummaryError) {
    return <div>Chyba: {technikaSummaryError.message}</div>;
  }

  const technikaSummary = ((technikaSummaryRaw ?? []) as TechnikaSummaryRawRow[]).map((row) => ({
    skladova_polozka_id: row.skladova_polozka_id,
    mnozstvi: row.mnozstvi,
    nazev: getSkladovaPolozkaNazev(row.skladove_polozky),
  })) as TechnikaSummaryRow[];

  const planRows = (technikaSummaryRaw ?? []) as LoadingPlanRow[];

  const { data: loadingAssignmentsRaw, error: loadingAssignmentsError } = await supabase
    .from("zakazka_kusy")
    .select("id, kus_id, stav, is_rezerva")
    .eq("zakazka_id", id);

  if (loadingAssignmentsError) {
    return <div>Chyba stavu nakládky: {loadingAssignmentsError.message}</div>;
  }

  const loadingAssignments = (loadingAssignmentsRaw ?? []) as LoadingKusAssignmentRow[];
  const assignmentKusIds = loadingAssignments
    .map((row) => row.kus_id)
    .filter(Boolean);

  let loadingKusy: LoadingKusRow[] = [];
  if (assignmentKusIds.length > 0) {
    const { data: kusyRaw, error: kusyError } = await supabase
      .from("sklad_polozky_kusy")
      .select("kus_id, skladova_polozka_id")
      .in("kus_id", assignmentKusIds);

    if (kusyError) {
      return <div>Chyba kusů nakládky: {kusyError.message}</div>;
    }

    loadingKusy = (kusyRaw ?? []) as LoadingKusRow[];
  }

  const loadingPolozkaIds = [
    ...new Set([
      ...planRows.map((row) => row.skladova_polozka_id).filter(Boolean),
      ...loadingKusy.map((row) => row.skladova_polozka_id).filter(Boolean),
    ]),
  ];

  let loadingPolozky: LoadingPolozkaRow[] = [];
  if (loadingPolozkaIds.length > 0) {
    const { data: polozkyRaw, error: polozkyError } = await supabase
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .in("skladova_polozka_id", loadingPolozkaIds);

    if (polozkyError) {
      return <div>Chyba položek nakládky: {polozkyError.message}</div>;
    }

    loadingPolozky = (polozkyRaw ?? []) as LoadingPolozkaRow[];
  }

  const loadingBlokIds = [
    ...new Set(loadingPolozky.map((row) => row.sklad_blok_id).filter(Boolean)),
  ] as string[];

  let loadingBloky: LoadingBlokRow[] = [];
  if (loadingBlokIds.length > 0) {
    const { data: blokyRaw, error: blokyError } = await supabase
      .from("sklad_bloky")
      .select("sklad_blok_id, nazev, poradi")
      .in("sklad_blok_id", loadingBlokIds);

    if (blokyError) {
      return <div>Chyba okruhů nakládky: {blokyError.message}</div>;
    }

    loadingBloky = (blokyRaw ?? []) as LoadingBlokRow[];
  }

  const loadingStatusGroups = buildLoadingStatusGroups(
    planRows,
    loadingAssignments,
    loadingKusy,
    loadingPolozky,
    loadingBloky
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <ZakazkaHeaderCard zakazkaId={id} data={data} cancelAction={cancelZakazka} />

      <ZakazkaScheduleCard data={data} action={updateZakazkaSchedule} />

      <ZakazkaBasicLookCard realizace={(realizace ?? []) as RealizaceRow[]} data={data} />

      <ZakazkaTemplatesCard
        templates={(templates ?? []) as TemplateRow[]}
        zakazkaTemplates={(zakazkaTemplates ?? []) as ZakazkaTemplateRow[]}
        technikaSummary={technikaSummary}
        addTemplateAction={addTemplate}
        changeTemplateQuantityAction={changeTemplateQuantity}
        removeTemplateAction={removeTemplate}
      />

      <LoadingStatusCard groups={loadingStatusGroups} />

      <div className="mt-6">
        <ZakazkaSubnav zakazkaId={id} active="detail" showBackLink />
      </div>

      <div className="mt-10">
        <PeoplePool zakazkaId={id} />
      </div>
    </div>
  );
}



