import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { createClient } from "@/lib/supabase/server";
import { portalSignOutAction } from "./actions";

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ registered?: string }>;
}) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const justRegistered = resolvedSearchParams?.registered === "1";

  if (session.kind === "guest") {
    return (
      <PortalShell>
        <PortalCard title="Klientská zóna">
          <p className="text-sm leading-relaxed text-slate-400">
            Přihlaste se nebo zaregistrujte firmu pro zadávání poptávek a přehled
            zakázek.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/portal/prihlaseni"
              className="inline-flex rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
            >
              Přihlášení
            </Link>
            <Link
              href="/portal/registrace"
              className="inline-flex rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              Registrace klienta
            </Link>
          </div>
        </PortalCard>
      </PortalShell>
    );
  }

  if (session.kind === "disabled") {
    return (
      <PortalShell>
        <PortalCard title="Účet deaktivován">
          <p className="text-sm text-slate-400">
            Váš klientský účet byl deaktivován. Kontaktujte WEST COUNTY.
          </p>
          <form action={portalSignOutAction} className="mt-6">
            <button
              type="submit"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              Odhlásit se
            </button>
          </form>
        </PortalCard>
      </PortalShell>
    );
  }

  if (session.kind === "authenticated_no_registration") {
    return (
      <PortalShell>
        <PortalCard title="Dokončete registraci">
          <p className="text-sm text-slate-400">
            Jste přihlášeni, ale nemáte aktivní klientský účet. Dokončete registraci
            firmy pro zadávání poptávek.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/portal/registrace"
              className="inline-flex rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50"
            >
              Registrace firmy
            </Link>
            <form action={portalSignOutAction}>
              <button
                type="submit"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200"
              >
                Odhlásit se
              </button>
            </form>
          </div>
        </PortalCard>
      </PortalShell>
    );
  }

  if (session.kind === "email_unverified") {
    redirect("/portal/potvrzeni-emailu");
  }

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni");
  }

  return (
    <PortalShell showMainNav>
      <PortalCard title="Vítejte v klientské zóně">
        {justRegistered ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Registrace proběhla úspěšně. Můžete rovnou vytvořit poptávku.
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-400">
          Přihlášen jako klient{" "}
          <span className="font-semibold text-white">
            {session.klientNazev ?? "—"}
          </span>
          .
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/portal/poptavky"
            className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-50 transition hover:border-amber-500/60 hover:bg-amber-500/25"
          >
            Moje poptávky
          </Link>
          <Link
            href="/portal/zakazky"
            className="rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-50 transition hover:border-blue-500/60 hover:bg-blue-500/25"
          >
            Moje zakázky
          </Link>
          <Link
            href="/portal/presety"
            className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-50 transition hover:border-violet-500/60 hover:bg-violet-500/25"
          >
            Moje místa a presety
          </Link>
          <Link
            href="/portal/profil"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500/30 hover:bg-white/[0.05]"
          >
            Profil a kontakt
          </Link>
        </div>

        <form action={portalSignOutAction} className="mt-6">
          <button
            type="submit"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Odhlásit se
          </button>
        </form>
      </PortalCard>
    </PortalShell>
  );
}
