import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";

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
    const otherZakazkyById = new Map<string, { zakazka_id: string; nazev: string | null }>();

    if (otherZakazkaIds.length > 0) {
      const { data: otherZakazky, error: otherZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, nazev")
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

    return NextResponse.json({
      assignments: assignmentsResult.data ?? [],
      currentZakazka: zakazkaResult.data ?? null,
      other: otherRows.map((row) => ({
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

    const insertResult = await supabase
      .from("zakazka_lide")
      .insert({
        zakazka_id: zakazkaId,
        user_id: userId,
        datum_od: requestedFrom ?? defaultRange.datum_od,
        datum_do: requestedTo ?? defaultRange.datum_do,
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
        datum_od: requestedFrom ?? defaultRange.datum_od,
        datum_do: requestedTo ?? defaultRange.datum_do,
      },
    });

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