"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PickerInput } from "@/components/ui/picker-input";

export type Zakazka = {
  zakazka_id: string;
  cislo_zakazky: string;
  nazev: string;
  misto: string | null;
  datum_od: string;
  datum_do: string;
  cas_od: string | null;
  cas_do: string | null;
  zrusena?: boolean | null;
  loading_status?: string | null;
};

type FilterMode = "all" | "active" | "future" | "past";
type ScopeMode = "zakazky" | "archiv";

const selectClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const scopeButtonClass =
  "rounded-xl border px-4 py-2 text-sm font-semibold transition";

function normalizeTime(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") return fallback;
  return value.length === 5 ? `${value}:00` : value;
}

function toDateTime(datum: string, cas: string) {
  return new Date(`${datum}T${cas}`);
}

function getStart(zakazka: Zakazka) {
  return toDateTime(zakazka.datum_od, normalizeTime(zakazka.cas_od, "00:00:00"));
}

function getEnd(zakazka: Zakazka) {
  return toDateTime(zakazka.datum_do, normalizeTime(zakazka.cas_do, "23:59:59"));
}

function jeProbihajici(zakazka: Zakazka, ted: Date) {
  const od = getStart(zakazka);
  const doDatum = getEnd(zakazka);
  return od <= ted && doDatum >= ted;
}

function jeNadchazejici(zakazka: Zakazka, ted: Date) {
  const od = getStart(zakazka);
  return od > ted;
}

function jeMinula(zakazka: Zakazka, ted: Date) {
  const doDatum = getEnd(zakazka);
  return doDatum < ted;
}

function jeZrusena(zakazka: Zakazka) {
  return Boolean(zakazka.zrusena);
}

function formatDatum(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatCas(value: string | null | undefined, fallback: string) {
  const normalized = normalizeTime(value, fallback);
  return normalized.slice(0, 5);
}

function formatDatumCas(z: Zakazka) {
  const datumOd = formatDatum(z.datum_od);
  const datumDo = formatDatum(z.datum_do);
  const casOd = formatCas(z.cas_od, "00:00:00");
  const casDo = formatCas(z.cas_do, "23:59:59");

  if (z.datum_od === z.datum_do) {
    return `${datumOd} | ${casOd} → ${casDo}`;
  }

  return `${datumOd} ${casOd} → ${datumDo} ${casDo}`;
}

function matchMode(zakazka: Zakazka, ted: Date, mode: FilterMode) {
  if (mode === "active") return jeProbihajici(zakazka, ted);
  if (mode === "future") return jeNadchazejici(zakazka, ted);
  if (mode === "past") return jeMinula(zakazka, ted);
  return true;
}

function matchSearch(zakazka: Zakazka, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;

  const haystack = [zakazka.cislo_zakazky, zakazka.nazev, zakazka.misto ?? ""]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function matchDateRange(zakazka: Zakazka, from: string, to: string) {
  if (from && zakazka.datum_do < from) return false;
  if (to && zakazka.datum_od > to) return false;
  return true;
}

function ZakazkaCard({
  zakazka,
  canDeletePermanently,
  smazatTrvaleAction,
}: {
  zakazka: Zakazka;
  canDeletePermanently?: boolean;
  smazatTrvaleAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card className="transition hover:border-slate-700 hover:bg-[#0b1324]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <Link href={`/zakazky/${zakazka.zakazka_id}`} className="block flex-1">
          <div className="space-y-3">
            <div className="text-2xl font-bold text-white">
              {zakazka.cislo_zakazky} – {zakazka.nazev}
            </div>

            <div className="space-y-1 text-sm text-slate-300">
              <div>
                <span className="font-semibold text-slate-200">Místo:</span>{" "}
                {zakazka.misto || "—"}
              </div>
              <div>
                <span className="font-semibold text-slate-200">Termín:</span>{" "}
                {formatDatumCas(zakazka)}
              </div>
              {jeZrusena(zakazka) ? (
                <div className="text-red-300">
                  <span className="font-semibold text-red-200">Stav:</span> Zrušená
                </div>
              ) : null}
              {zakazka.loading_status ? (
                <div>
                  <span className="font-semibold text-slate-200">Nakládka:</span>{" "}
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-bold text-slate-100">
                    {zakazka.loading_status}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </Link>

        {canDeletePermanently ? (
          <form action={smazatTrvaleAction} className="shrink-0">
            <input type="hidden" name="zakazka_id" value={zakazka.zakazka_id} />
            <button
              type="submit"
              onClick={(e) => {
                const ok = window.confirm(
                  `Trvale smazat zakázku ${zakazka.cislo_zakazky} – ${zakazka.nazev}?`
                );
                if (!ok) e.preventDefault();
              }}
              className="rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-600/30"
            >
              Smazat trvale
            </button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function Sekce({
  title,
  items,
  allowPermanentDelete,
  smazatTrvaleAction,
}: {
  title: string;
  items: Zakazka[];
  allowPermanentDelete?: boolean;
  smazatTrvaleAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-2xl font-semibold text-white">
        {title} <span className="text-lg text-slate-500">({items.length})</span>
      </h2>

      {items.length === 0 ? (
        <div className="text-slate-500">Žádné zakázky</div>
      ) : (
        <div className="grid gap-3">
          {items.map((z) => (
            <ZakazkaCard
              key={z.zakazka_id}
              zakazka={z}
              canDeletePermanently={allowPermanentDelete && jeZrusena(z)}
              smazatTrvaleAction={smazatTrvaleAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ZakazkyListClient({
  initialZakazky,
  smazatTrvaleAction,
}: {
  initialZakazky: Zakazka[];
  smazatTrvaleAction: (formData: FormData) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [mode, setMode] = useState<FilterMode>("all");
  const [scope, setScope] = useState<ScopeMode>("zakazky");

  const ted = useMemo(() => new Date(), []);

  const scopedZakazky = useMemo(() => {
    return initialZakazky.filter((z) => {
      if (scope === "zakazky") {
        return !jeZrusena(z) && !jeMinula(z, ted);
      }

      return jeZrusena(z) || jeMinula(z, ted);
    });
  }, [initialZakazky, scope, ted]);

  const filteredZakazky = useMemo(() => {
    return scopedZakazky.filter((z) => {
      return (
        matchSearch(z, search) &&
        matchDateRange(z, datumOd, datumDo) &&
        (scope === "archiv" ? true : matchMode(z, ted, mode))
      );
    });
  }, [scopedZakazky, search, datumOd, datumDo, ted, mode, scope]);

  const probihajici = useMemo(
    () => filteredZakazky.filter((z) => !jeZrusena(z) && jeProbihajici(z, ted)),
    [filteredZakazky, ted]
  );

  const nadchazejici = useMemo(
    () => filteredZakazky.filter((z) => !jeZrusena(z) && jeNadchazejici(z, ted)),
    [filteredZakazky, ted]
  );

  const minule = useMemo(
    () => filteredZakazky.filter((z) => !jeZrusena(z) && jeMinula(z, ted)).reverse(),
    [filteredZakazky, ted]
  );

  const zrusene = useMemo(
    () =>
      filteredZakazky
        .filter((z) => jeZrusena(z))
        .slice()
        .sort((a, b) => getStart(b).getTime() - getStart(a).getTime()),
    [filteredZakazky]
  );

  const maAktivniFiltry =
    search.trim() !== "" || datumOd !== "" || datumDo !== "" || mode !== "all";

  function resetFilters() {
    setSearch("");
    setDatumOd("");
    setDatumDo("");
    setMode("all");
  }

  return (
    <main className="w-full text-white">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Zakázky"
          description="Přehled aktuálních zakázek a archivu."
        />
        <Link
          href="/zakazky/nova"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
        >
          Nová zakázka
        </Link>
      </div>

      <Card className="mb-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setScope("zakazky")}
            className={[
              scopeButtonClass,
              scope === "zakazky"
                ? "border-blue-500 bg-blue-600/20 text-white"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700",
            ].join(" ")}
          >
            Zakázky
          </button>

          <button
            type="button"
            onClick={() => setScope("archiv")}
            className={[
              scopeButtonClass,
              scope === "archiv"
                ? "border-blue-500 bg-blue-600/20 text-white"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700",
            ].join(" ")}
          >
            Archiv
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Hledat">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Číslo, název nebo místo"
            />
          </Field>

          <Field label="Datum od">
            <PickerInput picker="date" value={datumOd} onChange={(e) => setDatumOd(e.target.value)} />
          </Field>

          <Field label="Datum do">
            <PickerInput picker="date" value={datumDo} onChange={(e) => setDatumDo(e.target.value)} />
          </Field>

          <Field label="Stav">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as FilterMode)}
              className={selectClassName}
            >
              <option value="all">Vše</option>
              <option value="active">Probíhající</option>
              <option value="future">Budoucí</option>
              <option value="past">Minulé</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Zobrazeno: {filteredZakazky.length} / {scopedZakazky.length}
          </div>

          {maAktivniFiltry ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Vyčistit filtry
            </button>
          ) : null}
        </div>
      </Card>

      {scope === "zakazky" ? (
        <>
          <Sekce title="Probíhající" items={probihajici} smazatTrvaleAction={smazatTrvaleAction} />
          <Sekce title="Nadcházející" items={nadchazejici} smazatTrvaleAction={smazatTrvaleAction} />
        </>
      ) : (
        <>
          <Sekce title="Minulé" items={minule} smazatTrvaleAction={smazatTrvaleAction} />
          <Sekce title="Zrušené" items={zrusene} allowPermanentDelete smazatTrvaleAction={smazatTrvaleAction} />
        </>
      )}
    </main>
  );
}