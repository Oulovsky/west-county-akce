export type InvoiceParty = {
  name?: string | null;
  ico?: string | null;
  dic?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  bankAccount?: string | null;
};

export type InvoiceOrderInfo = {
  orderNumber?: string | null;
  title?: string | null;
  place?: string | null;
  dateRange?: string | null;
  note?: string | null;
};

export type InvoicePricing = {
  techPrice: number;
  staffPrice: number;
  beforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  vatPayer?: boolean;
  vatRate?: number;
  taxBase?: number;
  vatAmount?: number;
  totalWithVat?: number;
};

export type InvoiceMeta = {
  documentNumber?: string | null;
  variableSymbol?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  taxableSupplyAt?: string | null;
  paymentStatus?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  paidNote?: string | null;
  status?: "navrh" | "vystaveno" | "odeslano" | "stornovano" | string | null;
};

export type InvoiceDocumentData = {
  meta?: InvoiceMeta;
  supplier: InvoiceParty;
  customer: InvoiceParty;
  order: InvoiceOrderInfo;
  pricing: InvoicePricing;
};

export const DISCOUNT_TERMS =
  "Sleva je poskytnuta za předpokladu dodržení podmínek akce ze strany klienta. Pokud tyto podmínky nebudou dodrženy, vyhrazujeme si právo snížit poskytnutou slevu až do plné výše původní ceny. Pokud náklady na zajištění nedodržených podmínek původní cenu překročí, může být rozdíl doúčtován.";

function valueOrMissing(value?: string | number | null) {
  const text = String(value ?? "").trim();
  return text || "Neuvedeno";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0
  )} %`;
}

function formatDate(value?: string | null) {
  if (!value) return "Neuvedeno";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neuvedeno";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(date);
}

function getInvoiceStatusLabel(value?: string | null) {
  if (value === "stornovano") return "Stornováno";
  if (value === "vystaveno") return "Vystaveno";
  if (value === "odeslano") return "Odesláno";
  return "Návrh";
}

function getPaymentStatusLabel(value?: string | null) {
  if (value === "uhrazeno") return "Uhrazeno";
  if (value === "po_splatnosti") return "Po splatnosti";
  if (value === "stornovano") return "Stornováno";
  return "Neuhrazeno";
}

function PartyBlock({ title, party, showBank = false }: { title: string; party: InvoiceParty; showBank?: boolean }) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 text-slate-950">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-3 text-lg font-black">{valueOrMissing(party.name)}</div>
      <div className="mt-3 grid gap-1 text-sm">
        <div>IČO: {valueOrMissing(party.ico)}</div>
        <div>DIČ: {valueOrMissing(party.dic)}</div>
        <div>Adresa: {valueOrMissing(party.address)}</div>
        <div>Email: {valueOrMissing(party.email)}</div>
        <div>Telefon: {valueOrMissing(party.phone)}</div>
        {showBank ? <div>Bankovní účet: {valueOrMissing(party.bankAccount)}</div> : null}
      </div>
    </section>
  );
}

function AmountRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 py-3 last:border-b-0">
      <div className={strong ? "font-bold text-slate-950" : "text-slate-700"}>{label}</div>
      <div className={strong ? "text-right text-lg font-black text-slate-950" : "text-right font-semibold text-slate-950"}>
        {value}
      </div>
    </div>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const { meta, supplier, customer, order, pricing } = data;
  const taxBase = pricing.taxBase ?? pricing.finalPrice;
  const vatRate = pricing.vatRate ?? 0;
  const vatAmount = pricing.vatAmount ?? 0;
  const totalWithVat = pricing.totalWithVat ?? pricing.finalPrice;
  const isCancelled = meta?.status === "stornovano" || meta?.paymentStatus === "stornovano";

  return (
    <article className="invoice-document mx-auto max-w-4xl bg-white p-6 text-slate-950 shadow-xl print:shadow-none sm:p-8">
      {isCancelled ? (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-black uppercase tracking-wide text-red-700">
          Stornovaný doklad
        </div>
      ) : null}
      <header className="flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Faktura / podklad pro účetní
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {valueOrMissing(meta?.documentNumber ?? order.orderNumber)}
          </h1>
          <div className="mt-1 text-lg font-semibold text-slate-700">{valueOrMissing(order.title)}</div>
        </div>
        <div className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
          <div>Stav: {getInvoiceStatusLabel(meta?.status)}</div>
          <div>Číslo dokladu: {valueOrMissing(meta?.documentNumber)}</div>
          <div>Variabilní symbol: {valueOrMissing(meta?.variableSymbol)}</div>
          <div>Datum vystavení: {formatDate(meta?.issuedAt)}</div>
          <div>Splatnost: {formatDate(meta?.dueAt)}</div>
          <div>DUZP: {formatDate(meta?.taxableSupplyAt)}</div>
          <div>Stav úhrady: {getPaymentStatusLabel(meta?.paymentStatus)}</div>
          <div>DPH: {pricing.vatPayer === false ? "Neplátce DPH" : formatPercent(vatRate)}</div>
          <div>QR platba: Neuvedeno</div>
        </div>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PartyBlock title="Dodavatel" party={supplier} showBank />
        <PartyBlock title="Odběratel" party={customer} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-300 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Zakázka</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-800">
          <div>
            <strong>Název akce:</strong> {valueOrMissing(order.title)}
          </div>
          <div>
            <strong>Místo:</strong> {valueOrMissing(order.place)}
          </div>
          <div>
            <strong>Datum / termín:</strong> {valueOrMissing(order.dateRange)}
          </div>
          <div>
            <strong>Poznámka:</strong> {valueOrMissing(order.note)}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-300 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Položky</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <AmountRow label="Technika" value={formatMoney(pricing.techPrice)} />
          <AmountRow label="Personál" value={formatMoney(pricing.staffPrice)} />
          {pricing.discountAmount > 0 ? (
            <AmountRow
              label={`Sleva (${formatPercent(pricing.discountPercent)})`}
              value={`-${formatMoney(pricing.discountAmount)}`}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Souhrn</h2>
        <div className="mt-3">
          <AmountRow label="Cena techniky" value={formatMoney(pricing.techPrice)} />
          <AmountRow label="Cena personálu" value={formatMoney(pricing.staffPrice)} />
          <AmountRow label="Cena před slevou" value={formatMoney(pricing.beforeDiscount)} />
          <AmountRow label="Sleva" value={formatPercent(pricing.discountPercent)} />
          <AmountRow label="Sleva Kč" value={`-${formatMoney(pricing.discountAmount)}`} />
          <AmountRow label="Základ daně" value={formatMoney(taxBase)} />
          <AmountRow label={`DPH ${pricing.vatPayer === false ? "0 %" : formatPercent(vatRate)}`} value={formatMoney(vatAmount)} />
          <AmountRow label="Celkem s DPH" value={formatMoney(totalWithVat)} strong />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-300 bg-white p-5 text-sm leading-relaxed text-slate-800">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Podmínky slevy</h2>
        {DISCOUNT_TERMS}
      </section>
    </article>
  );
}
