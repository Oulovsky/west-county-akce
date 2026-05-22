import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ReminderRunClient } from "./ReminderRunClient";

export default function AdminRemindersPage() {
  return (
    <div className="page-shell w-full space-y-5 text-slate-200">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-blue-200 hover:text-blue-100">
          ← Zpět do adminu
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">Pokročilé: Notifikace a kontroly</h1>
        <p className="mt-2 text-sm text-slate-400">
          Technická stránka pro ruční spuštění stejných provozních kontrol. Později ji lze nahradit cronem.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-white">Spustit kontroly</h2>
          <p className="mt-1 text-sm text-slate-400">
            Kontroluje zítřejší akce, odjezdy do 2 hodin, neukončenou docházku,
            dlouho čekající proplacení, zakázky čekající na schválení, dlouho opravované kusy
            a faktury po splatnosti.
          </p>
        </div>
        <ReminderRunClient />
      </Card>
    </div>
  );
}
