"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { FakturacniFirma } from "@/lib/fakturacni-firmy";
import {
  deactivateFakturacniFirma,
  saveFakturacniFirma,
  setDefaultFakturacniFirma,
} from "./fakturacni-firmy/actions";

type FormState = {
  id: string;
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  ico: string;
  dic: string;
  email: string;
  telefon: string;
  bankovni_ucet: string;
  iban: string;
  swift: string;
  poznamka: string;
  aktivni: boolean;
  vychozi: boolean;
};

type AresSidlo = {
  nazevUlice?: unknown;
  cisloDomovni?: unknown;
  cisloOrientacni?: unknown;
  nazevObce?: unknown;
  nazevCastiObce?: unknown;
  psc?: unknown;
};

type AresSubject = {
  ico?: unknown;
  obchodniJmeno?: unknown;
  dic?: unknown;
  sidlo?: AresSidlo;
};

const emptyForm: FormState = {
  id: "",
  nazev: "",
  ulice: "",
  mesto: "",
  psc: "",
  ico: "",
  dic: "",
  email: "",
  telefon: "",
  bankovni_ucet: "",
  iban: "",
  swift: "",
  poznamka: "",
  aktivni: true,
  vychozi: false,
};

function value(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePsc(valueRaw: unknown) {
  const raw = value(valueRaw).replace(/\D/g, "");
  return raw.length === 5 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;
}

function formatStreet(address?: AresSidlo) {
  const street = value(address?.nazevUlice) || value(address?.nazevCastiObce);
  const house = value(address?.cisloDomovni);
  const orientation = value(address?.cisloOrientacni);
  const number = [house, orientation].filter(Boolean).join("/");
  return [street, number].filter(Boolean).join(" ");
}

function toForm(firma: FakturacniFirma): FormState {
  return {
    id: firma.id,
    nazev: firma.nazev ?? "",
    ulice: firma.ulice ?? "",
    mesto: firma.mesto ?? "",
    psc: firma.psc ?? "",
    ico: firma.ico ?? "",
    dic: firma.dic ?? "",
    email: firma.email ?? "",
    telefon: firma.telefon ?? "",
    bankovni_ucet: firma.bankovni_ucet ?? "",
    iban: firma.iban ?? "",
    swift: firma.swift ?? "",
    poznamka: firma.poznamka ?? "",
    aktivni: firma.aktivni,
    vychozi: firma.vychozi,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      {children}
    </label>
  );
}

export default function FakturacniFirmyClient({ firmy }: { firmy: FakturacniFirma[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [aresLoading, setAresLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function update(field: keyof FormState, nextValue: string | boolean) {
    setForm((current) => ({ ...current, [field]: nextValue }));
  }

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(firma: FakturacniFirma) {
    setForm(toForm(firma));
    setOpen(true);
  }

  async function loadFromAres() {
    const ico = form.ico.replace(/\D/g, "");
    if (!/^\d{8}$/.test(ico)) {
      setToast({ message: "IČO musí mít přesně 8 číslic.", type: "error" });
      return;
    }

    setAresLoading(true);
    try {
      const response = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        setToast({ message: "ARES je momentálně nedostupný. Firmu lze vyplnit ručně.", type: "error" });
        return;
      }

      const subject = (await response.json()) as AresSubject;
      setForm((current) => ({
        ...current,
        nazev: value(subject.obchodniJmeno) || current.nazev,
        ico: value(subject.ico) || ico,
        dic: value(subject.dic) || current.dic,
        ulice: formatStreet(subject.sidlo) || current.ulice,
        mesto: value(subject.sidlo?.nazevObce) || value(subject.sidlo?.nazevCastiObce) || current.mesto,
        psc: normalizePsc(subject.sidlo?.psc) || current.psc,
      }));
    } catch {
      setToast({ message: "ARES je momentálně nedostupný. Firmu lze vyplnit ručně.", type: "error" });
    } finally {
      setAresLoading(false);
    }
  }

  function submit() {
    const formData = new FormData();
    for (const [key, fieldValue] of Object.entries(form)) {
      if (typeof fieldValue === "boolean") {
        if (fieldValue) formData.append(key, "on");
      } else {
        formData.append(key, fieldValue);
      }
    }

    startTransition(async () => {
      const result = await saveFakturacniFirma(formData);
      if (result.ok) {
        setToast({ message: "Fakturační firma uložena", type: "success" });
        setOpen(false);
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Uložení selhalo", type: "error" });
      }
    });
  }

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setToast({ message: success, type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Akce selhala", type: "error" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Na zakázce se vybírá, která z těchto firem bude uvedená jako dodavatel na dokladu.
        </p>
        <Button onClick={openNew}>Přidat firmu</Button>
      </div>

      <div className="grid gap-3">
        {firmy.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            Zatím není přidaná žádná fakturační firma.
          </div>
        ) : (
          firmy.map((firma) => (
            <div
              key={firma.id}
              className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4 md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="break-words font-bold text-white">{firma.nazev}</div>
                  {firma.vychozi ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                      výchozí
                    </span>
                  ) : null}
                  {!firma.aktivni ? (
                    <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                      neaktivní
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {[firma.ulice, [firma.psc, firma.mesto].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresa neuvedena"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  IČO: {firma.ico || "Neuvedeno"} · DIČ: {firma.dic || "Neuvedeno"} · Účet: {firma.bankovni_ucet || firma.iban || "Neuvedeno"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button variant="secondary" onClick={() => openEdit(firma)} disabled={isPending}>
                  Upravit
                </Button>
                {!firma.vychozi ? (
                  <Button
                    variant="secondary"
                    onClick={() => runAction(() => setDefaultFakturacniFirma(firma.id), "Výchozí firma nastavena")}
                    disabled={isPending}
                  >
                    Nastavit výchozí
                  </Button>
                ) : null}
                {firma.aktivni ? (
                  <Button
                    variant="danger"
                    onClick={() => runAction(() => deactivateFakturacniFirma(firma.id), "Firma deaktivována")}
                    disabled={isPending}
                  >
                    Deaktivovat
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Upravit fakturační firmu" : "Nová fakturační firma"}
        widthClassName="max-w-3xl"
      >
        <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Field label="IČO">
              <Input value={form.ico} onChange={(event) => update("ico", event.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => void loadFromAres()} disabled={aresLoading}>
                {aresLoading ? "Načítám..." : "Načíst z ARES"}
              </Button>
            </div>
          </div>

          <Field label="Název">
            <Input value={form.nazev} onChange={(event) => update("nazev", event.target.value)} />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ulice">
              <Input value={form.ulice} onChange={(event) => update("ulice", event.target.value)} />
            </Field>
            <Field label="Město">
              <Input value={form.mesto} onChange={(event) => update("mesto", event.target.value)} />
            </Field>
            <Field label="PSČ">
              <Input value={form.psc} onChange={(event) => update("psc", event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="DIČ">
              <Input value={form.dic} onChange={(event) => update("dic", event.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input value={form.telefon} onChange={(event) => update("telefon", event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Bankovní účet">
              <Input value={form.bankovni_ucet} onChange={(event) => update("bankovni_ucet", event.target.value)} />
            </Field>
            <Field label="IBAN">
              <Input value={form.iban} onChange={(event) => update("iban", event.target.value)} />
            </Field>
            <Field label="SWIFT">
              <Input value={form.swift} onChange={(event) => update("swift", event.target.value)} />
            </Field>
          </div>

          <Field label="Poznámka">
            <textarea
              value={form.poznamka}
              onChange={(event) => update("poznamka", event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </Field>

          <div className="flex flex-wrap gap-4 text-sm text-slate-200">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.aktivni} onChange={(event) => update("aktivni", event.target.checked)} />
              Aktivní
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.vychozi} onChange={(event) => update("vychozi", event.target.checked)} />
              Výchozí firma
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Zrušit
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? "Ukládám..." : "Uložit"}
            </Button>
          </div>
        </div>
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
