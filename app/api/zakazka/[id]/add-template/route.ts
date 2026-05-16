import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

export async function POST() {
  const session = await requireSession();
  if (!session.ok) return session.response;

  return NextResponse.json(
    {
      error:
        "Legacy add-template API is disabled. This endpoint used the old zakazka_items model and must be replaced before use.",
    },
    { status: 410 }
  );
}