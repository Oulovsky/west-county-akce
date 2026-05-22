import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MobileFieldLayout } from "@/components/mobile/MobileFieldLayout";
import { RememberActiveZakazka } from "@/components/mobile/RememberActiveZakazka";
import { getDochazkaPath, getZakazkaScanPath } from "@/lib/mobile/routes";
import { createClient } from "@/lib/supabase/server";
import { splitTransportVehiclesForUser } from "@/lib/transport-attendance";
import { isPrepravaTypBloku, normalizeTransportVehicleMode } from "@/lib/zakazka-attendance";
import { ParticipationActions } from "../../ParticipationActions";
import { AttendanceActions } from "../../AttendanceActions";
import { TransportAttendanceActions } from "../../TransportAttendanceActions";

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
  active_attendance_id?: string | null;
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
  zrusena?: boolean | null;
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
  if (raw === "preprava" || raw === "prejezd" || raw === "přejezd") return "Přeprava";
  return "Provoz akce";
}

function isLogisticsPhase(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "sklad" || raw === "nakladka" || raw === "nakládka" || raw === "bourani" || raw === "bourání";
}

function getLogisticsStatusLabel(value?: string | null) {
  if (value === "zruseno") return "Zrušeno";
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
    .select("zakazka_id, cislo_zakazky, nazev, misto, misto_lat, misto_lng, poznamka, akce_od, akce_do, datum_od, datum_do, zrusena, logistika_stav")
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
  const assignmentIds = assignments.map((assignment) => String(assignment.id));
  if (assignmentIds.length > 0) {
    const { data: activeAttendanceRaw, error: activeAttendanceError } = await supabase
      .from("dochazka_zakazky")
      .select("id, assignment_id")
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .in("assignment_id", assignmentIds)
      .neq("typ_faze", "preprava");

    if (activeAttendanceError) {
      return <div>Chyba načtení docházky: {activeAttendanceError.message}</div>;
    }

    const activeByAssignment = new Map(
      (activeAttendanceRaw ?? []).map((row) => [String(row.assignment_id), row.id as string])
    );

    for (const assignment of assignments) {
      assignment.active_attendance_id = activeByAssignment.get(String(assignment.id)) ?? null;
    }
  }

  const { data: openTransportRaw, error: openTransportError } = await supabase
    .from("dochazka_zakazky")
    .select("transport_vehicle_mode")
    .eq("user_id", user.id)
    .eq("zakazka_id", id)
    .eq("typ_faze", "preprava")
    .is("checkout_at", null)
    .maybeSingle();

  if (openTransportError) {
    return <div>Chyba načtení přepravy: {openTransportError.message}</div>;
  }

  const activeTransport = Boolean(openTransportRaw);
  const activeTransportMode = normalizeTransportVehicleMode(openTransportRaw?.transport_vehicle_mode);
  const workAssignments = assignments.filter(
    (assignment) => !isPrepravaTypBloku(assignment.typ_bloku)
  );
  const hasAcceptedWork = workAssignments.some(
    (assignment) => normalizeStatus(assignment.confirmation_status) === "accepted"
  );

  const { data: attendanceVehiclesRaw, error: attendanceVehiclesError } = await supabase
    .from("vozidla")
    .select("id, nazev, spz, typ, vlastnik_user_id")
    .eq("aktivni", true)
    .order("nazev");

  if (attendanceVehiclesError) {
    return <div>Chyba načtení vozidel: {attendanceVehiclesError.message}</div>;
  }

  const transportVehicles = splitTransportVehiclesForUser(
    (attendanceVehiclesRaw ?? []) as Array<{
      id: string;
      nazev: string;
      spz?: string | null;
      typ: string;
      vlastnik_user_id?: string | null;
    }>,
    user.id
  );

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
    <MobileFieldLayout className="space-y-5">
      <RememberActiveZakazka
        zakazkaId={id}
        cislo={zakazka.cislo_zakazky}
        nazev={zakazka.nazev}
      />
      <Link href="/moje" className="inline-flex text-sm font-semibold text-blue-200 hover:text-blue-100">
        ← Moje zakázky
      </Link>

      {!zakazka.zrusena ? (
        <div className="grid gap-2 lg:hidden">
          <Link
            href={getZakazkaScanPath(id)}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-4 text-base font-black text-white transition active:scale-[0.99] hover:bg-blue-500"
          >
            Otevřít scan
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={getDochazkaPath(id)}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-3 text-sm font-black text-emerald-100"
            >
              Začít práci
            </Link>
            {navigationUrl ? (
              <a
                href={navigationUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm font-black text-slate-100"
              >
                Navigovat
              </a>
            ) : (
              <span className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 px-3 text-sm font-semibold text-slate-500">
                Bez GPS
              </span>
            )}
          </div>
        </div>
      ) : null}

      <Card className="space-y-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Moje práce</div>
          <h1 className="mt-2 break-words text-3xl font-black leading-tight text-white">{getZakazkaTitle(zakazka)}</h1>
          <div className="mt-3 break-words text-base font-semibold text-slate-300">
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

      {zakazka.zrusena ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <div className="text-sm font-bold text-red-100">Zakázka byla zrušena</div>
          <div className="mt-1 text-sm text-red-100/80">
            Tato práce už není aktivní. Detail zůstává dostupný pro historii.
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">Moje fáze práce</h2>
        {workAssignments.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-400">
              K této zakázce nemáte přiřazenou žádnou fázi práce.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {workAssignments.map((assignment) => {
              const status = normalizeStatus(assignment.confirmation_status);

              return (
                <Card key={String(assignment.id)} className="space-y-4 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
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
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">
                        {assignment.poznamka}
                      </div>
                    </div>
                  ) : null}

                  {status === "declined" && assignment.declined_reason ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      Důvod odmítnutí: {assignment.declined_reason}
                    </div>
                  ) : null}

                  {!zakazka.zrusena ? (
                    <ParticipationActions assignmentId={String(assignment.id)} status={status} />
                  ) : null}

                  {!zakazka.zrusena && status === "accepted" ? (
                    <AttendanceActions
                      assignmentId={String(assignment.id)}
                      active={Boolean(assignment.active_attendance_id)}
                    />
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {!zakazka.zrusena && hasAcceptedWork ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Přeprava</h2>
          <p className="text-sm text-slate-400">
            Přeprava je dostupná automaticky u zakázky. Není potřeba zvláštní přiřazení od šéfa.
          </p>
          <TransportAttendanceActions
            zakazkaId={id}
            active={activeTransport}
            activeTransportMode={activeTransportMode}
            companyVehicles={transportVehicles.companyVehicles}
            privateVehicles={transportVehicles.privateVehicles}
          />
        </section>
      ) : null}

      {zakazka.poznamka ? (
        <Card className="space-y-2">
          <h2 className="text-xl font-bold text-white">Poznámka k zakázce</h2>
          <div className="whitespace-pre-wrap break-words text-sm text-slate-200">{zakazka.poznamka}</div>
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
                <div className="min-w-0 break-words font-semibold text-slate-100">
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
    </MobileFieldLayout>
  );
}
