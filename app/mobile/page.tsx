import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MobileFieldLayout } from "@/components/mobile/MobileFieldLayout";
import { MobileScanPickerLink } from "@/components/mobile/MobileScanPickerLink";
import { getDochazkaPath, getMojeZakazkaDetailPath } from "@/lib/mobile/routes";
import { createClient } from "@/lib/supabase/server";
import { loadMobileDashboardCards } from "@/lib/mobile/dashboard-data";

export const dynamic = "force-dynamic";

function MobileActionButton({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "bg-blue-600 text-white"
      : "border border-slate-700 bg-slate-900 text-slate-100";

  return (
    <Link
      href={href}
      className={`flex min-h-14 items-center justify-center rounded-2xl px-4 text-lg font-black transition active:scale-[0.99] ${classes}`}
    >
      {label}
    </Link>
  );
}

export default async function MobileHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let cards: Awaited<ReturnType<typeof loadMobileDashboardCards>> = [];
  let loadError: string | null = null;

  try {
    cards = await loadMobileDashboardCards(supabase, user.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nepodařilo se načíst zakázky.";
  }

  const { count: unreadCount } = await supabase
    .from("notifikace")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null)
    .is("dismissed_at", null);

  const todayCards = cards.filter((card) => card.isToday);
  const upcomingCards = cards.filter((card) => !card.isToday);
  const firstToday = todayCards[0] ?? upcomingCards[0] ?? null;

  return (
    <MobileFieldLayout>
      <div className="grid gap-2">
        <MobileActionButton href="/mobile/scan" label="Scan" />
        {firstToday ? (
          <MobileActionButton
            href={getDochazkaPath(firstToday.zakazkaId)}
            label="Začít práci"
            variant="secondary"
          />
        ) : (
          <MobileActionButton href="/dochazka" label="Docházka" variant="secondary" />
        )}
        <MobileActionButton
          href="/notifikace"
          label={(unreadCount ?? 0) > 0 ? `Upozornění (${unreadCount})` : "Upozornění"}
          variant="secondary"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Dnes</h3>
        <Link href="/moje" className="text-xs font-bold text-blue-200">
          Vše
        </Link>
      </div>

      {loadError ? (
        <Card className="border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">{loadError}</Card>
      ) : null}

      {!loadError && todayCards.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">Dnes žádná zakázka.</Card>
      ) : null}

      {todayCards.map((card) => (
        <MobileScanPickerLink
          key={card.zakazkaId}
          zakazkaId={card.zakazkaId}
          cislo={card.cislo}
          nazev={card.nazev}
          whenLabel={card.whenLabel}
          highlight
        />
      ))}

      {upcomingCards.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Další</h3>
          {upcomingCards.map((card) => (
            <Link
              key={card.zakazkaId}
              href={getMojeZakazkaDetailPath(card.zakazkaId)}
              className="block rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 active:scale-[0.99]"
            >
              <div className="text-xs font-bold text-slate-500">{card.cislo}</div>
              <div className="mt-1 font-bold text-white">{card.nazev}</div>
              <div className="mt-1 text-sm text-slate-400">{card.whenLabel}</div>
            </Link>
          ))}
        </section>
      ) : null}
    </MobileFieldLayout>
  );
}
