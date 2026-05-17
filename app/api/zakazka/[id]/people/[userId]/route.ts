import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { markZakazkaCriticalChangeIfApproved } from "@/lib/zakazka-critical-changes";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

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

function normalizeStatus(value: unknown) {
  const text = String(value ?? "").trim();
  if (text === "pending" || text === "accepted" || text === "declined") return text;
  return "pending";
}

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getStatusTitle(value: string | null) {
  if (value === "accepted") return "Účast potvrzena.";
  if (value === "declined") return "Účast odmítnuta.";
  if (value === "pending") return "Stav účasti nastaven na čeká.";
  return "Přiřazení upraveno.";
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    // TODO(people-api): Parametr userId je z historických důvodů ve skutečnosti assignment id.
    const { userId: assignmentId } = await params;
    const { supabase } = session;
    const body = await req.json();
    const datumOd = normalizeOptionalDateTime(body.datum_od);
    const datumDo = normalizeOptionalDateTime(body.datum_do);
    const hasConfirmationStatus = Object.prototype.hasOwnProperty.call(
      body,
      "confirmation_status"
    );
    const confirmationStatus = hasConfirmationStatus
      ? normalizeStatus(body.confirmation_status)
      : null;
    const declinedReason =
      confirmationStatus === "declined" ? normalizeOptionalText(body.declined_reason) : null;
    const overrideReason = normalizeOptionalText(body.people_conflict_override_reason);

    if (hasInvalidRange(datumOd, datumDo)) {
      return NextResponse.json(
        { error: "Začátek přiřazení musí být dřív než konec." },
        { status: 400 }
      );
    }

    const { data: currentAssignment, error: currentError } = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, user_id, datum_od, datum_do, typ_bloku")
      .eq("id", assignmentId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }
    if (!currentAssignment) {
      return NextResponse.json({ error: "Přiřazení nebylo nalezeno." }, { status: 404 });
    }

    const { data: currentZakazka, error: currentZakazkaError } = await supabase
      .from("zakazky")
      .select("zrusena, workflow_stav")
      .eq("zakazka_id", currentAssignment.zakazka_id)
      .maybeSingle();

    if (currentZakazkaError) {
      return NextResponse.json({ error: currentZakazkaError.message }, { status: 500 });
    }
    if (currentZakazka?.zrusena || currentZakazka?.workflow_stav === "zruseno") {
      return NextResponse.json(
        { error: "Lidi na zrušené zakázce už nelze měnit." },
        { status: 400 }
      );
    }

    const nextFrom = datumOd ?? null;
    const nextTo = datumDo ?? null;
    const { data: sameUserAssignments, error: sameUserError } = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, user_id, datum_od, datum_do, typ_bloku")
      .eq("user_id", currentAssignment.user_id)
      .neq("id", assignmentId);

    if (sameUserError) {
      return NextResponse.json({ error: sameUserError.message }, { status: 500 });
    }

    const sameUserRows = (sameUserAssignments ?? []) as Array<{
      zakazka_id?: string | null;
      datum_od?: string | null;
      datum_do?: string | null;
    }>;
    const sameUserZakazkaIds = Array.from(
      new Set(sameUserRows.map((row) => row.zakazka_id).filter(Boolean) as string[])
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
      .filter((row) => !row.zakazka_id || !cancelledZakazkaIds.has(row.zakazka_id))
      .some((row) => rangesOverlap(nextFrom, nextTo, row.datum_od, row.datum_do));

    if (hasConflict && !overrideReason) {
      return NextResponse.json(
        { error: "U kolize lidí je povinné vyplnit důvod override." },
        { status: 400 }
      );
    }

    const result = await supabase
      .from("zakazka_lide")
      .update({
        datum_od: datumOd,
        datum_do: datumDo,
        poznamka: normalizeOptionalText(body.poznamka),
        ...(hasConfirmationStatus
          ? {
              confirmation_status: confirmationStatus,
              declined_reason: declinedReason,
              responded_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", assignmentId)
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    await logZakazkaHistory(supabase, {
      zakazkaId: result.data.zakazka_id,
      eventType: hasConfirmationStatus ? `person_${confirmationStatus}` : "person_updated",
      actorId: session.user.id,
      title: getStatusTitle(confirmationStatus),
      detail: declinedReason ? `Důvod: ${declinedReason}` : null,
      metadata: {
        assignment_id: result.data.id,
        target_user_id: result.data.user_id,
        typ_bloku: result.data.typ_bloku,
        datum_od: result.data.datum_od,
        datum_do: result.data.datum_do,
        confirmation_status: result.data.confirmation_status,
        people_conflict_override_reason: hasConflict ? overrideReason : null,
      },
    });

    if (hasConflict) {
      await logZakazkaHistory(supabase, {
        zakazkaId: result.data.zakazka_id,
        eventType: "people_conflict_override",
        actorId: session.user.id,
        title: "Kolize lidí byla povolena přes override.",
        detail: overrideReason,
        metadata: {
          assignment_id: result.data.id,
          target_user_id: result.data.user_id,
          typ_bloku: result.data.typ_bloku,
          datum_od: result.data.datum_od,
          datum_do: result.data.datum_do,
        },
      });
    }

    const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
      zakazkaId: result.data.zakazka_id,
      actorId: session.user.id,
      changes: ["lide"],
      detail: "Změněno pokrytí práce po klientském schválení.",
      metadata: {
        assignment_id: result.data.id,
        target_user_id: result.data.user_id,
        typ_bloku: result.data.typ_bloku,
        conflict_override_reason: hasConflict ? overrideReason : null,
      },
    });
    if (!changeResult.ok) {
      return NextResponse.json({ error: changeResult.error }, { status: 500 });
    }

    revalidatePath(`/zakazky/${result.data.zakazka_id}`);
    revalidatePath("/zakazky");
    revalidatePath("/moje");
    revalidatePath(`/moje/zakazky/${result.data.zakazka_id}`);

    return NextResponse.json(result.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    // TODO(people-api): Parametr userId je z historických důvodů ve skutečnosti assignment id.
    const { userId: assignmentId } = await params;
    const { supabase } = session;

    const { data: assignmentBeforeDelete, error: loadError } = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, user_id, typ_bloku, datum_od, datum_do")
      .eq("id", assignmentId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (assignmentBeforeDelete) {
      const { data: currentZakazka, error: currentZakazkaError } = await supabase
        .from("zakazky")
        .select("zrusena, workflow_stav")
        .eq("zakazka_id", assignmentBeforeDelete.zakazka_id)
        .maybeSingle();

      if (currentZakazkaError) {
        return NextResponse.json({ error: currentZakazkaError.message }, { status: 500 });
      }
      if (currentZakazka?.zrusena || currentZakazka?.workflow_stav === "zruseno") {
        return NextResponse.json(
          { error: "Lidi na zrušené zakázce už nelze měnit." },
          { status: 400 }
        );
      }
    }

    const result = await supabase
      .from("zakazka_lide")
      .delete()
      .eq("id", assignmentId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    if (assignmentBeforeDelete) {
      await logZakazkaHistory(supabase, {
        zakazkaId: assignmentBeforeDelete.zakazka_id,
        eventType: "person_removed",
        actorId: session.user.id,
        title: "Odebrán člověk z pokrytí práce.",
        detail: null,
        metadata: {
          assignment_id: assignmentBeforeDelete.id,
          target_user_id: assignmentBeforeDelete.user_id,
          typ_bloku: assignmentBeforeDelete.typ_bloku,
          datum_od: assignmentBeforeDelete.datum_od,
          datum_do: assignmentBeforeDelete.datum_do,
        },
      });

      const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
        zakazkaId: assignmentBeforeDelete.zakazka_id,
        actorId: session.user.id,
        changes: ["lide"],
        detail: "Odebráno pokrytí práce po klientském schválení.",
        metadata: {
          assignment_id: assignmentBeforeDelete.id,
          target_user_id: assignmentBeforeDelete.user_id,
          typ_bloku: assignmentBeforeDelete.typ_bloku,
        },
      });
      if (!changeResult.ok) {
        return NextResponse.json({ error: changeResult.error }, { status: 500 });
      }

      revalidatePath(`/zakazky/${assignmentBeforeDelete.zakazka_id}`);
      revalidatePath("/zakazky");
      revalidatePath("/moje");
      revalidatePath(`/moje/zakazky/${assignmentBeforeDelete.zakazka_id}`);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}