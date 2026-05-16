import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatQuestionnaireRiskCount,
  getQuestionnaireRiskLabel,
  isPrimaryQuestionnaireRisk,
  normalizeQuestionnaireRiskCodes,
} from "@/lib/questionnaire-risks";
import PeoplePool from "./PeoplePool";
import { combineDateAndTime } from "./helpers";
import { ZakazkaBasicLookCard } from "./components/ZakazkaBasicLookCard";
import { ZakazkaScheduleCard } from "./components/ZakazkaScheduleCard";
import { ZakazkaHeaderCard } from "./components/ZakazkaHeaderCard";
import {
  ZakazkaPlaceConnectionCard,
  type ExistingPlaceOption,
} from "./components/ZakazkaPlaceConnectionCard";
import {
  QuestionnairePhotoGallery,
  type QuestionnairePhotoGalleryItem,
} from "./QuestionnairePhotoGallery";
import {
  markQuestionnaireInternallyVerifiedAction,
  markQuestionnaireNotNeededAction,
  sendClientQuestionnaireAction,
} from "./actions";

import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import { Card } from "@/components/ui/card";
import {
  PlaceTechnicalNotesCard,
  type MistoKonaniRow,
  type PlaceTechnicalNoteAuthorRow,
  type PlaceTechnicalNoteRow,
  type PlaceTechnicalNoteZakazkaRow,
} from "@/components/mista/PlaceTechnicalNotesCard";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ technicke_overeni?: string }>;
};

type TechnikaSummaryRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number | string;
  pozice: number | string | null;
  okruhNazev: string;
  okruhPoradi: number;
  kategorieNazev: string;
  podkategorieNazev: string;
};

type TechnikaSummaryRawRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string;
  skladove_polozky:
    | {
        nazev: string | null;
        pozice: number | string | null;
        sklad_blok_id: string | null;
        kategorie_techniky_id: string | null;
        podkategorie_techniky_id: string | null;
      }
    | {
        nazev: string | null;
        pozice: number | string | null;
        sklad_blok_id: string | null;
        kategorie_techniky_id: string | null;
        podkategorie_techniky_id: string | null;
      }[]
    | null;
};

type SkladBlokPlanRow = {
  sklad_blok_id: string;
  nazev: string | null;
  poradi: number | null;
};

type KategoriePlanRow = {
  kategorie_techniky_id: string;
  nazev: string | null;
};

type PodkategoriePlanRow = {
  podkategorie_techniky_id: string;
  nazev: string | null;
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

type LoadingKusHistoryRow = {
  kus_id: string;
  typ_akce: string | null;
  poznamka: string | null;
  created_at: string | null;
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

type ClientVerificationLinkRow = {
  link_id: string;
  stav: string | null;
  email_to: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
  created_at: string | null;
};

type ClientVerificationDotaznikRow = {
  dotaznik_id: string;
  stav: string | null;
  link_id: string | null;
  pozadovan_vyjezd_technika: boolean | null;
  rizika: unknown;
  kontakt_jmeno: string | null;
  kontakt_telefon: string | null;
  prijezd_poznamka: string | null;
  parkovani_poznamka: string | null;
  elektro_pripojka: string | null;
  elektro_jisteni: string | null;
  elektro_zasuvka: string | null;
  elektro_vzdalenost_m: number | string | null;
  odpovedi_extra: unknown;
  submitted_at: string | null;
  updated_at: string | null;
};

type ClientVerificationPhotoRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  typ: string | null;
  popis: string | null;
  original_filename: string | null;
  created_at: string | null;
};

function getSkladovaPolozkaInfo(
  value: TechnikaSummaryRawRow["skladove_polozky"]
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toCount(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

function getLoadingStatusLabel({
  plan,
  aktivni,
  vraceno,
  poskozeno,
}: {
  plan: number;
  aktivni: number;
  vraceno: number;
  poskozeno: number;
}) {
  if (aktivni === 0 && vraceno > 0 && poskozeno > 0) return "Vráceno s poškozením";
  if (aktivni === 0 && vraceno > 0) return "Vráceno";
  if (aktivni === 0) return "Nenaloženo";
  if (vraceno > 0 && aktivni > 0) return "Částečně vráceno";
  if (aktivni > 0 && aktivni < plan) return "Částečně naloženo";
  if (aktivni >= plan && vraceno === 0) return "Naloženo";
  return "Částečně naloženo";
}

function formatPosition(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function getExtraAnswer(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    ? String(item)
    : null;
}

function formatChoice(value: string | null) {
  if (value === "ano") return "Ano";
  if (value === "ne") return "Ne";
  if (value === "nevim") return "Nevím";
  if (value === "technician_visit") return "Chce výjezd technika";
  if (value === "self") return "Vyplnil údaje sám";
  return value || "—";
}

function formatPhotoType(value: string | null) {
  if (value === "rozvadec") return "Rozvaděč";
  if (value === "prijezd") return "Příjezd";
  if (value === "parkovani") return "Parkování";
  if (value === "prostor") return "Prostor";
  if (value === "jina") return "Jiná";
  return "Jiná";
}

function getClientVerificationStatus({
  link,
  dotaznik,
}: {
  link: ClientVerificationLinkRow | null;
  dotaznik: ClientVerificationDotaznikRow | null;
}) {
  const risks = normalizeQuestionnaireRiskCodes(dotaznik?.rizika);

  if (dotaznik?.stav === "pozadovan_vyjezd_technika" || dotaznik?.pozadovan_vyjezd_technika) {
    return "Požadován výjezd technika";
  }
  if (risks.length > 0) return "Rizikové odpovědi";
  if (dotaznik?.stav === "vyplneno") return "Vyplněno klientem";
  if (dotaznik?.stav === "neni_potreba") return "Není potřeba";
  if (dotaznik?.stav === "overeno_interne") return "Ověřeno interně";
  if (link?.opened_at || link?.last_opened_at || (link?.open_count ?? 0) > 0) return "Klient otevřel";
  if (link?.email_sent_at) return "Email odeslán";
  return "Dotazník nevytvořen";
}

// TODO: Dočasné řešení bez DB změny. Náhrady se teď párují podle názvu
// plánované položky ze sklad_kus_historie.poznamka. Dlouhodobě má
// zakazka_kusy nést explicitní planned_skladova_polozka_id /
// splnuje_skladova_polozka_id, aby se náhrady počítaly spolehlivě bez
// parsování textu.
function extractReplacementPlannedItemName(note: string | null | undefined) {
  const text = note ?? "";
  const marker = "Náhrada za plánovanou položku:";
  const index = text.indexOf(marker);
  if (index < 0) return null;

  const afterMarker = text.slice(index + marker.length).trim();
  const damageMarker = " Naložen poškozený/blokovaný kus:";
  return afterMarker.split(damageMarker)[0]?.trim() || null;
}

function buildReplacementPolozkaByKus(
  historyRows: LoadingKusHistoryRow[],
  planRows: LoadingPlanRow[],
  polozky: LoadingPolozkaRow[]
) {
  const plannedIds = new Set(planRows.map((row) => row.skladova_polozka_id).filter(Boolean));
  const plannedNameToId = new Map<string, string | null>();

  for (const polozka of polozky) {
    if (!plannedIds.has(polozka.skladova_polozka_id)) continue;

    const name = polozka.nazev?.trim();
    if (!name) continue;

    if (plannedNameToId.has(name)) {
      plannedNameToId.set(name, null);
    } else {
      plannedNameToId.set(name, polozka.skladova_polozka_id);
    }
  }

  const replacementByKus = new Map<string, string>();
  for (const row of historyRows) {
    if (replacementByKus.has(row.kus_id)) continue;

    const plannedName = extractReplacementPlannedItemName(row.poznamka);
    if (!plannedName) continue;

    const plannedId = plannedNameToId.get(plannedName);
    if (plannedId) replacementByKus.set(row.kus_id, plannedId);
  }

  return replacementByKus;
}

function buildLoadingStatusGroups(
  planRows: LoadingPlanRow[],
  assignments: LoadingKusAssignmentRow[],
  kusRows: LoadingKusRow[],
  polozky: LoadingPolozkaRow[],
  bloky: LoadingBlokRow[],
  replacementPolozkaByKus: Map<string, string>
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
    const polozkaId = replacementPolozkaByKus.get(assignment.kus_id) ?? kusToPolozka.get(assignment.kus_id);
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
  const loadingStatus = getLoadingStatusLabel({
    plan: totals.plan,
    aktivni: totals.nalozeno,
    vraceno: totals.vraceno,
    poskozeno: totals.poskozeno,
  });

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Stav nakládky</h2>
          <p className="mt-1 text-sm text-slate-400">
            Plán z techniky zakázky a fyzická realita ze scanů kusů.
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-white">
          {loadingStatus}
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

function PlanTechnikyCard({ items }: { items: TechnikaSummaryRow[] }) {
  const groups = new Map<
    string,
    { okruhNazev: string; okruhPoradi: number; items: TechnikaSummaryRow[] }
  >();

  for (const item of items) {
    const key = item.okruhNazev || "Bez okruhu";
    const group = groups.get(key) ?? {
      okruhNazev: key,
      okruhPoradi: item.okruhPoradi,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const aPosition = Number(a.pozice);
        const bPosition = Number(b.pozice);
        if (Number.isFinite(aPosition) && Number.isFinite(bPosition) && aPosition !== bPosition) {
          return aPosition - bPosition;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.okruhPoradi !== b.okruhPoradi) return a.okruhPoradi - b.okruhPoradi;
      return a.okruhNazev.localeCompare(b.okruhNazev, "cs");
    });

  return (
    <Card className="mt-6">
      <h2 className="text-2xl font-black text-white">Plán techniky</h2>
      <p className="mt-1 text-sm text-slate-400">
        Čtecí přehled plánu z technika_na_zakazce. Konkrétní kusy vznikají až při loading scanu.
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
          Zakázka zatím nemá plánovanou techniku.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {sortedGroups.map((group) => (
            <section
              key={group.okruhNazev}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Okruh
              </div>
              <h3 className="mt-1 text-xl font-black text-white">{group.okruhNazev}</h3>

              <div className="mt-4 grid gap-3">
                {group.items.map((item) => (
                  <div
                    key={item.skladova_polozka_id}
                    className="rounded-2xl border border-slate-800 bg-[#081225] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-black text-white">{item.nazev}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Kategorie: {item.kategorieNazev}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Podkategorie: {item.podkategorieNazev}
                          </span>
                          <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-100">
                            Pozice: {formatPosition(item.pozice)}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-blue-800 bg-blue-950 px-4 py-3 text-2xl font-black text-blue-100">
                        {formatCount(toCount(item.mnozstvi))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClientTechnicalVerificationCard({
  zakazkaId,
  mistoId,
  statusLabel,
  link,
  dotaznik,
  photos,
  galleryPhotos,
  message,
  hasSavedPlace,
}: {
  zakazkaId: string;
  mistoId: string | null;
  statusLabel: string;
  link: ClientVerificationLinkRow | null;
  dotaznik: ClientVerificationDotaznikRow | null;
  photos: ClientVerificationPhotoRow[];
  galleryPhotos: QuestionnairePhotoGalleryItem[];
  message: "sent" | "missing_email" | "missing_resend_key" | null;
  hasSavedPlace: boolean;
}) {
  const risks = normalizeQuestionnaireRiskCodes(dotaznik?.rizika);
  const decision = getExtraAnswer(dotaznik?.odpovedi_extra, "decision");
  const lzeZajetAutem = getExtraAnswer(dotaznik?.odpovedi_extra, "lze_zajet_autem");
  const mistoZpevnene = getExtraAnswer(dotaznik?.odpovedi_extra, "misto_zpevnene");
  const elektroPripravena = getExtraAnswer(dotaznik?.odpovedi_extra, "elektro_pripravena");
  const kabelPresSilnici = getExtraAnswer(dotaznik?.odpovedi_extra, "kabel_pres_silnici");

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Technické ověření klientem</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Dotazník je volitelný podklad od klienta pro jednu zakázku. Ověřená realita z akcí patří
            dlouhodobě do interních technických poznámek místa.
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-blue-200">Stav</div>
          <div className="mt-1 text-lg font-black text-white">{statusLabel}</div>
        </div>
      </div>

      {hasSavedPlace ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          U ověřených míst může být dotazník zbytečný. Rozhodnutí ale zůstává na šéfovi.
        </div>
      ) : null}

      {message === "sent" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
          <div className="text-sm font-semibold text-emerald-100">Dotazník byl odeslán klientovi.</div>
        </div>
      ) : null}

      {message === "missing_email" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Klient nemá vyplněný email.
        </div>
      ) : null}

      {message === "missing_resend_key" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Chybí env proměnná RESEND_API_KEY.
        </div>
      ) : null}

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Email</div>
          <div className="mt-1 font-semibold text-white">{link?.email_sent_at ? "Odeslán" : "Neodeslán"}</div>
          {link?.email_to ? (
            <div className="mt-1 text-xs text-slate-500">{link.email_to}</div>
          ) : null}
          {link?.email_sent_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Odesláno: {new Date(link.email_sent_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Otevření</div>
          <div className="mt-1 font-semibold text-white">{link?.open_count ?? 0}×</div>
          {link?.last_opened_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Naposledy: {new Date(link.last_opened_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Technická upozornění</div>
          <div className="mt-1 font-semibold text-white">{formatQuestionnaireRiskCount(risks.length)}</div>
          {dotaznik?.submitted_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Odesláno: {new Date(dotaznik.submitted_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>
      </div>

      {dotaznik?.submitted_at ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          <div className="mb-2 font-semibold text-white">Souhrn odpovědí</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>Rozhodnutí: {formatChoice(decision)}</div>
            <div>Výjezd technika: {dotaznik.pozadovan_vyjezd_technika ? "Ano" : "Ne"}</div>
            <div>Kontakt: {[dotaznik.kontakt_jmeno, dotaznik.kontakt_telefon].filter(Boolean).join(", ") || "—"}</div>
            <div>Příjezd autem: {formatChoice(lzeZajetAutem)}</div>
            <div>Místo zpevněné: {formatChoice(mistoZpevnene)}</div>
            <div>Elektro připraveno: {formatChoice(elektroPripravena)}</div>
            <div>Elektro: {[dotaznik.elektro_pripojka, dotaznik.elektro_jisteni, dotaznik.elektro_zasuvka].filter(Boolean).join(", ") || "—"}</div>
            <div>Vzdálenost přípojky: {dotaznik.elektro_vzdalenost_m ?? "—"} m</div>
            <div>Kabel přes silnici/průchod: {formatChoice(kabelPresSilnici)}</div>
            <div>Příjezd: {dotaznik.prijezd_poznamka || "—"}</div>
            <div>Parkování: {dotaznik.parkovani_poznamka || "—"}</div>
            <div>
              Fotky:{" "}
              {photos.length > 0
                ? `${photos.length} (${photos.map((photo) => formatPhotoType(photo.typ)).join(", ")})`
                : "—"}
            </div>
          </div>
        </div>
      ) : null}

      {dotaznik?.submitted_at ? (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div>
            <div className="font-semibold text-white">Technická upozornění</div>
            <p className="mt-1 text-sm text-slate-400">
              Automaticky vyhodnocené body z odpovědí klienta. Nejde o score, ale o konkrétní upozornění k zakázce.
            </p>
          </div>

          {risks.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100">
              Klient neuvedl žádná technická upozornění.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {risks.map((risk) => {
                const isPrimary = isPrimaryQuestionnaireRisk(risk);

                return (
                  <div
                    key={risk}
                    className={[
                      "rounded-xl border px-4 py-3 text-sm",
                      isPrimary
                        ? "border-red-500/50 bg-red-950/30 text-red-100"
                        : "border-amber-500/30 bg-amber-950/20 text-amber-100",
                    ].join(" ")}
                  >
                    <div className="font-black">{getQuestionnaireRiskLabel(risk)}</div>
                    <div className={isPrimary ? "mt-1 text-xs text-red-200" : "mt-1 text-xs text-amber-200"}>
                      {risk}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {dotaznik?.submitted_at ? (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div>
            <div className="font-semibold text-white">Fotky od klienta</div>
            <p className="mt-1 text-sm text-slate-400">
              Fotky jsou podklad jen pro tuto zakázku. Neukládají se jako dlouhodobé ověření místa.
            </p>
          </div>
          <QuestionnairePhotoGallery
            photos={galleryPhotos}
            promoteConfig={mistoId ? { zakazkaId, mistoId } : null}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={sendClientQuestionnaireAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
            Odeslat dotazník klientovi
          </button>
        </form>

        <form action={markQuestionnaireNotNeededAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
            Označit jako není potřeba
          </button>
        </form>

        <form action={markQuestionnaireInternallyVerifiedAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/60">
            Označit jako ověřeno interně
          </button>
        </form>
      </div>
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

export default async function ZakazkaDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

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
    revalidatePath("/kalendar");
    revalidatePath("/kalendar/lide");
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let mistoKonani: MistoKonaniRow | null = null;
  let mistoTechnickePoznamky: PlaceTechnicalNoteRow[] = [];
  let noteAuthorsById = new Map<string, PlaceTechnicalNoteAuthorRow>();
  let noteZakazkyById = new Map<string, PlaceTechnicalNoteZakazkaRow>();
  let existingPlacesForLink: ExistingPlaceOption[] = [];

  if (data.misto_id) {
    const { data: mistoRaw, error: mistoError } = await supabase
      .from("mista_konani")
      .select("misto_id, nazev, adresa_text")
      .eq("misto_id", data.misto_id)
      .maybeSingle();

    if (mistoError) {
      return <div>Chyba místa konání: {mistoError.message}</div>;
    }

    mistoKonani = (mistoRaw ?? null) as MistoKonaniRow | null;

    const { data: notesRaw, error: notesError } = await supabase
      .from("misto_technicke_poznamky")
      .select("id, misto_id, zakazka_id, autor_id, typ, text, dulezite, created_at, updated_at")
      .eq("misto_id", data.misto_id)
      .order("dulezite", { ascending: false })
      .order("created_at", { ascending: false });

    if (notesError) {
      return <div>Chyba technických poznámek místa: {notesError.message}</div>;
    }

    mistoTechnickePoznamky = (notesRaw ?? []) as PlaceTechnicalNoteRow[];

    const authorIds = [
      ...new Set(mistoTechnickePoznamky.map((note) => note.autor_id).filter(Boolean)),
    ] as string[];

    if (authorIds.length > 0) {
      const { data: authorsRaw, error: authorsError } = await supabase
        .from("profiles")
        .select("user_id, email, jmeno, prijmeni")
        .in("user_id", authorIds);

      if (authorsError) {
        return <div>Chyba autorů poznámek: {authorsError.message}</div>;
      }

      noteAuthorsById = new Map(
        ((authorsRaw ?? []) as PlaceTechnicalNoteAuthorRow[]).map((author) => [author.user_id, author])
      );
    }

    const noteZakazkaIds = [
      ...new Set(
        mistoTechnickePoznamky
          .map((note) => note.zakazka_id)
          .filter((zakazkaId): zakazkaId is string => Boolean(zakazkaId && zakazkaId !== id))
      ),
    ];

    if (noteZakazkaIds.length > 0) {
      const { data: noteZakazkyRaw, error: noteZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, cislo_zakazky, nazev")
        .in("zakazka_id", noteZakazkaIds);

      if (noteZakazkyError) {
        return <div>Chyba vazeb poznámek na zakázky: {noteZakazkyError.message}</div>;
      }

      noteZakazkyById = new Map(
        ((noteZakazkyRaw ?? []) as PlaceTechnicalNoteZakazkaRow[]).map((zakazka) => [
          zakazka.zakazka_id,
          zakazka,
        ])
      );
    }
  } else {
    const { data: placesRaw, error: placesError } = await supabase
      .from("mista_konani")
      .select("misto_id, nazev, adresa_text, klient_id")
      .eq("aktivni", true)
      .order("nazev", { ascending: true });

    if (placesError) {
      return <div>Chyba seznamu míst: {placesError.message}</div>;
    }

    existingPlacesForLink = (placesRaw ?? []) as ExistingPlaceOption[];
  }

  const { data: dotaznikRaw, error: dotaznikError } = await supabase
    .from("zakazka_dotazniky")
    .select(
      "dotaznik_id, stav, link_id, pozadovan_vyjezd_technika, rizika, kontakt_jmeno, kontakt_telefon, prijezd_poznamka, parkovani_poznamka, elektro_pripojka, elektro_jisteni, elektro_zasuvka, elektro_vzdalenost_m, odpovedi_extra, submitted_at, updated_at"
    )
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dotaznikError) {
    return <div>Chyba dotazníku: {dotaznikError.message}</div>;
  }

  const dotaznik = (dotaznikRaw ?? null) as ClientVerificationDotaznikRow | null;

  let dotaznikPhotos: ClientVerificationPhotoRow[] = [];
  let dotaznikGalleryPhotos: QuestionnairePhotoGalleryItem[] = [];
  if (dotaznik?.dotaznik_id) {
    const { data: photosRaw, error: photosError } = await supabase
      .from("dotaznik_fotky")
      .select("id, storage_bucket, storage_path, typ, popis, original_filename, created_at")
      .eq("dotaznik_odpoved_id", dotaznik.dotaznik_id)
      .order("poradi", { ascending: true })
      .order("created_at", { ascending: true });

    if (photosError) {
      return <div>Chyba fotek dotazníku: {photosError.message}</div>;
    }

    dotaznikPhotos = (photosRaw ?? []) as ClientVerificationPhotoRow[];
    const adminSupabase = createAdminClient();

    dotaznikGalleryPhotos = await Promise.all(
      dotaznikPhotos.map(async (photo) => {
        const { data: signedUrlData } = await adminSupabase.storage
          .from(photo.storage_bucket)
          .createSignedUrl(photo.storage_path, 60 * 60);

        return {
          id: photo.id,
          signedUrl: signedUrlData?.signedUrl ?? null,
          typ: photo.typ,
          popis: photo.popis,
          originalFilename: photo.original_filename,
          createdAt: photo.created_at,
        };
      })
    );
  }

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_client_links")
    .select("link_id, stav, email_to, email_sent_at, opened_at, last_opened_at, open_count, created_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) {
    return <div>Chyba linku dotazníku: {linkError.message}</div>;
  }

  const clientVerificationLink = (linkRaw ?? null) as ClientVerificationLinkRow | null;
  const clientVerificationStatus = getClientVerificationStatus({
    link: clientVerificationLink,
    dotaznik,
  });
  const technicalVerificationMessage =
    resolvedSearchParams?.technicke_overeni === "sent" ||
    resolvedSearchParams?.technicke_overeni === "missing_email" ||
    resolvedSearchParams?.technicke_overeni === "missing_resend_key"
      ? resolvedSearchParams.technicke_overeni
      : null;

  let klientNazev: string | null = null;
  if (data.klient_id) {
    const { data: klientRaw, error: klientError } = await supabase
      .from("klienti")
      .select("nazev")
      .eq("klient_id", data.klient_id)
      .maybeSingle();

    if (klientError) {
      return <div>Chyba: {klientError.message}</div>;
    }

    klientNazev = klientRaw?.nazev ?? null;
  }

  const headerData = {
    ...data,
    klient_nazev: klientNazev,
  };

  const { data: realizace, error: realizaceError } = await supabase
    .from("zakazka_realizace")
    .select("*")
    .eq("zakazka_id", id);

  if (realizaceError) {
    return <div>Chyba: {realizaceError.message}</div>;
  }

  const { data: technikaSummaryRaw, error: technikaSummaryError } = await supabase
    .from("technika_na_zakazce")
    .select(
      "skladova_polozka_id, mnozstvi, skladove_polozky(nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id)"
    )
    .eq("zakazka_id", id);

  if (technikaSummaryError) {
    return <div>Chyba: {technikaSummaryError.message}</div>;
  }

  const technikaRows = (technikaSummaryRaw ?? []) as TechnikaSummaryRawRow[];
  const planItemInfos = technikaRows
    .map((row) => getSkladovaPolozkaInfo(row.skladove_polozky))
    .filter(Boolean);
  const planBlokIds = [
    ...new Set(planItemInfos.map((item) => item?.sklad_blok_id).filter(Boolean)),
  ] as string[];
  const planKategorieIds = [
    ...new Set(planItemInfos.map((item) => item?.kategorie_techniky_id).filter(Boolean)),
  ] as string[];
  const planPodkategorieIds = [
    ...new Set(planItemInfos.map((item) => item?.podkategorie_techniky_id).filter(Boolean)),
  ] as string[];

  let planBloky: SkladBlokPlanRow[] = [];
  if (planBlokIds.length > 0) {
    const { data: blokyRaw, error: blokyError } = await supabase
      .from("sklad_bloky")
      .select("sklad_blok_id, nazev, poradi")
      .in("sklad_blok_id", planBlokIds);

    if (blokyError) {
      return <div>Chyba okruhů plánu: {blokyError.message}</div>;
    }

    planBloky = (blokyRaw ?? []) as SkladBlokPlanRow[];
  }

  let planKategorie: KategoriePlanRow[] = [];
  if (planKategorieIds.length > 0) {
    const { data: kategorieRaw, error: kategorieError } = await supabase
      .from("kategorie_techniky")
      .select("kategorie_techniky_id, nazev")
      .in("kategorie_techniky_id", planKategorieIds);

    if (kategorieError) {
      return <div>Chyba kategorií plánu: {kategorieError.message}</div>;
    }

    planKategorie = (kategorieRaw ?? []) as KategoriePlanRow[];
  }

  let planPodkategorie: PodkategoriePlanRow[] = [];
  if (planPodkategorieIds.length > 0) {
    const { data: podkategorieRaw, error: podkategorieError } = await supabase
      .from("podkategorie_techniky")
      .select("podkategorie_techniky_id, nazev")
      .in("podkategorie_techniky_id", planPodkategorieIds);

    if (podkategorieError) {
      return <div>Chyba podkategorií plánu: {podkategorieError.message}</div>;
    }

    planPodkategorie = (podkategorieRaw ?? []) as PodkategoriePlanRow[];
  }

  const planBlokMap = new Map(planBloky.map((row) => [row.sklad_blok_id, row]));
  const planKategorieMap = new Map(planKategorie.map((row) => [row.kategorie_techniky_id, row]));
  const planPodkategorieMap = new Map(
    planPodkategorie.map((row) => [row.podkategorie_techniky_id, row])
  );

  const technikaSummary = technikaRows.map((row) => {
    const info = getSkladovaPolozkaInfo(row.skladove_polozky);
    const blok = info?.sklad_blok_id ? planBlokMap.get(info.sklad_blok_id) : null;
    const kategorie = info?.kategorie_techniky_id
      ? planKategorieMap.get(info.kategorie_techniky_id)
      : null;
    const podkategorie = info?.podkategorie_techniky_id
      ? planPodkategorieMap.get(info.podkategorie_techniky_id)
      : null;

    return {
      skladova_polozka_id: row.skladova_polozka_id,
      mnozstvi: row.mnozstvi,
      nazev: info?.nazev?.trim() || row.skladova_polozka_id,
      pozice: info?.pozice ?? null,
      okruhNazev: blok?.nazev?.trim() || "Bez okruhu",
      okruhPoradi: blok?.poradi ?? 999999,
      kategorieNazev: kategorie?.nazev?.trim() || "—",
      podkategorieNazev: podkategorie?.nazev?.trim() || "—",
    };
  }) as TechnikaSummaryRow[];

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

  let loadingKusHistory: LoadingKusHistoryRow[] = [];
  if (assignmentKusIds.length > 0) {
    const { data: historyRaw, error: historyError } = await supabase
      .from("sklad_kus_historie")
      .select("kus_id, typ_akce, poznamka, created_at")
      .eq("zakazka_id", id)
      .eq("typ_akce", "nalozeno")
      .in("kus_id", assignmentKusIds)
      .order("created_at", { ascending: false });

    if (historyError) {
      return <div>Chyba historie náhrad: {historyError.message}</div>;
    }

    loadingKusHistory = (historyRaw ?? []) as LoadingKusHistoryRow[];
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

  const replacementPolozkaByKus = buildReplacementPolozkaByKus(
    loadingKusHistory,
    planRows,
    loadingPolozky
  );

  const loadingStatusGroups = buildLoadingStatusGroups(
    planRows,
    loadingAssignments,
    loadingKusy,
    loadingPolozky,
    loadingBloky,
    replacementPolozkaByKus
  );

  return (
    <div className="w-full">
      <ZakazkaHeaderCard zakazkaId={id} data={headerData} cancelAction={cancelZakazka} />

      <ZakazkaScheduleCard data={data} action={updateZakazkaSchedule} />

      <ZakazkaBasicLookCard realizace={(realizace ?? []) as RealizaceRow[]} data={data} />

      {!data.misto_id ? (
        <ZakazkaPlaceConnectionCard
          zakazka={{
            zakazkaId: id,
            nazev: data.nazev ?? null,
            klientId: data.klient_id ?? null,
            misto: data.misto ?? null,
            mistoLat: data.misto_lat ?? null,
            mistoLng: data.misto_lng ?? null,
            mistoRadius: data.misto_gps_radius_m ?? null,
          }}
          places={existingPlacesForLink}
        />
      ) : null}

      <PlaceTechnicalNotesCard
        currentZakazkaId={id}
        misto={mistoKonani}
        notes={mistoTechnickePoznamky}
        authorsById={noteAuthorsById}
        zakazkyById={noteZakazkyById}
        showPlaceDetailLink
      />

      <ClientTechnicalVerificationCard
        zakazkaId={id}
        mistoId={user ? data.misto_id ?? null : null}
        statusLabel={clientVerificationStatus}
        link={clientVerificationLink}
        dotaznik={dotaznik}
        photos={dotaznikPhotos}
        galleryPhotos={dotaznikGalleryPhotos}
        message={technicalVerificationMessage}
        hasSavedPlace={Boolean(data.misto_id)}
      />

      <PlanTechnikyCard items={technikaSummary} />

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



