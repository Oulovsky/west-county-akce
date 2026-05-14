"use client";

import { useEffect, useMemo, useState } from "react";
import { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

type AuditLogItem = {
  id: number;
  created_at: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  meta: any;
};

function getActionLabel(action: string) {
  if (action === "whitelist_email_added") return "Přidán email do whitelistu";
  if (action === "whitelist_email_deleted") return "Odebrán email z whitelistu";
  if (action === "user_role_updated") return "Změněna role u uživatele";
  return action;
}

function getActionStyle(action: string) {
  if (action.includes("added")) return "bg-green-950/40 border-green-700 text-green-200";
  if (action.includes("deleted")) return "bg-red-950/40 border-red-700 text-red-200";
  if (action.includes("updated")) return "bg-blue-950/40 border-blue-700 text-blue-200";
  return "bg-slate-900 border-slate-700 text-slate-200";
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleString("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AuditLog({ logs: initialLogs }: { logs: AuditLogItem[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel("admin-audit-log")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_audit_log",
        },
        (payload: RealtimePostgresInsertPayload<AuditLogItem>) => {
          setLogs((prev) => [payload.new as AuditLogItem, ...prev]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const a = !actionFilter || log.action === actionFilter;

      const u =
        !userFilter ||
        (log.actor_email || log.actor_user_id || "")
          .toLowerCase()
          .includes(userFilter.toLowerCase());

      const t =
        !targetFilter ||
        (log.target_label || log.target_id || "")
          .toLowerCase()
          .includes(targetFilter.toLowerCase());

      return a && u && t;
    });
  }, [logs, actionFilter, userFilter, targetFilter]);

  return (
    <div className="space-y-4 text-slate-200">
      <div className="grid gap-2 md:grid-cols-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-[#334155] bg-[#081225] px-3 py-2 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Všechny akce</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {getActionLabel(a)}
            </option>
          ))}
        </select>

        <input
          placeholder="Filtrovat podle uživatele"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-lg border border-[#334155] bg-[#081225] px-3 py-2 text-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="Filtrovat podle cíle"
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="rounded-lg border border-[#334155] bg-[#081225] px-3 py-2 text-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="text-sm text-slate-400">
        Zobrazeno: {filteredLogs.length} / {logs.length}
      </div>

      <div className="space-y-2">
        {filteredLogs.map((log) => {
          const style = getActionStyle(log.action);

          return (
            <div
              key={log.id}
              className={`rounded-xl border p-3 text-sm transition ${style}`}
            >
              <div className="mb-2 flex justify-between gap-4">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold">
                  {getActionLabel(log.action)}
                </span>

                <span className="text-xs opacity-70">
                  {formatDate(log.created_at)}
                </span>
              </div>

              <div>
                <strong>Uživatel:</strong>{" "}
                <span className="font-mono">
                  {log.actor_email || log.actor_user_id}
                </span>
              </div>

              <div>
                <strong>Cíl:</strong>{" "}
                <span className="font-mono">
                  {log.target_label || "-"}
                </span>
              </div>

              {log.meta?.old_role && (
                <div>
                  <strong>Změna:</strong> {log.meta.old_role} → {log.meta.new_role}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}