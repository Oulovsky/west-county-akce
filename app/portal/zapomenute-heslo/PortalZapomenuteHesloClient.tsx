"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { portalRequestPasswordResetAction } from "@/app/portal/actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vyplňte e-mail.",
  env_missing: "Obnova hesla není správně nakonfigurovaná. Kontaktujte nás.",
};

const RESET_SENT_MESSAGE =
  "Pokud u nás účet s tímto e-mailem existuje, poslali jsme odkaz pro obnovu hesla.";

function ResetSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-60"
    >
      {pending ? "Odesílám…" : "Poslat odkaz pro obnovu hesla"}
    </button>
  );
}

export default function PortalZapomenuteHesloClient() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const status = searchParams.get("status");

  return (
    <PortalShell>
      <PortalCard title="Zapomenuté heslo">
        <p className="text-sm leading-relaxed text-slate-400">
          Zadejte e-mail k účtu v klientské zóně. Pošleme vám odkaz pro nastavení
          nového hesla.
        </p>

        {status === "reset_sent" ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {RESET_SENT_MESSAGE}
          </p>
        ) : null}

        {errorCode ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode] ?? "Odeslání odkazu se nezdařilo."}
          </p>
        ) : null}

        <form action={portalRequestPasswordResetAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <ResetSubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link
            href="/portal/prihlaseni"
            className="font-semibold text-amber-200 hover:text-amber-100"
          >
            Zpět na přihlášení
          </Link>
        </p>
      </PortalCard>
    </PortalShell>
  );
}
