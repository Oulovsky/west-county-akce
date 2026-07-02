import Link from "next/link";
import {
  adminReleaseKonceptPoptavkaAction,
  resendPoptavkaSubmittedConfirmationAction,
} from "@/app/zakazky/poptavky/actions";
import { POPTAVKA_STAV_LABELS } from "@/lib/client-portal/labels";
import {
  canAdminReleaseKonceptToInbox,
  canResendPoptavkaSubmittedConfirmation,
  getPoptavkaInboxVisibility,
  getPoptavkaVisibilityReason,
} from "@/lib/client-portal/poptavka-inbox-visibility";
import type { PoptavkaStav } from "@/lib/client-portal/types";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function KlientPoptavkyDiagnosticPanel({
  klientId,
  poptavky,
}: {
  klientId: string;
  poptavky: Array<{
    poptavka_id: string;
    cislo_poptavky: string;
    stav: string;
    misto_nazev: string | null;
    datum_od: string | null;
    datum_do: string | null;
    odeslano_at: string | null;
    kontakt_email: string | null;
    created_at: string;
  }>;
}) {
  if (poptavky.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">Žádné poptávky.</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {poptavky.map((row) => {
        const stav = row.stav as PoptavkaStav;
        const visibility = getPoptavkaInboxVisibility(row.stav, row.odeslano_at);
        const visibilityReason = getPoptavkaVisibilityReason(row.stav);
        const canResend = canResendPoptavkaSubmittedConfirmation(stav);
        const canRelease = canAdminReleaseKonceptToInbox(stav);

        return (
          <li
            key={row.poptavka_id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-white">
                  {row.cislo_poptavky} · {row.misto_nazev ?? "—"}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-slate-400">
                  <span>Stav: {POPTAVKA_STAV_LABELS[stav] ?? row.stav}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      visibility.shownInInternalInbox
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    {visibility.shownInInternalInbox
                      ? "V interním inboxu"
                      : "Mimo interní inbox"}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Vytvořeno {formatDateTime(row.created_at)} · odesláno{" "}
                  {formatDateTime(row.odeslano_at)} · kontakt {row.kontakt_email ?? "—"}
                </div>
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                    visibility.shownInInternalInbox
                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
                      : "border-amber-500/30 bg-amber-950/20 text-amber-100"
                  }`}
                >
                  {visibilityReason}
                  {visibility.inboxTab === "active" && row.odeslano_at ? (
                    <span className="text-emerald-200/80">
                      {" "}
                      · Odesláno {formatDateTime(row.odeslano_at)}
                    </span>
                  ) : null}
                  {!visibility.shownInInternalInbox ? (
                    <span className="block text-amber-200/70">
                      V /zakazky/poptavky se nezobrazuje.
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/zakazky/poptavky/${row.poptavka_id}`}
                  className="font-semibold text-blue-300 hover:text-blue-200"
                >
                  Detail poptávky
                </Link>
              </div>
            </div>

            {(canResend || canRelease) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                {canRelease ? (
                  <form action={adminReleaseKonceptPoptavkaAction}>
                    <input type="hidden" name="poptavka_id" value={row.poptavka_id} />
                    <input
                      type="hidden"
                      name="redirect_to"
                      value={`/admin/klienti/${klientId}`}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-900/40"
                    >
                      Uvolnit koncept do inboxu + odeslat potvrzení
                    </button>
                  </form>
                ) : null}
                {canResend ? (
                  <form action={resendPoptavkaSubmittedConfirmationAction}>
                    <input type="hidden" name="poptavka_id" value={row.poptavka_id} />
                    <input
                      type="hidden"
                      name="redirect_to"
                      value={`/admin/klienti/${klientId}`}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Znovu odeslat potvrzení poptávky
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
