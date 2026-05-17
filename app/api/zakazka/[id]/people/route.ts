import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { markZakazkaCriticalChangeIfApproved } from "@/lib/zakazka-critical-changes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ZakazkaRow = {
  zakazka_id: string;
  datum_od?: string | null;
  datum_do?: string | null;
  cas_od?: string | null;
  cas_do?: string | null;
  odjezd_ze_skladu?: string | null;
  sraz_na_miste?: string | null;
  stavba_od?: string | null;
  stavba_do?: string | null;
  akce_od?: string | null;
  akce_do?: string | null;
  bourani_od?: string | null;
  bourani_do?: string | null;
  nazev?: string | null;
  typ_obsluhy?: string | null;
};

type TypBloku = "sklad" | "stavba" | "akce" | "bourani";

type AssignmentRow = {
  id: string | number;
  zakazka_id: string;
  user_id: string;
  datum_od?: string | null;
  datum_do?: string | null;
  typ_bloku?: string | null;
  created_at?: string | null;
};

function normalizeTypBloku(value: unknown): TypBloku {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sklad") return "sklad";
  if (raw === "stavba") return "stavba";
  if (raw === "bourani") return "bourani";

  return "akce";
}

function getTypBlokuLabel(value: TypBloku) {
  if (value === "sklad") return "Nakládka";
  if (value === "stavba") return "Stavba";
  if (value === "bourani") return "Bourání";
  return "Provoz akce";
}

function getDefaultRangeForBlok(zakazka: ZakazkaRow, typBloku: TypBloku) {
  if (typBloku === "sklad") {
    return {
      datum_od: zakazka.odjezd_ze_skladu ?? null,
      datum_do: zakazka.sraz_na_miste ?? null,
    };
  }

  if (typBloku === "stavba") {
    return {
      datum_od: zakazka.stavba_od ?? null,
      datum_do: zakazka.stavba_do ?? null,
    };
  }

  if (typBloku === "bourani") {
    return {
      datum_od: zakazka.bourani_od ?? null,
      datum_do: zakazka.bourani_do ?? null,
    };
  }

  return {
    datum_od: zakazka.akce_od ?? null,
    datum_do: zakazka.akce_do ?? null,
  };
}

function normalizeOptionalDateTime(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function hasInvalidRange(from?: string | null, to?: string | null) {
  if (!from || !to) return false;

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return true;

  return fromTime >= toTime;
}

function rangesOverlap(fromA?: string | null, toA?: string | null, fromB?: string | null, toB?: string | null) {
  if (!fromA || !toA || !fromB || !toB) return false;
  const aStart = new Date(fromA).getTime();
  const aEnd = new Date(toA).getTime();
  const bStart = new Date(fromB).getTime();
  const bEnd = new Date(toB).getTime();
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart < bEnd && aEnd > bStart;
}

function minutesBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return 0;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function normalizeOverrideReason(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function loadZakazkaByEitherKey(
  supabase: SupabaseServerClient,
  zakazkaId: string
) {
  const byZakazkaId = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (byZakazkaId.data) {
    return { data: byZakazkaId.data as ZakazkaRow, error: byZakazkaId.error };
  }

  const byId = await supabase
    .from("zakazky")
    .select("*")
    .eq("id", zakazkaId)
    .maybeSingle();

  return { data: (byId.data as ZakazkaRow | null) ?? null, error: byId.error };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    const { id: zakazkaId } = await params;
    const { supabase } = session;

    const assignmentsResult = await supabase
      .from("zakazka_lide")
      .select("*")
      .eq("zakazka_id", zakazkaId)
      .order("typ_bloku", { ascending: true })
      .order("created_at", { ascending: true });

    if (assignmentsResult.error) {
      return NextResponse.json(
        {
          error: assignmentsResult.error.message,
          assignments: [],
          currentZakazka: null,
          other: [],
        },
        { status: 500 }
      );
    }

    const zakazkaResult = await loadZakazkaByEitherKey(supabase, zakazkaId);

    if (zakazkaResult.error) {
      return NextResponse.json(
        {
          error: zakazkaResult.error.message,
          assignments: assignmentsResult.data ?? [],
          currentZakazka: null,
          other: [],
        },
        { status: 500 }
      );
    }

    const otherResult = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, user_id, datum_od, datum_do, typ_bloku, created_at")
      .neq("zakazka_id", zakazkaId);

    if (otherResult.error) {
      return NextResponse.json(
        {
          error: otherResult.error.message,
          assignments: assignmentsResult.data ?? [],
          currentZakazka: zakazkaResult.data ?? null,
          other: [],
        },
        { status: 500 }
      );
    }

    const otherRows = ((otherResult.data ?? []) as AssignmentRow[]).filter(
      (row) => row.zakazka_id
    );
    const otherZakazkaIds = [...new Set(otherRows.map((row) => row.zakazka_id))];
    const otherZakazkyById = new Map<
      string,
      { zakazka_id: string; nazev: string | null; zrusena?: boolean | null }
    >();

    if (otherZakazkaIds.length > 0) {
      const { data: otherZakazky, error: otherZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, nazev, zrusena")
        .in("zakazka_id", otherZakazkaIds);

      if (otherZakazkyError) {
        return NextResponse.json(
          {
            error: otherZakazkyError.message,
            assignments: assignmentsResult.data ?? [],
            currentZakazka: zakazkaResult.data ?? null,
            other: [],
          },
          { status: 500 }
        );
      }

      for (const zakazka of otherZakazky ?? []) {
        otherZakazkyById.set(zakazka.zakazka_id, zakazka);
      }
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const assignmentIds = assignments.map((assignment) => String(assignment.id));
    const attendanceByAssignment = new Map<string, any[]>();

    if (assignmentIds.length > 0) {
      const { data: attendanceRows, error: attendanceError } = await supabase
        .from("dochazka_zakazky")
        .select("id, assignment_id, user_id, typ_faze, checkin_at, checkout_at, gps_checkin_lat, gps_checkin_lng, gps_checkout_lat, gps_checkout_lng, gps_accuracy, gps_checkout_accuracy, manual_override, override_reason, approved_by, approved_at")
        .eq("zakazka_id", zakazkaId)
        .in("assignment_id", assignmentIds)
        .order("checkin_at", { ascending: false });

      if (attendanceError) {
        return NextResponse.json(
          {
            error: attendanceError.message,
            assignments,
            currentZakazka: zakazkaResult.data ?? null,
            other: [],
          },
          { status: 500 }
        );
      }

      for (const row of attendanceRows ?? []) {
        const key = String(row.assignment_id);
        const rows = attendanceByAssignment.get(key) ?? [];
        rows.push(row);
        attendanceByAssignment.set(key, rows);
      }
    }

    const assignmentsWithAttendance = assignments.map((assignment) => {
      const rows = attendanceByAssignment.get(String(assignment.id)) ?? [];
      return {
        ...assignment,
        attendance_rows: rows,
        attendance_actual_minutes: rows.reduce(
          (sum, row) => sum + minutesBetween(row.checkin_at, row.checkout_at),
          0
        ),
        attendance_planned_minutes: minutesBetween(assignment.datum_od, assignment.datum_do),
        attendance_active: rows.some((row) => !row.checkout_at),
      };
    });

    return NextResponse.json({
      assignments: assignmentsWithAttendance,
      currentZakazka: zakazkaResult.data ?? null,
      other: otherRows
        .filter((row) => !otherZakazkyById.get(row.zakazka_id)?.zrusena)
        .map((row) => ({
          ...row,
          zakazky: otherZakazkyById.get(row.zakazka_id) ?? null,
        })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    return NextResponse.json(
      {
        error: message,
        assignments: [],
        currentZakazka: null,
        other: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    const { id: zakazkaId } = await params;
    const { supabase } = session;
    const body = await req.json();

    const userId = String(body.user_id ?? "").trim();
    const typBloku = normalizeTypBloku(body.typ_bloku);

    if (!userId) {
      return NextResponse.json(
        { error: "Chybí user_id." },
        { status: 400 }
      );
    }

    const zakazkaResult = await loadZakazkaByEitherKey(supabase, zakazkaId);

    if (zakazkaResult.error) {
      return NextResponse.json(
        { error: zakazkaResult.error.message },
        { status: 500 }
      );
    }

    if (!zakazkaResult.data) {
      return NextResponse.json(
        { error: "Zakázka nebyla nalezena." },
        { status: 404 }
      );
    }

    if (zakazkaResult.data.zrusena || zakazkaResult.data.workflow_stav === "zruseno") {
      return NextResponse.json(
        { error: "Lidi na zrušené zakázce už nelze měnit." },
        { status: 400 }
      );
    }

    if (
      String(zakazkaResult.data.typ_obsluhy ?? "").trim() === "bez_obsluhy" &&
      typBloku === "akce"
    ) {
      return NextResponse.json(
        { error: "U zakázky bez obsluhy nelze přiřazovat lidi do bloku Akce." },
        { status: 400 }
      );
    }

    const requestedFrom = normalizeOptionalDateTime(body.datum_od);
    const requestedTo = normalizeOptionalDateTime(body.datum_do);

    if (hasInvalidRange(requestedFrom, requestedTo)) {
      return NextResponse.json(
        { error: "Začátek přiřazení musí být dřív než konec." },
        { status: 400 }
      );
    }

    const existingResult = await supabase
      .from("zakazka_lide")
      .select("*")
      .eq("zakazka_id", zakazkaId)
      .eq("user_id", userId)
      .eq("typ_bloku", typBloku)
      .maybeSingle();

    if (existingResult.error) {
      return NextResponse.json(
        { error: existingResult.error.message },
        { status: 500 }
      );
    }

    if (existingResult.data) {
      return NextResponse.json(existingResult.data);
    }

    const defaultRange = getDefaultRangeForBlok(zakazkaResult.data, typBloku);
    const finalFrom = requestedFrom ?? defaultRange.datum_od;
    const finalTo = requestedTo ?? defaultRange.datum_do;
    const overrideReason = normalizeOverrideReason(body.people_conflict_override_reason);
    const { data: sameUserAssignments, error: sameUserError } = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, user_id, datum_od, datum_do, typ_bloku")
      .eq("user_id", userId)
      .neq("zakazka_id", zakazkaId);

    if (sameUserError) {
      return NextResponse.json({ error: sameUserError.message }, { status: 500 });
    }

    const sameUserRows = (sameUserAssignments ?? []) as AssignmentRow[];
    const sameUserZakazkaIds = Array.from(
      new Set(sameUserRows.map((row) => row.zakazka_id).filter(Boolean))
    );
    const cancelledZakazkaIds = new Set<string>();

    if (sameUserZakazkaIds.length > 0) {
      const { data: sameUserZakazky, error: sameUserZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, zrusena")
        .in("zakazka_id", sameUserZakazkaIds);

      if (sameUserZakazkyError) {
        return NextResponse.json({ error: sameUserZakazkyError.message }, { status: 500 });
      }

      for (const row of sameUserZakazky ?? []) {
        if (row.zrusena) cancelledZakazkaIds.add(row.zakazka_id);
      }
    }

    const hasConflict = sameUserRows
      .filter((row) => !cancelledZakazkaIds.has(row.zakazka_id))
      .some((row) => rangesOverlap(finalFrom, finalTo, row.datum_od, row.datum_do));

    if (hasConflict && !overrideReason) {
      return NextResponse.json(
        { error: "U kolize lidí je povinné vyplnit důvod override." },
        { status: 400 }
      );
    }

    const insertResult = await supabase
      .from("zakazka_lide")
      .insert({
        zakazka_id: zakazkaId,
        user_id: userId,
        datum_od: finalFrom,
        datum_do: finalTo,
        role_na_zakazce: "technik",
        typ_bloku: typBloku,
        poznamka: null,
        confirmation_status: "pending",
        declined_reason: null,
        responded_at: null,
      })
      .select("*")
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "person_added",
      actorId: session.user.id,
      title: `Přidán člověk do fáze ${getTypBlokuLabel(typBloku)}.`,
      detail: null,
      metadata: {
        assignment_id: insertResult.data.id,
        target_user_id: userId,
        typ_bloku: typBloku,
        datum_od: finalFrom,
        datum_do: finalTo,
        people_conflict_override_reason: hasConflict ? overrideReason : null,
      },
    });

    if (hasConflict) {
      await logZakazkaHistory(supabase, {
        zakazkaId,
        eventType: "people_conflict_override",
        actorId: session.user.id,
        title: "Kolize lidí byla povolena přes override.",
        detail: overrideReason,
        metadata: {
          assignment_id: insertResult.data.id,
          target_user_id: userId,
          typ_bloku: typBloku,
          datum_od: finalFrom,
          datum_do: finalTo,
        },
      });
    }

    const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
      zakazkaId,
      actorId: session.user.id,
      changes: ["lide"],
      detail: "Změněno pokrytí práce po klientském schválení.",
      metadata: {
        assignment_id: insertResult.data.id,
        target_user_id: userId,
        typ_bloku: typBloku,
        conflict_override_reason: hasConflict ? overrideReason : null,
      },
    });
    if (!changeResult.ok) {
      return NextResponse.json({ error: changeResult.error }, { status: 500 });
    }

    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
    revalidatePath("/moje");
    revalidatePath(`/moje/zakazky/${zakazkaId}`);

    return NextResponse.json(insertResult.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}