"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { fetchKlientFromAres, normalizeIco } from "@/lib/ares/klient-ares";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { portalRegisterAction } from "@/app/portal/actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Vyplňte prosím všechna povinná pole.",
  weak_password:
    "Heslo musí mít alespoň 8 znaků a splňovat požadavky zabezpečení.",
  password_mismatch: "Zadaná hesla se neshodují.",
  invalid_ico: "IČO musí mít 8 číslic.",
  already_signed_in: "Jste již přihlášeni. Odhlaste se nebo pokračujte do portálu.",
  email_exists:
    "Tento e-mail už je registrovaný. Přihlaste se, nebo použijte jiný e-mail.",
  auth_failed: "Nepodařilo se založit přihlašovací účet. Zkontrolujte e-mail a heslo.",
  client_create_failed:
    "Účet se podařilo založit, ale nepodařilo se dokončit údaje klienta. Kontaktujte nás.",
  env_missing: "Registrace není správně nakonfigurovaná. Kontaktujte nás.",
  sign_up_failed:
    "Registraci se nepodařilo dokončit. Zkuste to znovu, případně nás kontaktujte.",
  signup_failed:
    "Registraci se nepodařilo dokončit. Zkuste to znovu, případně nás kontaktujte.",
  registration_save_failed:
    "Účet se podařilo založit, ale nepodařilo se dokončit údaje klienta. Kontaktujte nás.",
};

type FormState = {
  ico: string;
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  dic: string;
  kontakt_jmeno: string;
  telefon: string;
  email: string;
  poznamka: string;
};

const emptyForm: FormState = {
  ico: "",
  nazev: "",
  ulice: "",
  mesto: "",
  psc: "",
  dic: "",
  kontakt_jmeno: "",
  telefon: "",
  email: "",
  poznamka: "",
};

function RegisterSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-60"
    >
      {pending ? "Registruji…" : "Dokončit registraci"}
    </button>
  );
}

export default function PortalRegistraceClient() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [aresSubjectJson, setAresSubjectJson] = useState("");
  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);

  useEffect(() => {
    setAresLoading(false);
  }, [errorCode]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function loadFromAres() {
    setAresLoading(true);
    setAresError(null);

    const result = await fetchKlientFromAres(form.ico);
    setAresLoading(false);

    if (!result.ok) {
      if (result.error === "invalid_ico") {
        setAresError("IČO musí mít přesně 8 číslic.");
      } else if (result.error === "not_found") {
        setAresError("ARES nenašel subjekt pro zadané IČO.");
      } else {
        setAresError("ARES je momentálně nedostupný. Vyplňte údaje ručně.");
      }
      return;
    }

    setAresSubjectJson(JSON.stringify(result.subject));
    setForm((current) => ({
      ...current,
      nazev: result.form.nazev || current.nazev,
      ico: result.form.ico || normalizeIco(current.ico),
      dic: result.form.dic || current.dic,
      ulice: result.form.ulice || current.ulice,
      mesto: result.form.mesto || current.mesto,
      psc: result.form.psc || current.psc,
    }));
  }

  return (
    <PortalShell>
      <PortalCard title="Registrace klienta">
        <p className="text-sm leading-relaxed text-slate-400">
          Po registraci je váš klientský účet aktivní okamžitě. Po zadání bude Vaše
          poptávka odeslána ke schválení a budeme Vás kontaktovat.
        </p>

        {errorCode ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.sign_up_failed}
          </p>
        ) : null}

        {aresError ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {aresError}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            formData.set("ares_subject_json", aresSubjectJson);
            await portalRegisterAction(formData);
          }}
          className="mt-6 space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">IČO *</span>
              <input
                name="ico"
                value={form.ico}
                onChange={(event) => updateField("ico", event.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadFromAres()}
                disabled={aresLoading}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60 sm:w-auto"
              >
                {aresLoading ? "Načítám ARES…" : "Načíst z ARES"}
              </button>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Název firmy *</span>
            <input
              name="nazev"
              value={form.nazev}
              onChange={(event) => updateField("nazev", event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Ulice</span>
              <input
                name="ulice"
                value={form.ulice}
                onChange={(event) => updateField("ulice", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Město</span>
              <input
                name="mesto"
                value={form.mesto}
                onChange={(event) => updateField("mesto", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">PSČ</span>
              <input
                name="psc"
                value={form.psc}
                onChange={(event) => updateField("psc", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">DIČ</span>
              <input
                name="dic"
                value={form.dic}
                onChange={(event) => updateField("dic", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Kontaktní osoba *</span>
            <input
              name="kontakt_jmeno"
              value={form.kontakt_jmeno}
              onChange={(event) => updateField("kontakt_jmeno", event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Telefon *</span>
            <input
              name="telefon"
              value={form.telefon}
              onChange={(event) => updateField("telefon", event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">E-mail *</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Heslo *</span>
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
            <span className="text-sm font-medium text-slate-300">Heslo znovu *</span>
            <input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Poznámka</span>
            <textarea
              name="poznamka"
              value={form.poznamka}
              onChange={(event) => updateField("poznamka", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2"
            />
          </label>

          <RegisterSubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Už máte účet?{" "}
          <Link href="/portal/prihlaseni" className="font-semibold text-amber-200 hover:text-amber-100">
            Přihlásit se
          </Link>
        </p>
      </PortalCard>
    </PortalShell>
  );
}
