"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountantConfig } from "./accountant/actions";
import { saveAccountantConfig } from "./accountant/actions";

export default function AccountantConfigForm({ config }: { config: AccountantConfig | null }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveAccountantConfig(formData);
      if (result.ok) {
        setToast({ message: "Účetní kontakt uložen", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Uložení účetní selhalo", type: "error" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Účetní je jen kontakt pro odeslání podkladů. Nemá přístup do systému, roli ani remindery.
      </p>
      <form action={submit} className="space-y-4">
        <input type="hidden" name="id" value={config?.id ?? ""} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Jméno</span>
            <Input name="jmeno" defaultValue={config?.jmeno ?? ""} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Název firmy</span>
            <Input name="nazev_firmy" defaultValue={config?.nazev_firmy ?? ""} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-200">Adresa</span>
            <Input name="adresa" defaultValue={config?.adresa ?? ""} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Telefon</span>
            <Input name="telefon" defaultValue={config?.telefon ?? ""} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Email pro podklady</span>
            <Input name="email" type="email" defaultValue={config?.email ?? ""} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-200">Poznámka</span>
            <textarea
              name="poznamka"
              defaultValue={config?.poznamka ?? ""}
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Ukládám..." : "Uložit účetní kontakt"}
          </Button>
        </div>
      </form>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
