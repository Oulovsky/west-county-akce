import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  formatClientZakazkaStatus,
  formatClientZakazkaTermin,
  loadClientZakazkyList,
} from "@/lib/client-portal/zakazka-server";
import { createClient } from "@/lib/supabase/server";

export default async function PortalZakazkyPage() {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni?next=/portal/zakazky");
  }

  const zakazky = await loadClientZakazkyList(supabase);

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Moje zakázky">
        <p className="text-sm text-slate-400">
          Přehled zakázek vzniklých z vašich schválených poptávek. Zobrazení je pouze
          informativní — úpravy probíhají interně u WEST COUNTY.
        </p>

        {zakazky.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            Zatím nemáte žádnou zakázku. Po schválení a převedení poptávky se zde objeví.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {zakazky.map((row) => {
              const title = row.nazev || row.misto || "Bez názvu";
              const subtitle = [row.misto, formatClientZakazkaTermin(row)]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={row.zakazka_id}>
                  <Link
                    href={`/portal/zakazky/${row.zakazka_id}`}
                    className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-amber-500/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-white">{title}</div>
                        <div className="mt-1 text-sm text-slate-400">{subtitle || "—"}</div>
                        {row.cislo_poptavky ? (
                          <div className="mt-2 text-xs text-slate-500">
                            Z poptávky {row.cislo_poptavky}
                          </div>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                        {formatClientZakazkaStatus(row)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
    </PortalShell>
  );
}
