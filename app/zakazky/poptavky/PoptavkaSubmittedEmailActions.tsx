import {
  adminReleaseKonceptPoptavkaAction,
  resendPoptavkaSubmittedConfirmationAction,
} from "@/app/zakazky/poptavky/actions";
import {
  canAdminReleaseKonceptToInbox,
  canResendPoptavkaSubmittedConfirmation,
  getPoptavkaInboxVisibility,
} from "@/lib/client-portal/poptavka-inbox-visibility";
import type { PoptavkaStav } from "@/lib/client-portal/types";

export default function PoptavkaSubmittedEmailActions({
  poptavkaId,
  stav,
  odeslanoAt,
  readOnly = false,
}: {
  poptavkaId: string;
  stav: PoptavkaStav;
  odeslanoAt: string | null;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return null;
  }

  const visibility = getPoptavkaInboxVisibility(stav, odeslanoAt);
  const canResend = canResendPoptavkaSubmittedConfirmation(stav);
  const canRelease = canAdminReleaseKonceptToInbox(stav);

  if (!canResend && !canRelease && visibility.shownInInternalInbox) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="text-lg font-semibold text-white">Potvrzovací e-mail klientovi</h2>
      {!visibility.shownInInternalInbox ? (
        <p className="mt-2 text-sm text-amber-100/90">{visibility.summary}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {canRelease ? (
          <form action={adminReleaseKonceptPoptavkaAction}>
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <button
              type="submit"
              className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-900/40"
            >
              Uvolnit koncept do inboxu a odeslat potvrzení
            </button>
          </form>
        ) : null}
        {canResend ? (
          <form action={resendPoptavkaSubmittedConfirmationAction}>
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <button
              type="submit"
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Znovu odeslat potvrzení přijetí poptávky
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
