"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  portalChangeUnverifiedEmailAction,
  portalResendEmailConfirmationAction,
  portalSignOutAction,
} from "@/app/portal/actions";
import EmailDomainHint from "@/components/portal/EmailDomainHint";
import { PortalCard } from "@/components/portal/PortalShell";
import {
  classifyEmailConfirmationHash,
  parseAuthHashTokens,
} from "@/lib/auth/auth-hash-tokens";
import { supabase } from "@/lib/supabase";

type ConfirmPhase = "idle" | "processing" | "confirmed" | "invalid";

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

function clearUrlHash() {
  if (typeof window === "undefined") return;
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );
}

function cardTitle(phase: ConfirmPhase) {
  if (phase === "processing") return "Potvrzuji e-mail…";
  if (phase === "confirmed") return "E-mail byl potvrzen";
  if (phase === "invalid") return "Odkaz je neplatný";
  return "Potvrďte svůj e-mail";
}

export default function PortalPotvrzeniEmailuClient({
  email,
  canChangeEmail,
  lastSentAt,
  registered,
  status,
  error,
  waitSeconds,
}: {
  email: string;
  canChangeEmail: boolean;
  lastSentAt: string | null;
  registered?: boolean;
  status?: string;
  error?: string;
  waitSeconds?: number;
}) {
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [phase, setPhase] = useState<ConfirmPhase>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    const tokens = parseAuthHashTokens(window.location.hash);
    const kind = classifyEmailConfirmationHash(tokens);

    async function goToPortalIfConfirmed(): Promise<boolean> {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return true;
      if (user?.email_confirmed_at) {
        setPhase("confirmed");
        clearUrlHash();
        window.location.replace("/portal");
        return true;
      }
      return false;
    }

    async function processTokens() {
      setPhase("processing");
      try {
        if (tokens.accessToken && tokens.refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          if (sessionError) {
            if (!active) return;
            setPhase("invalid");
            clearUrlHash();
            return;
          }
        }

        const confirmed = await goToPortalIfConfirmed();
        if (!active || confirmed) return;

        setPhase("invalid");
        clearUrlHash();
      } catch {
        if (!active) return;
        setPhase("invalid");
        clearUrlHash();
      }
    }

    if (kind === "error") {
      setPhase("invalid");
      clearUrlHash();
      return () => {
        active = false;
      };
    }

    if (kind === "tokens") {
      void processTokens();
      return () => {
        active = false;
      };
    }

    // Hash bez tokenů: detectSessionInUrl mohl fragment už zpracovat.
    // Pokud vznikla ověřená session, pustíme klienta do portálu.
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active || !session) return;
      await goToPortalIfConfirmed();
    })();

    return () => {
      active = false;
    };
  }, []);

  const successText = statusMessage(status);
  const errorText = errorMessage(error, waitSeconds);
  const isBusy = phase === "processing" || phase === "confirmed";

  if (isBusy) {
    return (
      <PortalCard title={cardTitle(phase)}>
        <p className="text-sm leading-relaxed text-slate-400">
          {phase === "confirmed"
            ? "E-mail byl potvrzen. Přesměrováváme vás do klientské zóny…"
            : "Potvrzujeme vaši e-mailovou adresu, počkejte prosím…"}
        </p>
      </PortalCard>
    );
  }

  return (
    <PortalCard title={cardTitle(phase)}>
      {phase === "invalid" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Potvrzovací odkaz je neplatný nebo vypršel. Pošlete si nový potvrzovací
          e-mail.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-400">
          {email ? (
            <>
              Na adresu{" "}
              <span className="font-semibold text-white">{email}</span> jsme poslali
              potvrzovací odkaz. Po kliknutí na odkaz budete moci pokračovat do
              klientské zóny.
            </>
          ) : (
            "Na zadanou e-mailovou adresu jsme poslali potvrzovací odkaz. Po kliknutí na odkaz budete moci pokračovat do klientské zóny."
          )}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {registered ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Registrace proběhla. Nejdříve potvrďte e-mail, abyste mohli pokračovat do
            portálu.
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

        <form
          action={portalResendEmailConfirmationAction}
          className="flex flex-wrap gap-3"
        >
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
              <form
                action={portalChangeUnverifiedEmailAction}
                className="mt-4 space-y-3"
              >
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Nový e-mail
                  </label>
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

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/portal/prihlaseni"
            className="text-sm text-blue-300 hover:text-blue-200"
          >
            Přihlášení
          </Link>
        </div>
      </div>
    </PortalCard>
  );
}
