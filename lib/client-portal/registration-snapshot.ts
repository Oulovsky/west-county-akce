import type { AresSubject } from "@/lib/ares/klient-ares";

export type ClientRegistrationFormSnapshot = {
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  ico: string;
  dic: string;
  telefon: string;
  email: string;
  kontakt_jmeno: string;
  poznamka: string;
};

export type ClientRegistrationSnapshot = {
  version: 1;
  aresSubject: AresSubject | null;
  form: ClientRegistrationFormSnapshot;
};

export function buildClientRegistrationSnapshot(input: {
  aresSubject: AresSubject | null;
  form: ClientRegistrationFormSnapshot;
}): ClientRegistrationSnapshot {
  return {
    version: 1,
    aresSubject: input.aresSubject,
    form: input.form,
  };
}

export function parseClientRegistrationSnapshot(
  value: unknown
): ClientRegistrationSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (!record.form || typeof record.form !== "object") return null;

  const form = record.form as Record<string, unknown>;
  return {
    version: 1,
    aresSubject: (record.aresSubject as AresSubject | null) ?? null,
    form: {
      nazev: String(form.nazev ?? ""),
      ulice: String(form.ulice ?? ""),
      mesto: String(form.mesto ?? ""),
      psc: String(form.psc ?? ""),
      ico: String(form.ico ?? ""),
      dic: String(form.dic ?? ""),
      telefon: String(form.telefon ?? ""),
      email: String(form.email ?? ""),
      kontakt_jmeno: String(form.kontakt_jmeno ?? ""),
      poznamka: String(form.poznamka ?? ""),
    },
  };
}

export function splitContactName(kontaktJmeno: string) {
  const trimmed = kontaktJmeno.trim();
  if (!trimmed) return { jmeno: null as string | null, prijmeni: null as string | null };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { jmeno: parts[0], prijmeni: null };
  }

  return {
    jmeno: parts[0],
    prijmeni: parts.slice(1).join(" "),
  };
}
