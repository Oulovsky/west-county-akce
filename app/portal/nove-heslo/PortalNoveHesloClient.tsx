"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { portalUpdatePasswordAction } from "@/app/portal/actions";

const ERROR_MESSAGES: Record<string, string> = {
  password_mismatch: "Zadaná hesla se neshodují.",
  weak_password: "Heslo musí mít alespoň 8 znaků.",
  reset_failed: "Heslo se nepodařilo změnit. Zkuste odkaz otevřít znovu.",
};

function UpdatePasswordSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-60"
    >
      {pending ? "Ukládám…" : "Nastavit nové heslo"}
    </button>
  );
}

type PortalNoveHesloClientProps = {
  hasSession: boolean;
};

export default function PortalNoveHesloClient({
  hasSession,
}: PortalNoveHesloClientProps) {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");

  if (!hasSession) {
    return (
      <PortalShell>
        <PortalCard title="Nové heslo">
          <p className="text-sm leading-relaxed text-slate-400">
            Odkaz pro obnovu hesla není platný nebo vypršel. Požádejte o nový odkaz.
          </p>

          <p className="mt-6 text-center text-sm text-slate-400">
            <Link
              href="/portal/zapomenute-heslo"
              className="font-semibold text-amber-200 hover:text-amber-100"
            >
              Poslat nový odkaz
            </Link>
          </p>
        </PortalCard>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PortalCard title="Nové heslo">
        <p className="text-sm leading-relaxed text-slate-400">
          Zadejte nové heslo k vašemu klientskému účtu.
        </p>

        {errorCode ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode] ?? "Heslo se nepodařilo změnit."}
          </p>
        ) : null}

        <form action={portalUpdatePasswordAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Nové heslo</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Potvrzení hesla</span>
            <input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <UpdatePasswordSubmitButton />
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
