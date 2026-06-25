"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

type SectionCardProps = {
  title: string;
  description: string;
  status?: string;
  href?: string;
};

function SectionCard({
  title,
  description,
  status = "Připravuje se",
  href,
}: SectionCardProps) {
  const content = (
    <Card className="border-slate-700 bg-slate-950/40 transition hover:border-slate-600 hover:bg-slate-900/40">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
            {status}
          </div>
        </div>

        <div className="text-sm text-slate-400">{description}</div>

        {href && (
          <div className="pt-1">
            <span className="inline-flex rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Otevřít
            </span>
          </div>
        )}
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function SkladKonfiguracePage() {
  return (
    <div className="w-full py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Konfigurace skladu</h1>
          <div className="text-sm text-slate-400">
            Správa číselníků a struktury skladu.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/sprava"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Zpět na správu skladu
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard
          title="Okruhy skladu"
          description="Členění skladu používané pro filtrování a přiřazení položek."
          status="Hotovo"
          href="/sklad/konfigurace/okruhy"
        />

        <SectionCard
          title="Kategorie"
          description="Hlavní kategorie techniky."
          status="Hotovo"
          href="/sklad/konfigurace/kategorie"
        />

        <SectionCard
          title="Podkategorie"
          description="Podkategorie navázané na kategorii."
          status="Hotovo"
          href="/sklad/konfigurace/podkategorie"
        />

        <SectionCard
          title="Jednotky"
          description="Jednotky jako ks, m, sada..."
          status="Hotovo"
          href="/sklad/konfigurace/jednotky"
        />

        <SectionCard
          title="Vlastníci techniky"
          description="Evidence vlastníků techniky ve skladu (WEST COUNTY, HDT…)."
          status="Hotovo"
          href="/sklad/konfigurace/vlastnici"
        />

        <SectionCard
          title="Typy poškození"
          description="Typy závad (mechanické, elektrické…)."
          status="Hotovo"
          href="/sklad/konfigurace/typy-poskozeni"
        />

        <SectionCard
          title="Priority poškození"
          description="Řazení důležitosti (nízká → kritická)."
          status="Hotovo"
          href="/sklad/konfigurace/priority-poskozeni"
        />

        <SectionCard
          title="Odpisová pásma"
          description="Interní pásma pro výpočet současné hodnoty konkrétních kusů techniky."
          status="Hotovo"
          href="/sklad/konfigurace/odpisova-pasma"
        />

        <SectionCard
          title="Portálový konfigurátor"
          description="Katalog stage, pódia, LED, zvuku a světel pro klientský portál."
          status="Hotovo"
          href="/sklad/konfigurace/portal-konfigurator"
        />
      </div>
    </div>
  );
}
