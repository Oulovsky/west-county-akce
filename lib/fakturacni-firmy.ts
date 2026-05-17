import type { InvoiceParty } from "@/components/invoice/InvoiceDocument";

export type FakturacniFirma = {
  id: string;
  nazev: string;
  ulice: string | null;
  mesto: string | null;
  psc: string | null;
  ico: string | null;
  dic: string | null;
  email: string | null;
  telefon: string | null;
  bankovni_ucet: string | null;
  iban: string | null;
  swift: string | null;
  poznamka: string | null;
  platce_dph?: boolean | null;
  vychozi_sazba_dph?: number | string | null;
  aktivni: boolean;
  vychozi: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export function formatFakturacniFirmaAddress(firma?: FakturacniFirma | null) {
  return [firma?.ulice, [firma?.psc, firma?.mesto].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export function fakturacniFirmaToInvoiceParty(firma?: FakturacniFirma | null): InvoiceParty {
  return {
    name: firma?.nazev ?? null,
    ico: firma?.ico ?? null,
    dic: firma?.dic ?? null,
    address: formatFakturacniFirmaAddress(firma),
    email: firma?.email ?? null,
    phone: firma?.telefon ?? null,
    bankAccount: firma?.bankovni_ucet || firma?.iban || null,
  };
}

export function getEffectiveFakturacniFirma(
  firmy: FakturacniFirma[],
  selectedId?: string | null
) {
  return (
    firmy.find((firma) => firma.id === selectedId) ??
    firmy.find((firma) => firma.aktivni && firma.vychozi) ??
    firmy.find((firma) => firma.aktivni) ??
    null
  );
}
