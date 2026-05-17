import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  getNotificationPriorityClass,
  getNotificationPriorityLabel,
} from "@/lib/notifications";
import {
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

type PageProps = {
  searchParams?: Promise<{ filtr?: string }>;
};

type FilterMode = "vse" | "neprectene" | "warning" | "critical";

type NotificationRow = {
  id: string;
  typ: string;
  priorita: string;
  titulek: string;
  zprava: string;
  akce_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

function normalizeFilter(value?: string | null): FilterMode {
  if (value === "neprectene" || value === "warning" || value === "critical") return value;
  return "vse";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filter = normalizeFilter(resolvedSearchParams?.filtr);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let query = supabase
    .from("notifikace")
    .select("id, typ, priorita, titulek, zprava, akce_url, read_at, dismissed_at, created_at")
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter === "neprectene") query = query.is("read_at", null);
  if (filter === "warning" || filter === "critical") query = query.eq("priorita", filter);

  const { data, error } = await query;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-red-300">
        Notifikace se nepodařilo načíst. Pokud tabulka neexistuje, spusťte migrace přes `npx supabase db push`.
        <div className="mt-2 text-sm">{error.message}</div>
      </div>
    );
  }

  const rows = (data ?? []) as NotificationRow[];
  const filters: Array<{ key: FilterMode; label: string; href: string }> = [
    { key: "vse", label: "Vše", href: "/notifikace" },
    { key: "neprectene", label: "Nepřečtené", href: "/notifikace?filtr=neprectene" },
    { key: "warning", label: "Warning", href: "/notifikace?filtr=warning" },
    { key: "critical", label: "Critical", href: "/notifikace?filtr=critical" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6 text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Notifikace</h1>
          <p className="mt-2 text-sm text-slate-400">
            Interní provozní upozornění. Ne push provider, jen přehled věcí, které vyžadují pozornost.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <button className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-800">
            Označit vše přečtené
          </button>
        </form>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition",
              filter === item.key
                ? "border-blue-400 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné notifikace pro tento filtr.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const unread = !row.read_at;
            return (
              <Card
                key={row.id}
                className={[
                  "space-y-3 border",
                  getNotificationPriorityClass(row.priorita),
                  unread ? "shadow-lg shadow-slate-950/30" : "opacity-75",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white">{row.titulek}</h2>
                      {unread ? <Badge variant="warning">Nepřečtené</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-200">{row.zprava}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {getNotificationPriorityLabel(row.priorita)} · {formatDateTime(row.created_at)} · {row.typ}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.akce_url ? (
                    <Link
                      href={row.akce_url}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600"
                    >
                      Otevřít
                    </Link>
                  ) : null}
                  {unread ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800">
                        Přečteno
                      </button>
                    </form>
                  ) : null}
                  <form action={dismissNotificationAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800">
                      Skrýt
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
