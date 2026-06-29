import { NextResponse } from "next/server";
import { loadPoptavkaFotkaOriginalSignedUrlForClient } from "@/lib/client-portal/poptavka-fotky-server";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const poptavkaId = url.searchParams.get("poptavka_id")?.trim() ?? "";
  const fotkaId = url.searchParams.get("fotka_id")?.trim() ?? "";

  if (!poptavkaId || !fotkaId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    await requireActiveClientPortalSession(supabase);
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const signedUrl = await loadPoptavkaFotkaOriginalSignedUrlForClient(
      supabase,
      poptavkaId,
      fotkaId
    );
    if (!signedUrl) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, signedUrl });
  } catch (error) {
    console.error("[poptavka fotky] original url failed", {
      poptavkaId,
      fotkaId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }
}
