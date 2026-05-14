import { createClient } from "@/lib/supabase/server";
import { getWhitelist } from "./whitelist/actions";
import { getUsers } from "./users/actions";
import { getAdminAuditLog } from "./audit/actions";

import WhitelistClient from "./WhitelistClient";
import UsersClient from "./UsersClient";
import AuditLog from "./AuditLog";

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

  const whitelist = await getWhitelist();
  const users = await getUsers();
  const auditLogs = await getAdminAuditLog();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      <h1 className="text-3xl font-bold text-white">Admin panel</h1>

      <div className="bg-[#0b1324] border border-[#334155] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-white">Whitelist</h2>
        <WhitelistClient whitelist={whitelist} />
      </div>

      <div className="bg-[#0b1324] border border-[#334155] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-white">Uživatelé</h2>
        <UsersClient users={users} />
      </div>

      <div className="bg-[#0b1324] border border-[#334155] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-white">Audit log</h2>
        <AuditLog logs={auditLogs} />
      </div>
    </div>
  );
}
