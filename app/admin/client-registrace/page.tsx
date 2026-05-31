import Link from "next/link";
import { verifyAppAdminOrSefPage } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import ClientRegistrationsClient from "./ClientRegistrationsClient";

export default async function AdminClientRegistracePage() {
  const supabase = await createClient();
  const access = await verifyAppAdminOrSefPage(supabase);

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Přehled registrací klientů</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("client_registrations")
    .select(
      "registration_id, user_id, navrh_ico, navrh_nazev_firmy, ares_snapshot, stav, klient_id, schvaleno_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Přehled registrací klientů</h1>
        <p className="mt-4 text-red-400">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Přehled registrací klientů</h1>
          <p className="mt-2 text-sm text-slate-400">
            Auditní log registrací z klientského portálu. Účty se aktivují automaticky —
            schvalování probíhá až u konkrétních poptávek.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-blue-300 hover:text-blue-200">
          ← Admin
        </Link>
      </div>

      <ClientRegistrationsClient registrations={data ?? []} />
    </div>
  );
}
