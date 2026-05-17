import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

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

    if (hasInvalidRange(datumOd, datumDo)) {
      return NextResponse.json(
        { error: "Začátek přiřazení musí být dřív než konec." },
        { status: 400 }
      );
    }

    const result = await supabase
      .from("zakazka_lide")
      .update({
        datum_od: datumOd,
        datum_do: datumDo,
      })
      .eq("id", assignmentId)
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

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

    const result = await supabase
      .from("zakazka_lide")
      .delete()
      .eq("id", assignmentId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}