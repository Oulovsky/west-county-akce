import { NextResponse } from "next/server";
import { getTechnikaAvailability } from "@/lib/technika-availability";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const availability = await getTechnikaAvailability({
      supabase,
      zakazkaId: typeof body?.zakazkaId === "string" ? body.zakazkaId : null,
      from: typeof body?.from === "string" ? body.from : null,
      to: typeof body?.to === "string" ? body.to : null,
      items: Array.isArray(body?.items) ? body.items : [],
    });

    return NextResponse.json(availability);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dostupnost techniky se nepodařilo spočítat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
