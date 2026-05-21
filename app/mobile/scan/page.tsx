import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MobileFieldLayout } from "@/components/mobile/MobileFieldLayout";
import { MobileScanPickerLink } from "@/components/mobile/MobileScanPickerLink";
import { createClient } from "@/lib/supabase/server";
import { loadMobileDashboardCards } from "@/lib/mobile/dashboard-data";

export const dynamic = "force-dynamic";

export default async function MobileScanPickerPage() {
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

  const todayCards = cards.filter((card) => card.isToday);
  const otherCards = cards.filter((card) => !card.isToday);

  return (
    <MobileFieldLayout>
      <Card className="space-y-1 p-4">
        <h2 className="text-xl font-black text-white">Scan</h2>
        <p className="text-sm text-slate-400">Vyber zakázku. Otevře se nakládka / vykládka.</p>
      </Card>

      {loadError ? (
        <Card className="border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">{loadError}</Card>
      ) : null}

      {!loadError && cards.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">
          Žádná potvrzená zakázka.{" "}
          <Link href="/moje" className="font-semibold text-blue-200">
            Moje zakázky
          </Link>
        </Card>
      ) : null}

      {todayCards.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-emerald-400">Dnes</h3>
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
        </section>
      ) : null}

      {otherCards.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Další</h3>
          {otherCards.map((card) => (
            <MobileScanPickerLink
              key={card.zakazkaId}
              zakazkaId={card.zakazkaId}
              cislo={card.cislo}
              nazev={card.nazev}
              whenLabel={card.whenLabel}
            />
          ))}
        </section>
      ) : null}

      <Link
        href="/sklad/scan"
        className="block rounded-2xl border border-dashed border-slate-700 px-4 py-3 text-center text-xs font-semibold text-slate-400"
      >
        Sken kusu bez zakázky
      </Link>
    </MobileFieldLayout>
  );
}
