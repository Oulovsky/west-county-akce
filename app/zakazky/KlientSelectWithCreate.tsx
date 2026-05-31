"use client";

import { useMemo, useState } from "react";
import { fetchKlientFromAres, normalizeIco } from "@/lib/ares/klient-ares";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

export type KlientOption = {
  klient_id: string;
  nazev: string;
};

type KlientFormState = {
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  ico: string;
  dic: string;
  telefon: string;
  email: string;
  poznamka: string;
};

type Props = {
  clients: KlientOption[];
  selectedId?: string;
  defaultSelectedId?: string | null;
  name?: string;
  onSelectedIdChange?: (clientId: string) => void;
  onClientCreated?: (client: KlientOption) => void;
};

const emptyForm: KlientFormState = {
  nazev: "",
  ulice: "",
  mesto: "",
  psc: "",
  ico: "",
  dic: "",
  telefon: "",
  email: "",
  poznamka: "",
};

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dedupeClientsById(clients: KlientOption[]) {
  const seen = new Set<string>();
  const uniqueClients: KlientOption[] = [];

  for (const client of clients) {
    if (seen.has(client.klient_id)) continue;
    seen.add(client.klient_id);
    uniqueClients.push(client);
  }

  return uniqueClients;
}

export function KlientSelectWithCreate({
  clients,
  selectedId,
  defaultSelectedId = "",
  name = "klient_id",
  onSelectedIdChange,
  onClientCreated,
}: Props) {
  const [localSelectedId, setLocalSelectedId] = useState(defaultSelectedId ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aresLoading, setAresLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<KlientFormState>(emptyForm);
  const [createdClients, setCreatedClients] = useState<KlientOption[]>([]);

  const currentSelectedId = selectedId ?? localSelectedId;
  const sortedClients = useMemo(
    () =>
      dedupeClientsById([...clients, ...createdClients]).sort((a, b) =>
        a.nazev.localeCompare(b.nazev, "cs")
      ),
    [clients, createdClients]
  );

  function setSelected(nextId: string) {
    setLocalSelectedId(nextId);
    onSelectedIdChange?.(nextId);
  }

  function updateForm(field: keyof KlientFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function loadFromAres() {
    const ico = normalizeIco(form.ico);
    if (!/^\d{8}$/.test(ico)) {
      setError("IČO musí mít přesně 8 číslic.");
      return;
    }

    setAresLoading(true);
    setError(null);

    const result = await fetchKlientFromAres(ico);
    setAresLoading(false);

    if (!result.ok) {
      if (result.error === "not_found") {
        setError("ARES nenašel subjekt pro zadané IČO.");
      } else if (result.error === "invalid_ico") {
        setError("IČO musí mít přesně 8 číslic.");
      } else {
        setError("ARES je momentálně nedostupný. Klienta můžeš vyplnit ručně.");
      }
      return;
    }

    setForm((current) => ({
      ...current,
      nazev: result.form.nazev || current.nazev,
      ico: result.form.ico || ico,
      dic: result.form.dic || current.dic,
      ulice: result.form.ulice || current.ulice,
      mesto: result.form.mesto || current.mesto,
      psc: result.form.psc || current.psc,
    }));
  }

  async function createClient() {
    const nazev = form.nazev.trim();
    if (!nazev) {
      setError("Vyplň název klienta.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("klienti")
      .insert({
        nazev,
        ulice: toNullable(form.ulice),
        mesto: toNullable(form.mesto),
        psc: toNullable(form.psc),
        ico: toNullable(form.ico),
        dic: toNullable(form.dic),
        telefon: toNullable(form.telefon),
        email: toNullable(form.email),
        poznamka: toNullable(form.poznamka),
      })
      .select("klient_id, nazev")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const created = data as KlientOption;
    setCreatedClients((current) =>
      clients.some((client) => client.klient_id === created.klient_id) ||
      current.some((client) => client.klient_id === created.klient_id)
        ? current
        : [...current, created]
    );
    onClientCreated?.(created);
    setSelected(created.klient_id);
    setForm(emptyForm);
    setOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Field label="Vybrat klienta">
            <select
              name={name}
              value={currentSelectedId}
              onChange={(event) => setSelected(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Bez klienta</option>
              {sortedClients.map((client) => (
                <option key={client.klient_id} value={client.klient_id}>
                  {client.nazev}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          + Nový klient
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border-slate-700 bg-slate-950">
            <div className="space-y-5">
              <div>
                <div className="text-2xl font-bold text-white">Nový klient</div>
                <div className="mt-1 text-sm text-slate-400">
                  Základní údaje klienta pro zakázky. Fakturace a kontaktní osoby se doplní později.
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Název">
                  <Input
                    value={form.nazev}
                    onChange={(event) => updateForm("nazev", event.target.value)}
                    placeholder="Např. Město Bečov"
                  />
                </Field>

                <Field label="Ulice">
                  <Input value={form.ulice} onChange={(event) => updateForm("ulice", event.target.value)} />
                </Field>

                <Field label="Město">
                  <Input value={form.mesto} onChange={(event) => updateForm("mesto", event.target.value)} />
                </Field>

                <Field label="PSČ">
                  <Input value={form.psc} onChange={(event) => updateForm("psc", event.target.value)} />
                </Field>

                <Field label="IČO">
                  <div className="flex gap-2">
                    <Input
                      value={form.ico}
                      onChange={(event) => updateForm("ico", event.target.value)}
                      placeholder="8 číslic"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void loadFromAres()}
                      disabled={aresLoading}
                      className="mt-2 whitespace-nowrap"
                    >
                      {aresLoading ? "Načítám..." : "Načíst z ARES"}
                    </Button>
                  </div>
                </Field>

                <Field label="DIČ">
                  <Input value={form.dic} onChange={(event) => updateForm("dic", event.target.value)} />
                </Field>

                <Field label="Telefon">
                  <Input value={form.telefon} onChange={(event) => updateForm("telefon", event.target.value)} />
                </Field>

                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
                </Field>
              </div>

              <Field label="Poznámka">
                <Textarea
                  value={form.poznamka}
                  onChange={(event) => updateForm("poznamka", event.target.value)}
                  placeholder="Volitelná interní poznámka"
                />
              </Field>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  disabled={saving}
                >
                  Zrušit
                </Button>
                <Button type="button" onClick={() => void createClient()} disabled={saving}>
                  {saving ? "Ukládám..." : "Uložit klienta"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
