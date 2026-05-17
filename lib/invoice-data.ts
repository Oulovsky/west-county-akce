import type { InvoiceDocumentData, InvoiceMeta, InvoiceParty } from "@/components/invoice/InvoiceDocument";
import {
  fakturacniFirmaToInvoiceParty,
  getEffectiveFakturacniFirma,
  type FakturacniFirma,
} from "@/lib/fakturacni-firmy";

type ClientRow = {
  nazev: string | null;
  ico: string | null;
  dic: string | null;
  ulice: string | null;
  mesto: string | null;
  psc: string | null;
  email: string | null;
  telefon: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  poznamka: string | null;
  klient_id: string | null;
  fakturacni_firma_id: string | null;
  cilova_cena: number | string | null;
};

type TechnikaRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
  skladove_polozky:
    | { interni_naklad: number | string | null }
    | { interni_naklad: number | string | null }[]
    | null;
};

type AssignmentRow = {
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  confirmation_status: string | null;
};

type ProfileRow = {
  user_id: string;
  hodinovy_naklad_akce: number | string | null;
};

type InvoiceRow = {
  id: string;
  cislo_dokladu: string;
  variabilni_symbol?: string | null;
  stav: string;
  vystaveno_at: string | null;
  splatnost_at: string | null;
  duzp_at?: string | null;
  payment_status?: string | null;
  paid_at?: string | null;
  paid_amount?: number | string | null;
  paid_note?: string | null;
  supplier_snapshot: InvoiceParty;
  customer_snapshot: InvoiceParty;
  order_snapshot: InvoiceDocumentData["order"];
  cena_techniky: number | string | null;
  cena_personalu: number | string | null;
  cena_pred_slevou: number | string | null;
  sleva_percent: number | string | null;
  sleva_castka: number | string | null;
  konecna_cena: number | string | null;
  platce_dph?: boolean | null;
  dph_sazba?: number | string | null;
  zaklad_dane?: number | string | null;
  dph_castka?: number | string | null;
  celkem_s_dph?: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function calculateHours(from?: string | null, to?: string | null) {
  if (!from || !to) return 0;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Number(((end - start) / (1000 * 60 * 60)).toFixed(2));
}

function calculateDiscountPercent(beforeDiscount: number, finalPrice: number) {
  if (beforeDiscount <= 0) return 0;
  const discount = ((beforeDiscount - finalPrice) / beforeDiscount) * 100;
  return Number(Math.max(discount, 0).toFixed(2));
}

function formatDateRange(data: ZakazkaRow) {
  const start = data.akce_od ?? data.datum_od;
  const end = data.akce_do ?? data.datum_do;
  if (!start && !end) return "Termín není vyplněný";
  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: start?.includes("T") || end?.includes("T") ? "short" : undefined,
  });
  return [start, end]
    .filter(Boolean)
    .map((value) => formatter.format(new Date(value!)))
    .join(" – ");
}

function formatClientAddress(client: ClientRow | null) {
  return [client?.ulice, [client?.psc, client?.mesto].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function buildCustomer(client: ClientRow | null): InvoiceParty {
  return {
    name: client?.nazev ?? null,
    ico: client?.ico ?? null,
    dic: client?.dic ?? null,
    address: formatClientAddress(client),
    email: client?.email ?? null,
    phone: client?.telefon ?? null,
  };
}

export async function buildCurrentInvoiceData(supabase: any, zakazkaId: string): Promise<InvoiceDocumentData> {
  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do, poznamka, klient_id, fakturacni_firma_id, cilova_cena")
    .eq("zakazka_id", zakazkaId)
    .single();

  if (zakazkaError) throw new Error(zakazkaError.message);
  const zakazka = zakazkaRaw as ZakazkaRow;

  const { data: klientRaw } = zakazka.klient_id
    ? await supabase
        .from("klienti")
        .select("nazev, ico, dic, ulice, mesto, psc, email, telefon")
        .eq("klient_id", zakazka.klient_id)
        .maybeSingle()
    : { data: null };

  const { data: firmyRaw, error: firmyError } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .eq("aktivni", true)
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (firmyError) throw new Error(firmyError.message);
  const effectiveFirma = getEffectiveFakturacniFirma((firmyRaw ?? []) as FakturacniFirma[], zakazka.fakturacni_firma_id);
  const supplier = fakturacniFirmaToInvoiceParty(effectiveFirma);

  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(interni_naklad)")
    .eq("zakazka_id", zakazkaId);

  if (technikaError) throw new Error(technikaError.message);
  const techPrice = ((technikaRaw ?? []) as TechnikaRow[]).reduce((sum, row) => {
    const item = Array.isArray(row.skladove_polozky) ? row.skladove_polozky[0] : row.skladove_polozky;
    return sum + toNumber(row.mnozstvi) * toNumber(item?.interni_naklad);
  }, 0);

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select("user_id, datum_od, datum_do, confirmation_status")
    .eq("zakazka_id", zakazkaId);

  if (assignmentsError) throw new Error(assignmentsError.message);
  const assignments = ((assignmentsRaw ?? []) as AssignmentRow[]).filter(
    (row) => row.confirmation_status !== "declined"
  );
  const userIds = [...new Set(assignments.map((row) => row.user_id).filter(Boolean))];
  const profilesById = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, hodinovy_naklad_akce")
      .in("user_id", userIds);

    if (profilesError) throw new Error(profilesError.message);
    for (const profile of (profilesRaw ?? []) as ProfileRow[]) {
      profilesById.set(profile.user_id, profile);
    }
  }

  const staffPrice = assignments.reduce((sum, assignment) => {
    return (
      sum +
      calculateHours(assignment.datum_od, assignment.datum_do) *
        toNumber(profilesById.get(assignment.user_id)?.hodinovy_naklad_akce)
    );
  }, 0);

  const beforeDiscount = techPrice + staffPrice;
  const finalPrice = toNumber(zakazka.cilova_cena) || beforeDiscount;
  const discountAmount = Math.max(beforeDiscount - finalPrice, 0);
  const vatPayer = effectiveFirma?.platce_dph ?? true;
  const vatRate = vatPayer ? toNumber(effectiveFirma?.vychozi_sazba_dph ?? 21) : 0;
  const taxBase = finalPrice;
  const vatAmount = Number((taxBase * vatRate / 100).toFixed(2));
  const totalWithVat = taxBase + vatAmount;

  return {
    supplier,
    customer: buildCustomer((klientRaw ?? null) as ClientRow | null),
    order: {
      orderNumber: zakazka.cislo_zakazky,
      title: zakazka.nazev,
      place: zakazka.misto,
      dateRange: formatDateRange(zakazka),
      note: zakazka.poznamka,
    },
    pricing: {
      techPrice,
      staffPrice,
      beforeDiscount,
      discountPercent: calculateDiscountPercent(beforeDiscount, finalPrice),
      discountAmount,
      finalPrice,
      vatPayer,
      vatRate,
      taxBase,
      vatAmount,
      totalWithVat,
    },
  };
}

export function buildInvoiceDataFromRow(invoice: InvoiceRow): InvoiceDocumentData {
  const finalPrice = toNumber(invoice.konecna_cena);
  const taxBase = toNumber(invoice.zaklad_dane) || finalPrice;
  const vatRate = toNumber(invoice.dph_sazba);
  const vatAmount = toNumber(invoice.dph_castka);
  const totalWithVat = toNumber(invoice.celkem_s_dph) || taxBase + vatAmount;

  return {
    meta: {
      documentNumber: invoice.cislo_dokladu,
      variableSymbol: invoice.variabilni_symbol ?? invoice.cislo_dokladu.replace(/\D/g, ""),
      issuedAt: invoice.vystaveno_at,
      dueAt: invoice.splatnost_at,
      taxableSupplyAt: invoice.duzp_at ?? invoice.vystaveno_at,
      paymentStatus: invoice.payment_status,
      paidAt: invoice.paid_at,
      paidAmount: toNumber(invoice.paid_amount),
      paidNote: invoice.paid_note,
      status: invoice.stav,
    },
    supplier: invoice.supplier_snapshot ?? {},
    customer: invoice.customer_snapshot ?? {},
    order: invoice.order_snapshot ?? {},
    pricing: {
      techPrice: toNumber(invoice.cena_techniky),
      staffPrice: toNumber(invoice.cena_personalu),
      beforeDiscount: toNumber(invoice.cena_pred_slevou),
      discountPercent: toNumber(invoice.sleva_percent),
      discountAmount: toNumber(invoice.sleva_castka),
      finalPrice,
      vatPayer: invoice.platce_dph ?? true,
      vatRate,
      taxBase,
      vatAmount,
      totalWithVat,
    },
  };
}
