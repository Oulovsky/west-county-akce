"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";

type ZakazkaHeaderCardProps = {
  zakazkaId: string;
  data: {
    cislo_zakazky?: string | null;
    nazev?: string | null;
    klient_nazev?: string | null;
    misto?: string | null;
    misto_id?: string | null;
    misto_lat?: number | string | null;
    misto_lng?: number | string | null;
    misto_gps_radius_m?: number | string | null;
    typ_obsluhy?: string | null;
    poznamka?: string | null;
    zrusena?: boolean | null;
  };
  hasInvoice?: boolean;
  cancelAction: (formData: FormData) => Promise<void>;
  readOnly?: boolean;
};

export function ZakazkaHeaderCard({
  zakazkaId,
  data,
  hasInvoice = false,
  cancelAction,
  readOnly = false,
}: ZakazkaHeaderCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const lat = String(data.misto_lat ?? "").trim();
  const lng = String(data.misto_lng ?? "").trim();
  const hasGps = Boolean(lat && lng);
  const navigationQuery = hasGps ? `${lat},${lng}` : (data.misto ?? "").trim();
  const navigationHref = navigationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`
    : null;

  return (
    <Card className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-4xl font-bold text-white">
              {data.cislo_zakazky} – {data.nazev}
            </div>
            <div className="text-lg text-slate-400">
              {data.misto_id ? (
                <Link
                  href={`/mista/${data.misto_id}`}
                  className="font-semibold text-blue-200 underline-offset-4 hover:text-blue-100 hover:underline"
                >
                  {data.misto || "Detail místa"}
                </Link>
              ) : (
                data.misto || "—"
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasGps ? "success" : "warning"}>
                {hasGps ? "GPS zadána" : "GPS chybí"}
              </Badge>
              <Badge variant="default">
                Radius: {data.misto_gps_radius_m ?? 300} m
              </Badge>
              {navigationHref ? (
                <a
                  href={navigationHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-500/40 px-3 py-1.5 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/10"
                >
                  Navigovat
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Klient">
              <div className="mt-2 text-slate-400">{data.klient_nazev || "—"}</div>
            </Field>

            <Field label="Typ obsluhy">
              <div className="mt-2">
                <Badge variant="default">
                  {data.typ_obsluhy === "bez_obsluhy" ? "Bez obsluhy" : "S obsluhou"}
                </Badge>
              </div>
            </Field>

            <Field label="Poznámka">
              <div className="mt-2 text-slate-400">{data.poznamka || "—"}</div>
            </Field>
          </div>
        </div>

        <Card className="border-red-500/20 bg-red-950/10">
          <div className="space-y-4">
            <div className="text-base font-semibold text-white">
              {readOnly ? "Přehled zakázky" : "Správa zakázky"}
            </div>

            {readOnly ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                Režim pouze pro čtení. Úpravy, zrušení a poškození nejsou k dispozici.
              </div>
            ) : (
              <>
                <Link
                  href={`/zakazky/${zakazkaId}/poskozeni`}
                  className="block w-full rounded-xl border border-amber-500/40 px-4 py-3 text-center font-semibold text-amber-300 transition hover:bg-amber-500/10 hover:text-amber-200"
                >
                  Poškození na zakázce
                </Link>

                {data.zrusena ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                    Zakázka je zrušená.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="w-full rounded-xl border border-red-500/40 px-4 py-3 font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                  >
                    Zrušit zakázku
                  </button>
                )}

                <div className="text-sm text-slate-400">
                  Zakázka se přesune mimo běžný seznam a odpojí se od techniky, lidí a nakládky.
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Modal open={cancelOpen && !readOnly} onClose={() => setCancelOpen(false)} title="Zrušit zakázku" widthClassName="max-w-xl">
        <form action={cancelAction} className="space-y-4">
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Zrušení je provozní storno. Zakázka zůstane v historii, tokeny klienta se zneplatní,
            logistika se zastaví a aktivní kusy se uvolní.
          </div>

          {hasInvoice ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <div className="font-bold">Zakázka už má vystavenou fakturu.</div>
              <div className="mt-1">
                Zrušení vyžaduje explicitní override s důvodem. Storno faktury ani dobropis se teď neřeší automaticky.
              </div>
            </div>
          ) : null}

          <Field label="Důvod zrušení">
            <Textarea
              name="zruseno_duvod"
              rows={4}
              required
              placeholder="Např. klient zrušil akci, počasí, interní rozhodnutí..."
            />
          </Field>

          {hasInvoice ? (
            <Field label="Důvod override vystavené faktury">
              <Textarea
                name="invoice_override_reason"
                rows={3}
                required
                placeholder="Proč rušíme zakázku i přes vystavenou fakturu?"
              />
            </Field>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Nechat zakázku aktivní
            </button>
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white transition hover:bg-red-600"
            >
              Potvrdit zrušení
            </button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}