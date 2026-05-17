import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ParticipationActions } from "../../ParticipationActions";

type PageProps = {
  params: Promise<{ id: string }>;
};

type AssignmentRow = {
  id: string | number;
  zakazka_id: string;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  poznamka: string | null;
  confirmation_status: string | null;
  declined_reason: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  misto_lat: number | string | null;
  misto_lng: number | string | null;
  poznamka: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  logistika_stav: string | null;
};

type TechnikaRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
  skladove_polozky:
    | {
        nazev: string | null;
      }
    | {
        nazev: string | null;
      }[]
    | null;
};

function normalizeStatus(value?: string | null) {
  if (value === "accepted") return "accepted";
  if (value === "declined") return "declined";
  return "pending";
}

function getStatusLabel(value?: string | null) {
  const status = normalizeStatus(value);
  if (status === "accepted") return "Potvrzeno";
  if (status === "declined") return "Odmítnuto";
  return "Čeká na potvrzení";
}

function getStatusVariant(value?: string | null) {
  const status = normalizeStatus(value);
  if (status === "accepted") return "success";
  if (status === "declined") return "danger";
  return "warning";
}

function getPhaseLabel(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "Nakládka";
  if (raw === "stavba") return "Stavba";
  if (raw === "bourani" || raw === "bourání") return "Bourání";
  return "Provoz akce";
}

function isLogisticsPhase(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "sklad" || raw === "nakladka" || raw === "nakládka" || raw === "bourani" || raw === "bourání";
}

function getLogisticsStatusLabel(value?: string | null) {
  if (value === "naklada_se") return "Nakládá se";
  if (value === "nalozeno") return "Naloženo";
  if (value === "vykladka") return "Probíhá vykládka";
  if (value === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(from?: string | null, to?: string | null) {
  const fromText = formatDateTime(from);
  const toText = formatDateTime(to);

  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

function formatDateOnly(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatZakazkaDate(zakazka: ZakazkaRow) {
  const directRange = formatRange(zakazka.akce_od, zakazka.akce_do);
  if (directRange !== "Čas není zadaný") return directRange;

  const from = formatDateOnly(zakazka.datum_od);
  const to = formatDateOnly(zakazka.datum_do);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || "Termín není vyplněný";
}

function getNavigationUrl(zakazka: ZakazkaRow | null) {
  const lat = Number(zakazka?.misto_lat ?? NaN);
  const lng = Number(zakazka?.misto_lng ?? NaN);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  const query = String(zakazka?.misto ?? "").trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function getTechnikaName(value: TechnikaRow["skladove_polozky"]) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.nazev || "Položka techniky";
}

function getZakazkaTitle(zakazka: ZakazkaRow) {
  return [zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

export default async function MojeZakazkaReadOnlyPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, misto_lat, misto_lng, poznamka, akce_od, akce_do, datum_od, datum_do, logistika_stav")
    .eq("zakazka_id", id)
    .maybeSingle();

  if (zakazkaError) {
    return <div>Chyba načtení zakázky: {zakazkaError.message}</div>;
  }

  if (!zakazkaRaw) {
    return <div>Zakázka nebyla nalezena.</div>;
  }

  const zakazka = zakazkaRaw as ZakazkaRow;
  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select("id, zakazka_id, user_id, datum_od, datum_do, typ_bloku, poznamka, confirmation_status, declined_reason")
    .eq("zakazka_id", id)
    .eq("user_id", user.id)
    .order("datum_od", { ascending: true, nullsFirst: false });

  if (assignmentsError) {
    return <div>Chyba načtení přiřazení: {assignmentsError.message}</div>;
  }

  const assignments = (assignmentsRaw ?? []) as AssignmentRow[];
  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(nazev)")
    .eq("zakazka_id", id)
    .order("skladova_polozka_id", { ascending: true });

  if (technikaError) {
    return <div>Chyba načtení technického plánu: {technikaError.message}</div>;
  }

  const technika = (technikaRaw ?? []) as TechnikaRow[];
  const navigationUrl = getNavigationUrl(zakazka);

  return (
    <div className="space-y-5">
      <Link href="/moje" className="inline-flex text-sm font-semibold text-blue-200 hover:text-blue-100">
        ← Zpět na moje zakázky
      </Link>

      <Card className="space-y-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Moje práce</div>
          <h1 className="mt-2 text-3xl font-black leading-tight text-white">{getZakazkaTitle(zakazka)}</h1>
          <div className="mt-3 text-base font-semibold text-slate-300">
            {zakazka.misto || "Místo není vyplněné"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Datum a čas akce</div>
            <div className="mt-1 text-sm font-bold text-white">{formatZakazkaDate(zakazka)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Místo</div>
            <div className="mt-1 text-sm font-bold text-white">{zakazka.misto || "Není vyplněné"}</div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {navigationUrl ? (
            <a
              href={navigationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/20 px-5 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-600/30"
            >
              Navigovat
            </a>
          ) : null}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">Moje fáze práce</h2>
        {assignments.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-400">
              K této zakázce nemáte přiřazenou žádnou fázi.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {assignments.map((assignment) => {
              const status = normalizeStatus(assignment.confirmation_status);

              return (
                <Card key={String(assignment.id)} className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-white">
                        {getPhaseLabel(assignment.typ_bloku)}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {formatRange(assignment.datum_od, assignment.datum_do)}
                      </div>
                  {isLogisticsPhase(assignment.typ_bloku) ? (
                    <div className="mt-3 inline-flex rounded-md border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-100">
                      {getLogisticsStatusLabel(zakazka.logistika_stav)}
                    </div>
                  ) : null}
                    </div>
                    <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
                  </div>

                  {assignment.poznamka ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Poznámka k přiřazení
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                        {assignment.poznamka}
                      </div>
                    </div>
                  ) : null}

                  {status === "declined" && assignment.declined_reason ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      Důvod odmítnutí: {assignment.declined_reason}
                    </div>
                  ) : null}

                  <ParticipationActions assignmentId={String(assignment.id)} status={status} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {zakazka.poznamka ? (
        <Card className="space-y-2">
          <h2 className="text-xl font-bold text-white">Poznámka k zakázce</h2>
          <div className="whitespace-pre-wrap text-sm text-slate-200">{zakazka.poznamka}</div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold text-white">Technický plán</h2>
        {technika.length === 0 ? (
          <div className="text-sm text-slate-400">Technický plán zatím není vyplněný.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {technika.map((item) => (
              <div
                key={`${item.skladova_polozka_id}-${getTechnikaName(item.skladove_polozky)}`}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="font-semibold text-slate-100">
                  {getTechnikaName(item.skladove_polozky)}
                </div>
                <div className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-slate-200">
                  {item.mnozstvi ?? 0}×
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
