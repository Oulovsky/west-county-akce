import Link from "next/link";
import { Card } from "@/components/ui/card";
import { runReminderEngineAction } from "./actions";

export default function AdminRemindersPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 text-slate-200">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-blue-200 hover:text-blue-100">
          ← Zpět do adminu
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">Reminder engine</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manuální entrypoint pro provozní kontroly. Později ho lze spouštět cronem.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-white">Spustit kontroly</h2>
          <p className="mt-1 text-sm text-slate-400">
            Kontroluje zítřejší akce, odjezdy do 2 hodin, neukončenou docházku,
            dlouho čekající proplacení a zakázky čekající na znovuschválení.
          </p>
        </div>
        <form action={runReminderEngineAction}>
          <button className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-600">
            Spustit reminder engine
          </button>
        </form>
      </Card>
    </div>
  );
}
