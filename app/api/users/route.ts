import { requireSession } from "@/lib/auth/require-session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    const { supabase } = session;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, role, jmeno, prijmeni, hodinovy_naklad_akce")
      .eq("aktivni", true)
      .order("prijmeni", { ascending: true })
      .order("jmeno", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data ?? []).map((u) => ({
      user_id: u.user_id,
      role: u.role,
      hodinovy_naklad_akce: u.hodinovy_naklad_akce,
      user_name:
        [u.prijmeni, u.jmeno].filter(Boolean).join(" ").trim() ||
        u.email ||
        "Bez jména",
    }));

    return NextResponse.json(users);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}