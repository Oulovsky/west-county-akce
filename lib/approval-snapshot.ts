import type { InvoiceDocumentData, InvoiceParty } from "@/components/invoice/InvoiceDocument";
import {
  fakturacniFirmaToInvoiceParty,
  getEffectiveFakturacniFirma,
  type FakturacniFirma,
} from "@/lib/fakturacni-firmy";

export type ApprovalSnapshotTechnikaItem = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number;
};

export type ApprovalSnapshotData = {
  version: 1;
  createdAt: string;
  zakazka: {
    zakazkaId: string;
    cisloZakazky: string | null;
    nazev: string | null;
    misto: string | null;
    termin: string;
    poznamka: string | null;
  };
  klient: InvoiceParty;
  fakturacniFirma: InvoiceParty;
  technika: ApprovalSnapshotTechnikaItem[];
  dotaznik: {
    submittedAt: string | null;
    pozadovanVyjezdTechnika: boolean;
    rizikaCount: number;
  };
  invoiceDocument: InvoiceDocumentData;
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
  cena_techniky: number | string | null;
  cena_personalu: number | string | null;
  cena_pred_slevou: number | string | null;
  cilova_cena: number | string | null;
  sleva_percent: number | string | null;
  konecna_cena: number | string | null;
};

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

type TechnikaRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
  skladove_polozky:
    | { nazev: string | null; interni_naklad: number | string | null }
    | { nazev: string | null; interni_naklad: number | string | null }[]
    | null;
};

type PricingAssignmentRow = {
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  confirmation_status: string | null;
};

type PricingProfileRow = {
  user_id: string;
  hodinovy_naklad_akce: number | string | null;
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

function formatDateRange(data: Pick<ZakazkaRow, "akce_od" | "akce_do" | "datum_od" | "datum_do">) {
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

function buildCustomerInvoiceParty(client: ClientRow | null): InvoiceParty {
  return {
    name: client?.nazev ?? null,
    ico: client?.ico ?? null,
    dic: client?.dic ?? null,
    address: formatClientAddress(client),
    email: client?.email ?? null,
    phone: client?.telefon ?? null,
  };
}

function getTechnikaItem(value: TechnikaRow["skladove_polozky"]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function buildApprovalSnapshot(supabase: any, zakazkaId: string): Promise<ApprovalSnapshotData> {
  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select(
      "zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do, poznamka, klient_id, fakturacni_firma_id, cena_techniky, cena_personalu, cena_pred_slevou, cilova_cena, sleva_percent, konecna_cena"
    )
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
  const klient = (klientRaw ?? null) as ClientRow | null;

  const { data: fakturacniFirmyRaw, error: fakturacniFirmyError } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .eq("aktivni", true)
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (fakturacniFirmyError) throw new Error(fakturacniFirmyError.message);
  const effectiveFakturacniFirma = getEffectiveFakturacniFirma(
    (fakturacniFirmyRaw ?? []) as FakturacniFirma[],
    zakazka.fakturacni_firma_id
  );

  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(nazev, interni_naklad)")
    .eq("zakazka_id", zakazkaId)
    .order("skladova_polozka_id", { ascending: true });

  if (technikaError) throw new Error(technikaError.message);
  const technika = (technikaRaw ?? []) as TechnikaRow[];
  const techPrice = technika.reduce((sum, row) => {
    const item = getTechnikaItem(row.skladove_polozky);
    return sum + toNumber(row.mnozstvi) * toNumber(item?.interni_naklad);
  }, 0);

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select("user_id, datum_od, datum_do, confirmation_status")
    .eq("zakazka_id", zakazkaId);

  if (assignmentsError) throw new Error(assignmentsError.message);
  const assignments = ((assignmentsRaw ?? []) as PricingAssignmentRow[]).filter(
    (row) => row.confirmation_status !== "declined"
  );
  const userIds = [...new Set(assignments.map((row) => row.user_id).filter(Boolean))];
  const profilesById = new Map<string, PricingProfileRow>();

  if (userIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, hodinovy_naklad_akce")
      .in("user_id", userIds);

    if (profilesError) throw new Error(profilesError.message);
    for (const profile of (profilesRaw ?? []) as PricingProfileRow[]) {
      profilesById.set(profile.user_id, profile);
    }
  }

  const staffPrice = assignments.reduce((sum, assignment) => {
    return sum + calculateHours(assignment.datum_od, assignment.datum_do) * toNumber(profilesById.get(assignment.user_id)?.hodinovy_naklad_akce);
  }, 0);
  const beforeDiscount = toNumber(zakazka.cena_pred_slevou) || techPrice + staffPrice;
  const finalPrice = toNumber(zakazka.konecna_cena) || toNumber(zakazka.cilova_cena) || beforeDiscount;
  const discountAmount = Math.max(beforeDiscount - finalPrice, 0);
  const vatPayer = effectiveFakturacniFirma?.platce_dph ?? true;
  const vatRate = vatPayer ? toNumber(effectiveFakturacniFirma?.vychozi_sazba_dph ?? 21) : 0;
  const taxBase = finalPrice;
  const vatAmount = Number(((taxBase * vatRate) / 100).toFixed(2));
  const totalWithVat = taxBase + vatAmount;
  const dateRange = formatDateRange(zakazka);
  const supplier = fakturacniFirmaToInvoiceParty(effectiveFakturacniFirma);
  const customer = buildCustomerInvoiceParty(klient);

  const { data: dotaznikRaw } = await supabase
    .from("zakazka_dotazniky")
    .select("submitted_at, pozadovan_vyjezd_technika, rizika")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const risks = Array.isArray(dotaznikRaw?.rizika) ? dotaznikRaw.rizika.length : 0;

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    zakazka: {
      zakazkaId,
      cisloZakazky: zakazka.cislo_zakazky,
      nazev: zakazka.nazev,
      misto: zakazka.misto,
      termin: dateRange,
      poznamka: zakazka.poznamka,
    },
    klient: customer,
    fakturacniFirma: supplier,
    technika: technika.map((row) => ({
      skladova_polozka_id: row.skladova_polozka_id,
      nazev: getTechnikaItem(row.skladove_polozky)?.nazev || "Položka techniky",
      mnozstvi: toNumber(row.mnozstvi),
    })),
    dotaznik: {
      submittedAt: dotaznikRaw?.submitted_at ?? null,
      pozadovanVyjezdTechnika: Boolean(dotaznikRaw?.pozadovan_vyjezd_technika),
      rizikaCount: risks,
    },
    invoiceDocument: {
      supplier,
      customer,
      order: {
        orderNumber: zakazka.cislo_zakazky,
        title: zakazka.nazev,
        place: zakazka.misto,
        dateRange,
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
    },
  };
}
