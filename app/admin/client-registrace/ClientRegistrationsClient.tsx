"use client";

import { parseClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";

export type ClientRegistrationAuditRow = {
  registration_id: string;
  user_id: string;
  navrh_ico: string | null;
  navrh_nazev_firmy: string | null;
  ares_snapshot: unknown;
  stav: string;
  klient_id: string | null;
  schvaleno_at: string | null;
  created_at: string;
};

const STAV_LABELS: Record<string, string> = {
  approved: "Aktivováno",
  pending: "Legacy — čekalo na schválení",
  rejected: "Zamítnuto",
};

function stavTone(stav: string) {
  if (stav === "approved") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  }
  if (stav === "rejected") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

export default function ClientRegistrationsClient({
  registrations,
}: {
  registrations: ClientRegistrationAuditRow[];
}) {
  if (registrations.length === 0) {
    return (
      <p className="text-sm text-slate-400">Zatím nejsou žádné záznamy registrací.</p>
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
                  IČO {registration.navrh_ico ?? form?.ico ?? "—"} · registrace{" "}
                  {new Date(registration.created_at).toLocaleString("cs-CZ")}
                  {registration.schvaleno_at
                    ? ` · aktivováno ${new Date(registration.schvaleno_at).toLocaleString("cs-CZ")}`
                    : null}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${stavTone(registration.stav)}`}
              >
                {STAV_LABELS[registration.stav] ?? registration.stav}
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
                {registration.klient_id ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Klient v systému</dt>
                    <dd className="font-mono text-xs text-slate-300">{registration.klient_id}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
