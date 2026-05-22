import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isZakazkaId } from "@/lib/mobile/routes";
import { splitTransportVehiclesForUser } from "@/lib/transport-attendance";
import { normalizeTransportVehicleMode } from "@/lib/zakazka-attendance";
import { DochazkaWorkClient } from "./DochazkaWorkClient";
import {
  buildDochazkaGroups,
  isAcceptedAssignment,
  type DochazkaAssignmentRow,
  type DochazkaZakazkaRow,
} from "./dochazka-shared";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ zakazka?: string }>;
};

type AssignmentDbRow = {
  id: string | number;
  zakazka_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  poznamka: string | null;
  confirmation_status: string | null;
};

type ZakazkaDbRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  logistika_stav: string | null;
  zrusena: boolean | null;
};

export default async function DochazkaPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const highlightZakazkaId = isZakazkaId(resolvedSearchParams?.zakazka)
    ? resolvedSearchParams.zakazka
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select(
      "id, zakazka_id, datum_od, datum_do, typ_bloku, poznamka, confirmation_status"
    )
    .eq("user_id", user.id)
    .eq("confirmation_status", "accepted")
    .order("datum_od", { ascending: true, nullsFirst: false });

  if (assignmentsError) {
    return <div className="p-4 text-red-300">Chyba načtení docházky: {assignmentsError.message}</div>;
  }

  const acceptedDb = ((assignmentsRaw ?? []) as AssignmentDbRow[]).filter((row) =>
    isAcceptedAssignment(row.confirmation_status)
  );

  const assignmentIds = acceptedDb.map((row) => String(row.id));
  const activeByAssignment = new Map<string, string>();

  if (assignmentIds.length > 0) {
    const { data: activeAttendanceRaw, error: activeAttendanceError } = await supabase
      .from("dochazka_zakazky")
      .select("id, assignment_id")
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .in("assignment_id", assignmentIds)
      .neq("typ_faze", "preprava");

    if (activeAttendanceError) {
      return (
        <div className="p-4 text-red-300">Chyba načtení aktivní docházky: {activeAttendanceError.message}</div>
      );
    }

    for (const row of activeAttendanceRaw ?? []) {
      activeByAssignment.set(String(row.assignment_id), String(row.id));
    }
  }

  const acceptedAssignments: DochazkaAssignmentRow[] = acceptedDb.map((row) => ({
    id: String(row.id),
    zakazka_id: row.zakazka_id,
    datum_od: row.datum_od,
    datum_do: row.datum_do,
    typ_bloku: row.typ_bloku,
    poznamka: row.poznamka,
    active_attendance_id: activeByAssignment.get(String(row.id)) ?? null,
  }));

  const zakazkaIds = [...new Set(acceptedAssignments.map((row) => row.zakazka_id))];
  const zakazkyById = new Map<string, DochazkaZakazkaRow>();

  if (zakazkaIds.length > 0) {
    const { data: zakazkyRaw, error: zakazkyError } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, misto, logistika_stav, zrusena")
      .in("zakazka_id", zakazkaIds);

    if (zakazkyError) {
      return <div className="p-4 text-red-300">Chyba načtení zakázek: {zakazkyError.message}</div>;
    }

    for (const row of (zakazkyRaw ?? []) as ZakazkaDbRow[]) {
      zakazkyById.set(row.zakazka_id, {
        zakazka_id: row.zakazka_id,
        cislo_zakazky: row.cislo_zakazky,
        nazev: row.nazev,
        misto: row.misto,
        logistika_stav: row.logistika_stav,
        zrusena: row.zrusena === true,
      });
    }
  }

  const transportByZakazka: Record<string, { active: boolean; mode: "firemni" | "vlastni" | null }> =
    {};

  if (zakazkaIds.length > 0) {
    const { data: openTransportRaw, error: openTransportError } = await supabase
      .from("dochazka_zakazky")
      .select("zakazka_id, transport_vehicle_mode")
      .eq("user_id", user.id)
      .eq("typ_faze", "preprava")
      .is("checkout_at", null)
      .in("zakazka_id", zakazkaIds);

    if (openTransportError) {
      return <div className="p-4 text-red-300">Chyba načtení přepravy: {openTransportError.message}</div>;
    }

    for (const row of openTransportRaw ?? []) {
      transportByZakazka[String(row.zakazka_id)] = {
        active: true,
        mode: normalizeTransportVehicleMode(row.transport_vehicle_mode),
      };
    }
  }

  const { data: vehiclesRaw, error: vehiclesError } = await supabase
    .from("vozidla")
    .select("id, nazev, spz, typ, vlastnik_user_id")
    .eq("aktivni", true)
    .order("nazev");

  if (vehiclesError) {
    return <div className="p-4 text-red-300">Chyba načtení vozidel: {vehiclesError.message}</div>;
  }

  const { companyVehicles, privateVehicles } = splitTransportVehiclesForUser(
    (vehiclesRaw ?? []) as Array<{
      id: string;
      nazev: string;
      spz?: string | null;
      typ: string;
      vlastnik_user_id?: string | null;
    }>,
    user.id
  );

  const groups = buildDochazkaGroups(acceptedAssignments, zakazkyById);

  return (
    <div className="page-shell w-full">
      <DochazkaWorkClient
        groups={groups}
        transportByZakazka={transportByZakazka}
        companyVehicles={companyVehicles}
        privateVehicles={privateVehicles}
        highlightZakazkaId={highlightZakazkaId}
      />
    </div>
  );
}
