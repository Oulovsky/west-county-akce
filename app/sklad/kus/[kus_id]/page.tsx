import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SKLAD_KUS_SELECT_FIELDS, SKLAD_TABLE } from "@/lib/sklad/constants";
import {
  formatDateTime,
  formatNumber,
  formatSkladKusStav,
  getKusStatus,
  getSkladKusDisplayLabel,
} from "@/lib/sklad/helpers";
import type {
  SkladDetailRow,
  SkladKusHistorieRow,
  SkladKusRow,
  SkladKusZakazkaAssignmentRow,
  SkladPoskozeniRow,
} from "@/lib/sklad/types";
import {
  formatSkladKusHistorieTypAkce,
  formatSkladKusHistorieZakazka,
  querySkladKusHistorie,
} from "@/lib/sklad/kusHistorie";
import {
  formatZakazkaKusDatum,
  formatZakazkaKusStav,
  formatZakazkaKusZakazkaLabel,
  queryAktivniZakazkaKusu,
} from "@/lib/sklad/zakazkaKusy";
import { SkladKusQuickActions } from "./SkladKusQuickActions";

type PageProps = {
  params: Promise<{ kus_id: string }>;
};

function positionText(position: number | string | null | undefined): string {
  const text = String(position ?? "").trim();
  return text ? `Pozice ${text}` : "Pozice —";
}

function DetailCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-700 bg-blue-950 text-blue-100"
      : tone === "emerald"
        ? "border-emerald-700 bg-emerald-950 text-emerald-100"
        : tone === "amber"
          ? "border-amber-700 bg-amber-950 text-amber-100"
          : "border-slate-700 bg-slate-950 text-white";

  return (
    <div className={["rounded-2xl border p-4", toneClass].join(" ")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black leading-tight tracking-tight">
        {value}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-relaxed text-white">
        {children}
      </div>
    </div>
  );
}

function getPouzitelnostLabel(openDamage: SkladPoskozeniRow[]): string {
  if (openDamage.some((item) => item.blokuje_pouziti)) return "Blokovaný";
  if (openDamage.length > 0) return "Poškozený";
  return "Použitelný";
}

function getPouzitelnostClassName(openDamage: SkladPoskozeniRow[]): string {
  if (openDamage.some((item) => item.blokuje_pouziti)) {
    return "border-red-700 bg-red-950 text-red-100";
  }
  if (openDamage.length > 0) {
    return "border-amber-700 bg-amber-950 text-amber-100";
  }
  return "border-emerald-700 bg-emerald-950 text-emerald-100";
}

function formatDamageSummary(item: SkladPoskozeniRow): string {
  const parts = [
    item.blokuje_pouziti ? "Blokuje použití" : "Poškození",
    item.typ_poskozeni?.trim() || null,
    item.priorita?.trim() ? `priorita ${item.priorita}` : null,
    formatDateTime(item.datum_nahlaseni),
  ].filter(Boolean);

  return parts.join(" · ");
}

export default async function SkladKusDetailPage({ params }: PageProps) {
  const { kus_id: kusId } = await params;
  const supabase = await createClient();

  const { data: kusRaw, error: kusError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select(SKLAD_KUS_SELECT_FIELDS)
    .eq("kus_id", kusId)
    .maybeSingle();

  if (kusError) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 p-5 text-red-100">
        Nepodařilo se načíst kus: {kusError.message}
      </div>
    );
  }

  const kus = kusRaw as SkladKusRow | null;

  if (!kus) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Kus nenalezen</h1>
        <p className="mt-2 text-sm text-slate-400">
          QR odkaz neodpovídá žádnému evidovanému kusu skladu.
        </p>
        <Link
          href="/sklad"
          className="mt-4 inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Zpět do skladu
        </Link>
      </div>
    );
  }

  const { data: detailRaw, error: detailError } = await supabase.rpc(
    "get_skladova_polozka_detail",
    {
      p_skladova_polozka_id: kus.skladova_polozka_id,
    }
  );

  if (detailError) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 p-5 text-red-100">
        Nepodařilo se načíst položku kusu: {detailError.message}
      </div>
    );
  }

  const row = ((detailRaw ?? [])[0] ?? null) as SkladDetailRow | null;

  if (!row) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Položka kusu nenalezena</h1>
        <p className="mt-2 text-sm text-slate-400">
          Kus existuje, ale navázaná skladová položka se nepodařila najít.
        </p>
      </div>
    );
  }

  const label = getSkladKusDisplayLabel(row.nazev, kus);
  const stav = formatSkladKusStav(kus.stav);
  const pozice = positionText(row.pozice);
  const [
    { data: assignmentRaw, error: assignmentError },
    { data: historieRaw, error: historieError },
    { data: poskozeniRaw, error: poskozeniError },
  ] = await Promise.all([
    queryAktivniZakazkaKusu(supabase, kus.kus_id),
    querySkladKusHistorie(supabase, kus.kus_id),
    supabase
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .select("poskozeni_id, skladova_polozka_id, kus_id, zakazka_id, pocet_kusu, popis, typ_poskozeni, priorita, blokuje_pouziti, stav_reseni, datum_nahlaseni, datum_uzavreni")
      .eq("kus_id", kus.kus_id)
      .is("datum_uzavreni", null)
      .order("datum_nahlaseni", { ascending: false }),
  ]);
  const assignment = (assignmentRaw ?? null) as SkladKusZakazkaAssignmentRow | null;
  const historie = (historieRaw ?? []) as unknown as SkladKusHistorieRow[];
  const openPoskozeni = (poskozeniRaw ?? []) as SkladPoskozeniRow[];
  const kusStatus = getKusStatus(kus, openPoskozeni);
  const lastAudit = historie[0] ?? null;
  const lastOpenDamage = openPoskozeni[0] ?? null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-1 sm:px-0">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detail naskenovaného kusu
        </div>
        <h1 className="mt-2 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
          {row.nazev}
        </h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailCard
            label="Kus"
            value={`Kus #${formatNumber(kus.poradove_cislo)}`}
            tone="blue"
          />
          <DetailCard label="Pozice skladu" value={pozice} tone="emerald" />
          <DetailCard label="Stav kusu" value={stav} tone="amber" />
          <DetailCard label="Kategorie" value={row.kategorie_nazev ?? "—"} />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-200">
        <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
          <span className="text-slate-500">Podkategorie</span>
          <span className="text-right font-semibold text-white">
            {row.podkategorie_nazev ?? "—"}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
          <span className="text-slate-500">Popisek kusu</span>
          <span className="text-right font-semibold text-white">
            {label}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Poznámka kusu</span>
          <span className="text-right font-semibold text-white">
            {kus.poznamka?.trim() || "—"}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Aktuální stav kusu
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Read-only souhrn z evidence kusu, zakázky, poškození a auditu.
            </p>
          </div>
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-center text-lg font-black",
              getPouzitelnostClassName(openPoskozeni),
            ].join(" ")}
            title={kusStatus.text}
          >
            {getPouzitelnostLabel(openPoskozeni)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryRow label="Stav kusu">
            {stav}
          </SummaryRow>
          <SummaryRow label="Stav na zakázce">
            {assignment ? formatZakazkaKusStav(assignment.stav) : "Není na aktivní zakázce"}
          </SummaryRow>
          <SummaryRow label="Poslední audit událost">
            {lastAudit ? (
              <>
                {formatSkladKusHistorieTypAkce(lastAudit.typ_akce)}
                <span className="block text-xs font-medium text-slate-400">
                  {formatDateTime(lastAudit.created_at)}
                </span>
              </>
            ) : (
              "—"
            )}
          </SummaryRow>
          <SummaryRow label="Poslední otevřené poškození / blokace">
            {poskozeniError ? (
              <span className="text-amber-200">
                Nepodařilo se načíst: {poskozeniError.message}
              </span>
            ) : lastOpenDamage ? (
              <>
                {formatDamageSummary(lastOpenDamage)}
                {lastOpenDamage.popis?.trim() ? (
                  <span className="block text-xs font-medium text-slate-400">
                    {lastOpenDamage.popis}
                  </span>
                ) : null}
              </>
            ) : (
              "Žádné otevřené poškození"
            )}
          </SummaryRow>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-xl font-black tracking-tight text-white">
          Aktuální zakázka
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Fyzické přiřazení kusu k zakázce určuje scan workflow přes zakazka_kusy.
        </p>
        {assignment ? (
          <div className="mt-4 grid gap-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-blue-800 bg-blue-950/50 p-4 text-sm font-semibold text-blue-100">
              Kus je již přiřazen k aktivní zakázce.
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Zakázka
              </div>
              <div className="mt-1 text-xl font-black text-white">
                {formatZakazkaKusZakazkaLabel(assignment)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailCard
                label="Datum"
                value={formatZakazkaKusDatum(assignment)}
              />
              <DetailCard
                label="Stav na zakázce"
                value={formatZakazkaKusStav(assignment.stav)}
                tone="blue"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
            Kus není přiřazen k aktivní zakázce.
            {assignmentError ? (
              <div className="mt-2 text-xs text-amber-300">
                Vazba zakázka ↔ kus zatím není dostupná: {assignmentError.message}
              </div>
            ) : null}
            <div className="mt-3 text-xs text-slate-500">
              Konkrétní kus se přiřadí až scanem v loading workflow konkrétní zakázky.
            </div>
          </div>
        )}
      </section>

      <SkladKusQuickActions
        assignmentId={assignment?.id ?? null}
        currentZakazkaKusStav={assignment?.stav ?? null}
      />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-xl font-black tracking-tight text-white">
          Historie kusu
        </h2>
        {historieError ? (
          <div className="mt-4 rounded-2xl border border-amber-900 bg-amber-950/50 p-4 text-sm text-amber-100">
            Historii kusu se nepodařilo načíst: {historieError.message}
          </div>
        ) : historie.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
            Zatím nejsou evidované žádné pohyby kusu.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {historie.map((item) => (
              <div
                key={item.historie_id}
                className="relative rounded-2xl border border-slate-700 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-lg font-black text-white">
                      {formatSkladKusHistorieTypAkce(item.typ_akce)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-300">
                      {formatSkladKusHistorieZakazka(item)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-500">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
                {item.poznamka?.trim() ? (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    {item.poznamka}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/sklad/${row.skladova_polozka_id}`}
          className="rounded-xl border border-amber-700 bg-amber-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Otevřít položku skladu
        </Link>
        <Link
          href="/sklad"
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Zpět do skladu
        </Link>
      </div>
    </div>
  );
}
