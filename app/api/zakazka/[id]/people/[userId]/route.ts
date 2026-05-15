import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    const { userId: assignmentId } = await params;
    const { supabase } = session;
    const body = await req.json();

    const result = await supabase
      .from("zakazka_lide")
      .update(body)
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