"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { portalSignInAction } from "@/app/portal/actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vyplň e-mail a heslo.",
  invalid_credentials: "Neplatný e-mail nebo heslo.",
  email_provider_disabled:
    "Přihlašování e-mailem není v systému zapnuté. Kontaktujte správce.",
};

const PASSWORD_UPDATED_MESSAGE =
  "Heslo bylo změněno. Nyní se můžete přihlásit.";

function PortalSignInSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-60"
    >
      {pending ? "Přihlašuji…" : "Přihlásit se"}
    </button>
  );
}

export default function PortalPrihlaseniClient() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const passwordUpdated = searchParams.get("password") === "updated";
  const next = searchParams.get("next") ?? "/portal";

  return (
    <PortalShell>
      <PortalCard title="Přihlášení klienta">
        <p className="text-sm leading-relaxed text-slate-400">
          Přihlášení do klientské zóny WEST COUNTY. Interní přístup pro zaměstnance
          je na samostatné adrese a probíhá jinak.
        </p>

        {passwordUpdated ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {PASSWORD_UPDATED_MESSAGE}
          </p>
        ) : null}

        {errorCode ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode] ?? "Přihlášení se nezdařilo."}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            formData.set("next", next);
            await portalSignInAction(formData);
          }}
          className="mt-6 space-y-4"
        >
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

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Heslo</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <p className="text-right text-sm">
            <Link
              href="/portal/zapomenute-heslo"
              className="font-medium text-amber-200/90 hover:text-amber-100"
            >
              Zapomenuté heslo?
            </Link>
          </p>

          <PortalSignInSubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nemáte účet?{" "}
          <Link href="/portal/registrace" className="font-semibold text-amber-200 hover:text-amber-100">
            Registrace klienta
          </Link>
        </p>
      </PortalCard>
    </PortalShell>
  );
}
