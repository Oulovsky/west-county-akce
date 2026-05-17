import type React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsers } from "./users/actions";
import { getAdminAuditLog } from "./audit/actions";
import { getFakturacniFirmy } from "./fakturacni-firmy/actions";

import UsersClient from "./UsersClient";
import AuditLog from "./AuditLog";
import FakturacniFirmyClient from "./FakturacniFirmyClient";

function AdminSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-[#334155] bg-[#0b1324] shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-semibold text-white outline-none transition hover:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/60">
        <span>{title}</span>
        <span className="text-sm text-slate-400 transition group-open:rotate-180">v</span>
      </summary>
      <div className="border-t border-slate-800 p-5">{children}</div>
    </details>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Admin</h1>
        <p className="mt-4 text-red-400">Unauthorized</p>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Admin</h1>
        <p className="mt-4 text-red-400">{profileError.message}</p>
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Admin</h1>
        <p className="mt-4 text-red-400">Forbidden</p>
      </div>
    );
  }

  const users = await getUsers();
  const fakturacniFirmy = await getFakturacniFirmy();
  const auditLogs = await getAdminAuditLog();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 text-slate-200">
      <h1 className="text-3xl font-bold text-white">Admin panel</h1>

      <AdminSection title="Zaměstnanci">
        <UsersClient users={users} />
      </AdminSection>

      <AdminSection title="Proplacení práce">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Přehled uznaných hodin, QR platby a označení práce jako proplacené.
          </p>
          <Link
            href="/admin/proplaceni"
            className="inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-600/30"
          >
            Otevřít proplacení práce
          </Link>
        </div>
      </AdminSection>

      <AdminSection title="Vozidla">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Evidence firemních a soukromých aut pro plán dopravy, kapacity a dostupnost v čase.
          </p>
          <Link
            href="/admin/vozidla"
            className="inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-600/30"
          >
            Otevřít vozidla
          </Link>
        </div>
      </AdminSection>

      <AdminSection title="Fakturační firmy">
        <FakturacniFirmyClient firmy={fakturacniFirmy} />
      </AdminSection>

      <AdminSection title="Audit log">
        <AuditLog logs={auditLogs} />
      </AdminSection>
    </div>
  );
}
