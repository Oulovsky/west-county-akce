import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { CLIENT_POPTAVKA_STAV_LABELS } from "@/lib/client-portal/labels";
import { formatPoptavkaDateRange } from "@/lib/client-portal/poptavka-form";
import { loadClientPoptavkyList } from "@/lib/client-portal/poptavka-server";
import { createClient } from "@/lib/supabase/server";

export default async function PortalPoptavkyPage() {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni?next=/portal/poptavky");
  }

  const poptavky = await loadClientPoptavkyList(supabase);

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Moje poptávky">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Přehled vašich poptávek ve stavu konceptu i odeslaných.
          </p>
          <Link
            href="/portal/poptavka/nova"
            className="inline-flex rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
          >
            Nová poptávka
          </Link>
        </div>

        {poptavky.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            Zatím nemáte žádnou poptávku. Vytvořte první koncept tlačítkem výše.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {poptavky.map((row) => {
              const title = row.misto_nazev || row.misto_adresa || "Bez názvu";
              const subtitle = [row.misto_adresa, formatPoptavkaDateRange(row.datum_od, row.datum_do)]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={row.poptavka_id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-amber-500/30 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/portal/poptavka/${row.poptavka_id}`}
                        className="font-semibold text-white hover:text-amber-100"
                      >
                        {title}
                      </Link>
                      <div className="mt-1 text-sm text-slate-400">{subtitle || "—"}</div>
                      <div className="mt-2 text-xs text-slate-500">{row.cislo_poptavky}</div>
                      {row.zakazka_id ? (
                        <Link
                          href={`/portal/zakazky/${row.zakazka_id}`}
                          className="mt-2 inline-flex text-xs font-semibold text-blue-300 hover:text-blue-200"
                        >
                          Zobrazit zakázku →
                        </Link>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                      {CLIENT_POPTAVKA_STAV_LABELS[row.stav]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
    </PortalShell>
  );
}
