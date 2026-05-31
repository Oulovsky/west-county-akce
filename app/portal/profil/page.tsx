import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { createClient } from "@/lib/supabase/server";
import { portalSignOutAction, portalUpdateProfilAction } from "../actions";

export default async function PortalProfilPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni?next=/portal/profil");
  }

  const { data: klient } = await supabase
    .from("klienti")
    .select("nazev, ico, dic, ulice, mesto, psc, email, telefon")
    .eq("klient_id", session.account.klient_id!)
    .single();

  const kontaktJmeno = [session.account.jmeno, session.account.prijmeni]
    .filter(Boolean)
    .join(" ");

  return (
    <PortalShell showBackToPortal>
      <PortalCard title="Profil klienta">
        {resolvedSearchParams?.saved === "1" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Kontaktní údaje byly uloženy.
          </p>
        ) : null}
        {resolvedSearchParams?.error === "save_failed" ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Uložení se nezdařilo.
          </p>
        ) : null}

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Firma</dt>
            <dd className="font-medium text-white">{klient?.nazev ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">IČO</dt>
            <dd className="text-slate-200">{klient?.ico ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">DIČ</dt>
            <dd className="text-slate-200">{klient?.dic ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Adresa</dt>
            <dd className="text-slate-200">
              {[klient?.ulice, klient?.mesto, klient?.psc].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
        </dl>

        <form action={portalUpdateProfilAction} className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Kontaktní osoba</span>
            <input
              name="kontakt_jmeno"
              defaultValue={kontaktJmeno}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Telefon</span>
            <input
              name="telefon"
              defaultValue={session.account.telefon ?? klient?.telefon ?? ""}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
          >
            Uložit kontakt
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/portal"
            className="text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Zpět na portál
          </Link>
          <form action={portalSignOutAction}>
            <button type="submit" className="text-sm text-slate-400 hover:text-slate-200">
              Odhlásit se
            </button>
          </form>
        </div>
      </PortalCard>
    </PortalShell>
  );
}
