"use client";

import { useState } from "react";
import {
  portalChangeUnverifiedEmailAction,
  portalResendEmailConfirmationAction,
  portalSignOutAction,
} from "@/app/portal/actions";
import EmailDomainHint from "@/components/portal/EmailDomainHint";

function statusMessage(status: string | undefined) {
  if (status === "resent") {
    return "Potvrzovací e-mail byl znovu odeslán.";
  }
  if (status === "email_changed") {
    return "E-mailová adresa byla změněna. Na novou adresu jsme poslali potvrzovací odkaz.";
  }
  return null;
}

function errorMessage(error: string | undefined, waitSeconds?: number) {
  if (!error) return null;
  if (error === "email_not_confirmed") {
    return "E-mail zatím není potvrzený. Zkontrolujte schránku nebo požádejte o nový odkaz.";
  }
  if (error === "rate_limited") {
    return `Počkejte prosím ${waitSeconds ?? 60} s před dalším odesláním.`;
  }
  if (error === "resend_failed") {
    return "Nepodařilo se odeslat potvrzovací e-mail. Zkuste to později.";
  }
  if (error === "missing_email") {
    return "Chybí e-mailová adresa.";
  }
  if (error === "missing_fields") {
    return "Vyplňte nový e-mail a heslo.";
  }
  if (error === "invalid_email") {
    return "Zadejte platnou e-mailovou adresu.";
  }
  if (error === "same_email") {
    return "Nová adresa je stejná jako stávající.";
  }
  if (error === "email_exists") {
    return "Tato e-mailová adresa je již používána.";
  }
  if (error === "confirmation_failed" || error === "auth_update_failed") {
    return "Nepodařilo se změnit e-mail. Zkuste to znovu.";
  }
  return "Operace se nezdařila. Zkuste to znovu.";
}

export default function PortalPotvrzeniEmailuClient({
  email,
  canChangeEmail,
  lastSentAt,
  registered,
  verified,
  status,
  error,
  waitSeconds,
}: {
  email: string;
  canChangeEmail: boolean;
  lastSentAt: string | null;
  registered?: boolean;
  verified?: boolean;
  status?: string;
  error?: string;
  waitSeconds?: number;
}) {
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const successText = statusMessage(status);
  const errorText = errorMessage(error, waitSeconds);

  return (
    <div className="mt-6 space-y-4">
      {registered ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Registrace proběhla. Nejdříve potvrďte e-mail, abyste mohli pokračovat do
          portálu.
        </p>
      ) : null}

      {verified ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          E-mail byl potvrzen. Můžete se přihlásit a pokračovat do klientské zóny.
        </p>
      ) : null}

      {successText ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {successText}
        </p>
      ) : null}

      {errorText ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorText}
        </p>
      ) : null}

      <form action={portalResendEmailConfirmationAction} className="flex flex-wrap gap-3">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
        >
          Znovu odeslat potvrzovací e-mail
        </button>
      </form>

      {lastSentAt ? (
        <p className="text-xs text-slate-500">
          Poslední odeslání:{" "}
          {new Intl.DateTimeFormat("cs-CZ", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(lastSentAt))}
        </p>
      ) : null}

      {canChangeEmail ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <button
            type="button"
            onClick={() => setShowChangeEmail((value) => !value)}
            className="text-sm font-semibold text-blue-300 hover:text-blue-200"
          >
            {showChangeEmail ? "Skrýt opravu e-mailu" : "Opravit e-mailovou adresu"}
          </button>

          {showChangeEmail ? (
            <form action={portalChangeUnverifiedEmailAction} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Nový e-mail</label>
                <input
                  name="new_email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="spravna@adresa.cz"
                />
                <EmailDomainHint email={newEmail} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  Heslo (pro ověření identity)
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                Uložit nový e-mail a odeslat potvrzení
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Pro změnu e-mailu se přihlaste účtem, u kterého registraci dokončujete.
        </p>
      )}

      {canChangeEmail ? (
        <form action={portalSignOutAction}>
          <button
            type="submit"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Odhlásit se
          </button>
        </form>
      ) : null}
    </div>
  );
}
