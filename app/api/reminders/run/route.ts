import { NextResponse } from "next/server";
import { runReminderEngine } from "@/lib/reminder-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.REMINDER_ENGINE_SECRET?.trim();
  if (!configuredSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";

  return bearerToken === configuredSecret || querySecret === configuredSecret;
}

async function handleRun(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Reminder engine není autorizovaný. Nastavte REMINDER_ENGINE_SECRET a pošlete ho jako Bearer token." },
      { status: 401 }
    );
  }

  const result = await runReminderEngine(createAdminClient());
  return NextResponse.json({ ok: true, result });
}

export async function POST(request: Request) {
  return handleRun(request);
}

export async function GET(request: Request) {
  return handleRun(request);
}
