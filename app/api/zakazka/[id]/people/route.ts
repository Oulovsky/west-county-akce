import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

function normalizeTypBloku(value: unknown): TypBloku {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sklad") return "sklad";
  if (raw === "stavba") return "stavba";
  if (raw === "bourani") return "bourani";

  return "akce";
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
    const { id: zakazkaId } = await params;
    const supabase = await createClient();

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
      .select("*")
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

    return NextResponse.json({
      assignments: assignmentsResult.data ?? [],
      currentZakazka: zakazkaResult.data ?? null,
      other: otherResult.data ?? [],
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
    const { id: zakazkaId } = await params;
    const supabase = await createClient();
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
        datum_od: defaultRange.datum_od,
        datum_do: defaultRange.datum_do,
        role_na_zakazce: "technik",
        typ_bloku: typBloku,
      })
      .select("*")
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(insertResult.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}