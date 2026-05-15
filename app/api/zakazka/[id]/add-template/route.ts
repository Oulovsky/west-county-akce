import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy add-template API is disabled. This endpoint used the old zakazka_items model and must be replaced before use.",
    },
    { status: 410 }
  );
}