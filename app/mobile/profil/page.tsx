import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { MOBILE_HOME_PATH } from "@/lib/mobile/routes";
import { MobileProfileLogoutButton } from "./MobileProfileLogoutButton";

export const dynamic = "force-dynamic";

function MenuLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 transition hover:border-slate-700 hover:bg-slate-900"
    >
      <div className="text-base font-black text-white">{label}</div>
      <div className="mt-1 text-sm text-slate-400">{description}</div>
    </Link>
  );
}

export default async function MobileProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("jmeno, prijmeni, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const fullName = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  const displayName = fullName || profile?.email || user.email || "Uživatel";

  return (
    <div className="page-shell w-full space-y-4 pb-4">
      <Card className="space-y-2 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Přihlášený uživatel
        </div>
        <div className="text-xl font-black text-white">{displayName}</div>
        <div className="text-sm text-slate-400">{profile?.email ?? user.email}</div>
        {profile?.role ? (
          <div className="inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
            Role: {profile.role}
          </div>
        ) : null}
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-500">
          Mobilní režim
        </h2>
        <MenuLink href={MOBILE_HOME_PATH} label="Domů" description="Přehled a rychlé akce" />
        <MenuLink href="/moje" label="Moje zakázky" description="Potvrzené zakázky a účast" />
        <MenuLink href="/sklad/scan" label="Scan" description="QR sken a nakládka" />
        <MenuLink href="/dochazka" label="Docházka" description="Začít nebo ukončit práci" />
        <MenuLink href="/notifikace" label="Upozornění" description="Provozní notifikace" />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-500">
          Desktop (široká obrazovka)
        </h2>
        <p className="px-1 text-sm text-slate-500">
          Plná administrace, sklad, tabulky a kalendář zůstávají dostupné na desktopu. Na mobilu
          jsou skryté z hlavní navigace.
        </p>
        <MenuLink href="/zakazky" label="Všechny zakázky" description="Desktop seznam zakázek" />
        <MenuLink href="/dashboard" label="Dashboard" description="Přehled pro vedení" />
      </section>

      <MobileProfileLogoutButton />
    </div>
  );
}
