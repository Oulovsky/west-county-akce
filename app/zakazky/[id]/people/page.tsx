import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import PeopleClient from "./PeopleClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ZakazkaPeoplePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Lidé na zakázce
              </h1>
              <Badge variant="default">Správa týmu</Badge>
            </div>

            <p className="max-w-3xl text-sm text-slate-400">
              Přehled přiřazených lidí a jejich bloků k této zakázce.
            </p>
          </div>
        </div>

        <ZakazkaSubnav zakazkaId={id} active="people" />
      </Card>

      <PeopleClient zakazkaId={id} />
    </div>
  );
}