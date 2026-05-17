import { unstable_noStore as noStore } from "next/cache";
import { hashClientApprovalToken } from "@/lib/client-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDocument, type InvoiceParty } from "@/components/invoice/InvoiceDocument";
import {
  fakturacniFirmaToInvoiceParty,
  getEffectiveFakturacniFirma,
  type FakturacniFirma,
} from "@/lib/fakturacni-firmy";
import { ApprovalDecisionClient } from "./ApprovalDecisionClient";

type PageProps = {
  params: Promise<{ token: string }>;
};

type LinkRow = {
  link_id: string;
  zakazka_id: string;
  revoked_at: string | null;
  opened_at: string | null;
  open_count: number | null;
  approved_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
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
  id: string | number;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  confirmation_status: string | null;
};

type PricingProfileRow = {
  user_id: string;
  hodinovy_naklad_akce: number | string | null;
};

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

function getTechnikaName(value: TechnikaRow["skladove_polozky"]) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.nazev || "Položka techniky";
}

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

function invalidLinkView() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="rounded-3xl border border-red-500/40 bg-red-950/20 p-6 text-red-100">
        <h1 className="text-2xl font-bold">Neplatný nebo zneplatněný odkaz.</h1>
        <p className="mt-2 text-sm text-red-200">
          Požádejte prosím organizátora akce o nový odkaz na schválení zakázky.
        </p>
      </div>
    </div>
  );
}

function finalView({ approved, reason }: { approved: boolean; reason?: string | null }) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div
        className={[
          "rounded-3xl border p-6",
          approved
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100"
            : "border-amber-500/40 bg-amber-950/20 text-amber-100",
        ].join(" ")}
      >
        <h1 className="text-2xl font-bold">
          {approved ? "Zakázka už byla schválena." : "Zakázka už byla odmítnuta."}
        </h1>
        {reason ? <p className="mt-2 text-sm">Důvod: {reason}</p> : null}
      </div>
    </div>
  );
}

export default async function PublicApprovalPage({ params }: PageProps) {
  noStore();

  const { token } = await params;
  const supabase = createAdminClient();
  const tokenHash = hashClientApprovalToken(token);

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_approval_links")
    .select("link_id, zakazka_id, revoked_at, opened_at, open_count, approved_at, declined_at, declined_reason")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const link = (linkRaw ?? null) as LinkRow | null;
  if (!link || link.revoked_at) return invalidLinkView();
  if (link.approved_at) return finalView({ approved: true });
  if (link.declined_at) return finalView({ approved: false, reason: link.declined_reason });

  const now = new Date().toISOString();
  await supabase
    .from("zakazka_approval_links")
    .update({
      opened_at: link.opened_at ?? now,
      last_opened_at: now,
      open_count: (link.open_count ?? 0) + 1,
    })
    .eq("link_id", link.link_id);

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do, poznamka, klient_id, fakturacni_firma_id, cena_techniky, cena_personalu, cena_pred_slevou, cilova_cena, sleva_percent, konecna_cena")
    .eq("zakazka_id", link.zakazka_id)
    .single();

  if (zakazkaError) throw new Error(zakazkaError.message);
  const zakazka = zakazkaRaw as ZakazkaRow;

  const { data: klientRaw } = zakazka.klient_id
    ? await supabase.from("klienti").select("nazev, ico, dic, ulice, mesto, psc, email, telefon").eq("klient_id", zakazka.klient_id).maybeSingle()
    : { data: null };
  const klient = (klientRaw ?? null) as ClientRow | null;

  const { data: fakturacniFirmyRaw, error: fakturacniFirmyError } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .eq("aktivni", true)
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (fakturacniFirmyError) throw new Error(fakturacniFirmyError.message);
  const fakturacniFirmy = (fakturacniFirmyRaw ?? []) as FakturacniFirma[];
  const effectiveFakturacniFirma = getEffectiveFakturacniFirma(
    fakturacniFirmy,
    zakazka.fakturacni_firma_id
  );

  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(nazev, interni_naklad)")
    .eq("zakazka_id", zakazka.zakazka_id)
    .order("skladova_polozka_id", { ascending: true });

  if (technikaError) throw new Error(technikaError.message);
  const technika = (technikaRaw ?? []) as TechnikaRow[];
  const techPrice = technika.reduce((sum, row) => {
    const item = Array.isArray(row.skladove_polozky) ? row.skladove_polozky[0] : row.skladove_polozky;
    return sum + toNumber(row.mnozstvi) * toNumber(item?.interni_naklad);
  }, 0);

  const { data: pricingAssignmentsRaw, error: pricingAssignmentsError } = await supabase
    .from("zakazka_lide")
    .select("id, user_id, datum_od, datum_do, confirmation_status")
    .eq("zakazka_id", zakazka.zakazka_id);

  if (pricingAssignmentsError) throw new Error(pricingAssignmentsError.message);

  const pricingAssignments = ((pricingAssignmentsRaw ?? []) as PricingAssignmentRow[]).filter(
    (row) => row.confirmation_status !== "declined"
  );
  const pricingUserIds = [...new Set(pricingAssignments.map((row) => row.user_id).filter(Boolean))];
  const pricingProfilesById = new Map<string, PricingProfileRow>();

  if (pricingUserIds.length > 0) {
    const { data: pricingProfilesRaw, error: pricingProfilesError } = await supabase
      .from("profiles")
      .select("user_id, hodinovy_naklad_akce")
      .in("user_id", pricingUserIds);

    if (pricingProfilesError) throw new Error(pricingProfilesError.message);

    for (const profile of (pricingProfilesRaw ?? []) as PricingProfileRow[]) {
      pricingProfilesById.set(profile.user_id, profile);
    }
  }

  const staffPrice = pricingAssignments.reduce((sum, assignment) => {
    const hours = calculateHours(assignment.datum_od, assignment.datum_do);
    const hourlyCost = toNumber(pricingProfilesById.get(assignment.user_id)?.hodinovy_naklad_akce);
    return sum + hours * hourlyCost;
  }, 0);
  const beforeDiscount = techPrice + staffPrice;
  const finalPrice = toNumber(zakazka.cilova_cena) || beforeDiscount;
  const discountPercent = calculateDiscountPercent(beforeDiscount, finalPrice);
  const discountAmount = Math.max(beforeDiscount - finalPrice, 0);

  const { data: dotaznikRaw } = await supabase
    .from("zakazka_dotazniky")
    .select("stav, pozadovan_vyjezd_technika, rizika, submitted_at")
    .eq("zakazka_id", zakazka.zakazka_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const risks = Array.isArray(dotaznikRaw?.rizika) ? dotaznikRaw.rizika.length : 0;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-xl sm:p-8">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            WEST COUNTY
          </div>
          <h1 className="mt-2 break-words text-3xl font-black text-white">
            Schválení finální podoby zakázky
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Prosíme zkontrolujte finální podobu zakázky včetně objednávky a cenového potvrzení.
          </p>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <div><strong>Akce:</strong> {[zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka"}</div>
          <div><strong>Klient:</strong> {klient?.nazev ?? "Neuvedeno"}</div>
          <div><strong>Místo:</strong> {zakazka.misto ?? "Místo není vyplněné"}</div>
          <div><strong>Termín:</strong> {formatDateRange(zakazka)}</div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
          <h2 className="text-lg font-bold text-white">Technický plán</h2>
          {technika.length === 0 ? (
            <div className="mt-2 text-sm text-slate-400">Technický plán zatím není vyplněný.</div>
          ) : (
            <div className="mt-3 divide-y divide-slate-800">
              {technika.map((item) => (
                <div key={item.skladova_polozka_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 break-words font-semibold text-slate-100">
                    {getTechnikaName(item.skladove_polozky)}
                  </div>
                  <div className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-slate-200">
                    {item.mnozstvi ?? 0}×
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {zakazka.poznamka ? (
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <h2 className="text-lg font-bold text-white">Poznámka</h2>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">
              {zakazka.poznamka}
            </div>
          </div>
        ) : null}

        {dotaznikRaw?.submitted_at ? (
          <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 text-sm text-blue-100">
            Technické informace od klienta jsou doplněné.{" "}
            {dotaznikRaw.pozadovan_vyjezd_technika ? "Klient požádal o výjezd technika. " : ""}
            {risks > 0 ? `Technická upozornění: ${risks}.` : "Bez technických upozornění."}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-white">
          <InvoiceDocument
            data={{
              supplier: fakturacniFirmaToInvoiceParty(effectiveFakturacniFirma),
              customer: buildCustomerInvoiceParty(klient),
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
                discountPercent,
                discountAmount,
                finalPrice,
              },
            }}
          />
        </div>

        <div className="mt-5">
          <ApprovalDecisionClient token={token} />
        </div>
      </div>
    </div>
  );
}
