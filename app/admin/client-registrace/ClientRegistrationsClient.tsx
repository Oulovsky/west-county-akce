"use client";

import { useState } from "react";
import { approveClientRegistrationAction, rejectClientRegistrationAction } from "./actions";
import { parseClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";

export type PendingClientRegistrationRow = {
  registration_id: string;
  user_id: string;
  navrh_ico: string | null;
  navrh_nazev_firmy: string | null;
  ares_snapshot: unknown;
  stav: string;
  created_at: string;
};

export default function ClientRegistrationsClient({
  registrations,
}: {
  registrations: PendingClientRegistrationRow[];
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (registrations.length === 0) {
    return (
      <p className="text-sm text-slate-400">Žádné registrace ke schválení.</p>
    );
  }

  return (
    <div className="space-y-4">
      {registrations.map((registration) => {
        const snapshot = parseClientRegistrationSnapshot(registration.ares_snapshot);
        const form = snapshot?.form;

        return (
          <article
            key={registration.registration_id}
            className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {registration.navrh_nazev_firmy ?? form?.nazev ?? "—"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  IČO {registration.navrh_ico ?? form?.ico ?? "—"} · odesláno{" "}
                  {new Date(registration.created_at).toLocaleString("cs-CZ")}
                </p>
              </div>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                {registration.stav}
              </span>
            </div>

            {form ? (
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Kontakt</dt>
                  <dd className="text-slate-200">{form.kontakt_jmeno || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Telefon</dt>
                  <dd className="text-slate-200">{form.telefon || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">E-mail</dt>
                  <dd className="text-slate-200">{form.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Adresa</dt>
                  <dd className="text-slate-200">
                    {[form.ulice, form.mesto, form.psc].filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
                {form.poznamka ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Poznámka</dt>
                    <dd className="text-slate-200">{form.poznamka}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <form
                action={(formData) => {
                  setBusyId(registration.registration_id);
                  void approveClientRegistrationAction(formData);
                }}
              >
                <input type="hidden" name="registration_id" value={registration.registration_id} />
                <button
                  type="submit"
                  disabled={busyId === registration.registration_id}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  Schválit
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setRejectingId(registration.registration_id);
                  setRejectReason("");
                }}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
              >
                Zamítnout
              </button>
            </div>

            {rejectingId === registration.registration_id ? (
              <form
                className="mt-4 space-y-3 border-t border-slate-700 pt-4"
                action={(formData) => {
                  setBusyId(registration.registration_id);
                  void rejectClientRegistrationAction(formData);
                }}
              >
                <input type="hidden" name="registration_id" value={registration.registration_id} />
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Důvod zamítnutí</span>
                  <textarea
                    name="zamitnuto_duvod"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyId === registration.registration_id}
                  className="rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100"
                >
                  Potvrdit zamítnutí
                </button>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
