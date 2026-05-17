import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatQuestionnaireRiskCount,
  getQuestionnaireRiskLabel,
  isPrimaryQuestionnaireRisk,
  normalizeQuestionnaireRiskCodes,
} from "@/lib/questionnaire-risks";
import PeoplePool from "./PeoplePool";
import { combineDateAndTime } from "./helpers";
import { ZakazkaBasicLookCard } from "./components/ZakazkaBasicLookCard";
import { ZakazkaScheduleCard } from "./components/ZakazkaScheduleCard";
import { ZakazkaHeaderCard } from "./components/ZakazkaHeaderCard";
import { ZakazkaDopravaCard } from "./components/ZakazkaDopravaCard";
import { cancelZakazkaAction } from "./cancel-action";
import { HistoryTimelineCard, type TimelineEvent } from "./HistoryTimelineCard";
import {
  ZakazkaPlaceConnectionCard,
  type ExistingPlaceOption,
} from "./components/ZakazkaPlaceConnectionCard";
import {
  QuestionnairePhotoGallery,
  type QuestionnairePhotoGalleryItem,
} from "./QuestionnairePhotoGallery";
import { PricingInvoicePreview } from "./PricingInvoicePreview";
import {
  markQuestionnaireInternallyVerifiedAction,
  markQuestionnaireNotNeededAction,
  revokeClientApprovalLinkAction,
  sendClientApprovalAction,
  sendClientQuestionnaireAction,
  updateZakazkaLogisticsAction,
} from "./actions";

import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type InvoiceDocumentData, type InvoiceParty } from "@/components/invoice/InvoiceDocument";
import { FakturacniFirmaSelect } from "@/components/zakazky/FakturacniFirmaSelect";
import { buildApprovalUrl, getClientApprovalStatusLabel } from "@/lib/client-approval";
import {
  fakturacniFirmaToInvoiceParty,
  getEffectiveFakturacniFirma,
  type FakturacniFirma,
} from "@/lib/fakturacni-firmy";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { markZakazkaCriticalChangeIfApproved } from "@/lib/zakazka-critical-changes";
import {
  getWorkflowBadgeClassName,
  getWorkflowStatusLabel,
} from "@/lib/zakazka-workflow";
import { buildInvoiceDataFromRow } from "@/lib/invoice-data";
import { InvoiceActionsClient } from "./InvoiceActionsClient";
import { getApprovedMinutes, getPaymentAmount } from "@/lib/payments";
import { getTravelAmount } from "@/lib/transport";
import { getTechnikaAvailability } from "@/lib/technika-availability";
import {
  PlaceTechnicalNotesCard,
  type MistoKonaniRow,
  type PlaceTechnicalNoteAuthorRow,
  type PlaceTechnicalNoteRow,
  type PlaceTechnicalNoteZakazkaRow,
} from "@/components/mista/PlaceTechnicalNotesCard";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ technicke_overeni?: string; schvaleni?: string; approval_token?: string }>;
};

type TechnikaSummaryRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number | string;
  pozice: number | string | null;
  okruhNazev: string;
  okruhPoradi: number;
  kategorieNazev: string;
  podkategorieNazev: string;
};

type TechnikaSummaryRawRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string;
  skladove_polozky:
    | {
        nazev: string | null;
        pozice: number | string | null;
        sklad_blok_id: string | null;
        kategorie_techniky_id: string | null;
        podkategorie_techniky_id: string | null;
        interni_naklad: number | string | null;
      }
    | {
        nazev: string | null;
        pozice: number | string | null;
        sklad_blok_id: string | null;
        kategorie_techniky_id: string | null;
        podkategorie_techniky_id: string | null;
        interni_naklad: number | string | null;
      }[]
    | null;
};

type SkladBlokPlanRow = {
  sklad_blok_id: string;
  nazev: string | null;
  poradi: number | null;
};

type KategoriePlanRow = {
  kategorie_techniky_id: string;
  nazev: string | null;
};

type PodkategoriePlanRow = {
  podkategorie_techniky_id: string;
  nazev: string | null;
};

type LoadingPlanRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
};

type LoadingKusAssignmentRow = {
  id: string;
  kus_id: string;
  stav: string;
  is_rezerva: boolean | null;
};

type LoadingKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
};

type LoadingKusHistoryRow = {
  kus_id: string;
  typ_akce: string | null;
  poznamka: string | null;
  created_at: string | null;
};

type LoadingPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string | null;
  pozice: number | string | null;
  sklad_blok_id: string | null;
};

type LoadingBlokRow = {
  sklad_blok_id: string;
  nazev: string | null;
  poradi: number | null;
};

type LoadingStatusItem = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  plan: number;
  nalozeno: number;
  rezerva: number;
  vraceno: number;
  poskozeno: number;
  zbyvaNalozit: number;
  zbyvaVratit: number;
};

type LoadingStatusGroup = {
  okruhId: string;
  okruhNazev: string;
  poradi: number;
  items: LoadingStatusItem[];
  totals: Omit<LoadingStatusItem, "skladova_polozka_id" | "nazev" | "pozice">;
};

type ClientVerificationLinkRow = {
  link_id: string;
  stav: string | null;
  email_to: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
  created_at: string | null;
};

type ClientApprovalLinkRow = {
  link_id: string;
  zakazka_id: string;
  stav: string | null;
  email_to: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  approved_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  revoked_at: string | null;
  created_at: string | null;
};

type PricingData = {
  cena_techniky?: number | string | null;
  cena_personalu?: number | string | null;
  cena_pred_slevou?: number | string | null;
  cilova_cena?: number | string | null;
  sleva_percent?: number | string | null;
  konecna_cena?: number | string | null;
  pricing_updated_at?: string | null;
};

type PricingPersonAssignmentRow = {
  id: string | number;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  confirmation_status: string | null;
};

type PricingProfileRow = {
  user_id: string;
  hodinovy_naklad_akce: number | string | null;
};

type PricingPersonCostItem = {
  id: string;
  userId: string;
  hours: number;
  hourlyCost: number;
  total: number;
};

type InvoiceClientRow = {
  nazev: string | null;
  ico: string | null;
  dic: string | null;
  ulice: string | null;
  mesto: string | null;
  psc: string | null;
  email: string | null;
  telefon: string | null;
};

type ClientVerificationDotaznikRow = {
  dotaznik_id: string;
  stav: string | null;
  link_id: string | null;
  pozadovan_vyjezd_technika: boolean | null;
  rizika: unknown;
  kontakt_jmeno: string | null;
  kontakt_telefon: string | null;
  prijezd_poznamka: string | null;
  parkovani_poznamka: string | null;
  elektro_pripojka: string | null;
  elektro_jisteni: string | null;
  elektro_zasuvka: string | null;
  elektro_vzdalenost_m: number | string | null;
  odpovedi_extra: unknown;
  submitted_at: string | null;
  updated_at: string | null;
};

type ClientVerificationPhotoRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  typ: string | null;
  popis: string | null;
  original_filename: string | null;
  created_at: string | null;
};

type DeclinedAssignmentRow = {
  id: string | number;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  declined_reason: string | null;
};

type DeclinedAssignmentProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
};

type DeclinedAssignmentAlertItem = {
  id: string;
  userName: string;
  phase: string;
  timeRange: string;
  reason: string;
};

type LogisticsStatus =
  | "ceka_na_nakladku"
  | "naklada_se"
  | "nalozeno"
  | "vykladka"
  | "vraceno";

type LogisticsProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
};

type LogisticsData = {
  zakazka_id: string;
  logistika_stav?: string | null;
  nakladka_started_by?: string | null;
  nakladka_started_at?: string | null;
  nakladka_completed_by?: string | null;
  nakladka_completed_at?: string | null;
  vykladka_started_by?: string | null;
  vykladka_started_at?: string | null;
  vraceno_completed_by?: string | null;
  vraceno_completed_at?: string | null;
};

type ZakazkaHistoryRow = {
  historie_id: string;
  zakazka_id: string;
  event_type: string;
  actor_id: string | null;
  title: string;
  detail: string | null;
  metadata: unknown;
  created_at: string | null;
};

type HistoryProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
};

type AssignmentHistoryRow = {
  id: string | number;
  user_id: string;
  typ_bloku: string | null;
  datum_od: string | null;
  datum_do: string | null;
  confirmation_status: string | null;
  declined_reason: string | null;
  created_at: string | null;
  responded_at: string | null;
};

function getSkladovaPolozkaInfo(
  value: TechnikaSummaryRawRow["skladove_polozky"]
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toCount(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toOptionalPrice(value: unknown) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Cena musí být číslo 0 nebo vyšší.");
  }
  return number;
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(toCount(value));
}

function formatPercent(value: number | string | null | undefined) {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(toCount(value))} %`;
}

function calculateDiscountPercent(beforeDiscount: number, finalPrice: number) {
  if (beforeDiscount <= 0) return 0;
  const discount = ((beforeDiscount - finalPrice) / beforeDiscount) * 100;
  return Number(Math.max(discount, 0).toFixed(2));
}

function calculateHours(from?: string | null, to?: string | null) {
  if (!from || !to) return 0;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Number(((end - start) / (1000 * 60 * 60)).toFixed(2));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

function formatZakazkaDateRange(data: {
  akce_od?: string | null;
  akce_do?: string | null;
  datum_od?: string | null;
  datum_do?: string | null;
}) {
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

function formatClientAddress(client: InvoiceClientRow | null) {
  return [client?.ulice, [client?.psc, client?.mesto].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function buildCustomerInvoiceParty(client: InvoiceClientRow | null): InvoiceParty {
  return {
    name: client?.nazev ?? null,
    ico: client?.ico ?? null,
    dic: client?.dic ?? null,
    address: formatClientAddress(client),
    email: client?.email ?? null,
    phone: client?.telefon ?? null,
  };
}

function getLoadingStatusLabel({
  plan,
  aktivni,
  vraceno,
  poskozeno,
}: {
  plan: number;
  aktivni: number;
  vraceno: number;
  poskozeno: number;
}) {
  if (aktivni === 0 && vraceno > 0 && poskozeno > 0) return "Vráceno s poškozením";
  if (aktivni === 0 && vraceno > 0) return "Vráceno";
  if (aktivni === 0) return "Nenaloženo";
  if (vraceno > 0 && aktivni > 0) return "Částečně vráceno";
  if (aktivni > 0 && aktivni < plan) return "Částečně naloženo";
  if (aktivni >= plan && vraceno === 0) return "Naloženo";
  return "Částečně naloženo";
}

function formatPosition(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function getExtraAnswer(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    ? String(item)
    : null;
}

function formatChoice(value: string | null) {
  if (value === "ano") return "Ano";
  if (value === "ne") return "Ne";
  if (value === "nevim") return "Nevím";
  if (value === "technician_visit") return "Chce výjezd technika";
  if (value === "self") return "Vyplnil údaje sám";
  return value || "—";
}

function formatPhotoType(value: string | null) {
  if (value === "rozvadec") return "Rozvaděč";
  if (value === "prijezd") return "Příjezd";
  if (value === "parkovani") return "Parkování";
  if (value === "prostor") return "Prostor";
  if (value === "jina") return "Jiná";
  return "Jiná";
}

function formatAssignmentDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAssignmentRange(from: string | null, to: string | null) {
  const fromText = formatAssignmentDateTime(from);
  const toText = formatAssignmentDateTime(to);

  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

function getAssignmentPhaseLabel(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "Nakládka";
  if (raw === "stavba") return "Stavba";
  if (raw === "bourani" || raw === "bourání") return "Bourání";
  return "Provoz akce";
}

function getProfileName(profile: DeclinedAssignmentProfileRow | undefined, userId: string) {
  const name = [profile?.prijmeni, profile?.jmeno].filter(Boolean).join(" ").trim();
  return name || profile?.email || userId;
}

function normalizeLogisticsStatus(value?: string | null): LogisticsStatus {
  if (value === "naklada_se") return "naklada_se";
  if (value === "nalozeno") return "nalozeno";
  if (value === "vykladka") return "vykladka";
  if (value === "vraceno") return "vraceno";
  return "ceka_na_nakladku";
}

function getLogisticsStatusLabel(value?: string | null) {
  const status = normalizeLogisticsStatus(value);
  if (value === "zruseno") return "Zrušeno";
  if (status === "naklada_se") return "Nakládá se";
  if (status === "nalozeno") return "Naloženo";
  if (status === "vykladka") return "Probíhá vykládka";
  if (status === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
}

function formatLogisticsDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLogisticsProfileName(
  profilesById: Map<string, LogisticsProfileRow>,
  userId?: string | null
) {
  if (!userId) return "—";
  const profile = profilesById.get(userId);
  const name = [profile?.prijmeni, profile?.jmeno].filter(Boolean).join(" ").trim();
  return name || profile?.email || userId;
}

function getHistoryProfileName(
  profilesById: Map<string, HistoryProfileRow>,
  userId?: string | null
) {
  if (!userId) return "Systém";
  const profile = profilesById.get(userId);
  const name = [profile?.prijmeni, profile?.jmeno].filter(Boolean).join(" ").trim();
  return name || profile?.email || userId;
}

function getHistoryMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getHistoryTargetUserId(value: unknown) {
  const metadata = getHistoryMetadata(value);
  const targetUserId = metadata.target_user_id;
  return typeof targetUserId === "string" ? targetUserId : null;
}

function getHistoryTypeLabel(value: string) {
  if (value.startsWith("workflow_")) return "Workflow";
  if (value.startsWith("invoice_")) return "Fakturace";
  if (value.startsWith("attendance_")) return "Docházka";
  if (value.startsWith("person_")) return "Lidé";
  if (value.startsWith("logistics_")) return "Logistika";
  if (value.startsWith("scan_")) return "Scan";
  return "Zakázka";
}

function formatScanAuditUdalost(typAkce: string | null, poznamka: string | null) {
  const note = poznamka?.toLowerCase() ?? "";

  if (note.includes("náhrada") || note.includes("nahrada")) return "Použita náhrada.";
  if (note.includes("rezerva")) return "Naložena rezerva.";

  if (typAkce === "nalozeno") return "Naložen kus.";
  if (typAkce === "vraceno") return "Vrácen kus.";
  if (typAkce === "poskozeno") return "Kus označen jako poškozený.";
  if (typAkce === "blokovano") return "Kus zablokován.";

  return typAkce?.trim() || "Scan workflow událost.";
}

function createLogisticsDerivedEvent({
  id,
  date,
  actorId,
  title,
  profilesById,
}: {
  id: string;
  date?: string | null;
  actorId?: string | null;
  title: string;
  profilesById: Map<string, HistoryProfileRow>;
}): TimelineEvent | null {
  if (!date) return null;

  return {
    id,
    date,
    type: "Logistika",
    actorLabel: getHistoryProfileName(profilesById, actorId),
    title,
    detail: null,
  };
}

function LogisticsActionButton({
  zakazkaId,
  action,
  label,
  enabled,
}: {
  zakazkaId: string;
  action: string;
  label: string;
  enabled: boolean;
}) {
  return (
    <form action={updateZakazkaLogisticsAction}>
      <input type="hidden" name="zakazka_id" value={zakazkaId} />
      <input type="hidden" name="logistics_action" value={action} />
      <button
        type="submit"
        disabled={!enabled}
        className={[
          "min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
          enabled
            ? "border-blue-500/40 bg-blue-600/20 text-blue-100 hover:bg-blue-600/30"
            : "border-slate-700 bg-slate-900 text-slate-500",
        ].join(" ")}
      >
        {label}
      </button>
    </form>
  );
}

function LogisticsEventRow({
  label,
  userName,
  timestamp,
}: {
  label: string;
  userName: string;
  timestamp?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{userName}</div>
      <div className="mt-1 text-xs text-slate-400">{formatLogisticsDateTime(timestamp)}</div>
    </div>
  );
}

function LogisticsCard({
  zakazkaId,
  data,
  profilesById,
}: {
  zakazkaId: string;
  data: LogisticsData;
  profilesById: Map<string, LogisticsProfileRow>;
}) {
  const status = normalizeLogisticsStatus(data.logistika_stav);

  return (
    <Card className="mt-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">Logistika</div>
          <div className="mt-1 text-sm text-slate-400">
            Provozní stav se automaticky odvozuje ze scan workflow. Ruční akce zůstávají jako záloha.
          </div>
        </div>
        <div className="rounded-md border border-blue-500/30 bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-100">
          {getLogisticsStatusLabel(data.logistika_stav)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LogisticsEventRow
          label="Nakládku zahájil"
          userName={getLogisticsProfileName(profilesById, data.nakladka_started_by)}
          timestamp={data.nakladka_started_at}
        />
        <LogisticsEventRow
          label="Nakládku dokončil"
          userName={getLogisticsProfileName(profilesById, data.nakladka_completed_by)}
          timestamp={data.nakladka_completed_at}
        />
        <LogisticsEventRow
          label="Vykládku zahájil"
          userName={getLogisticsProfileName(profilesById, data.vykladka_started_by)}
          timestamp={data.vykladka_started_at}
        />
        <LogisticsEventRow
          label="Vrácení dokončil"
          userName={getLogisticsProfileName(profilesById, data.vraceno_completed_by)}
          timestamp={data.vraceno_completed_at}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <LogisticsActionButton
          zakazkaId={zakazkaId}
          action="start_loading"
          label="Zahájit nakládku"
          enabled={status === "ceka_na_nakladku"}
        />
        <LogisticsActionButton
          zakazkaId={zakazkaId}
          action="complete_loading"
          label="Dokončit nakládku"
          enabled={status === "naklada_se"}
        />
        <LogisticsActionButton
          zakazkaId={zakazkaId}
          action="start_unloading"
          label="Zahájit vykládku"
          enabled={status === "nalozeno"}
        />
        <LogisticsActionButton
          zakazkaId={zakazkaId}
          action="complete_return"
          label="Dokončit vrácení"
          enabled={status === "vykladka"}
        />
      </div>
    </Card>
  );
}

function getClientVerificationStatus({
  link,
  dotaznik,
}: {
  link: ClientVerificationLinkRow | null;
  dotaznik: ClientVerificationDotaznikRow | null;
}) {
  const risks = normalizeQuestionnaireRiskCodes(dotaznik?.rizika);

  if (dotaznik?.stav === "pozadovan_vyjezd_technika" || dotaznik?.pozadovan_vyjezd_technika) {
    return "Požadován výjezd technika";
  }
  if (risks.length > 0) return "Rizikové odpovědi";
  if (dotaznik?.stav === "vyplneno") return "Vyplněno klientem";
  if (dotaznik?.stav === "neni_potreba") return "Není potřeba";
  if (dotaznik?.stav === "overeno_interne") return "Ověřeno interně";
  if (link?.opened_at || link?.last_opened_at || (link?.open_count ?? 0) > 0) return "Klient otevřel";
  if (link?.email_sent_at) return "Email odeslán";
  return "Dotazník nevytvořen";
}

// Dočasné párování náhrad podle názvu plánované položky ze sklad_kus_historie.poznamka.
// Přesnější model může později nést explicitní planned_skladova_polozka_id.
function extractReplacementPlannedItemName(note: string | null | undefined) {
  const text = note ?? "";
  const marker = "Náhrada za plánovanou položku:";
  const index = text.indexOf(marker);
  if (index < 0) return null;

  const afterMarker = text.slice(index + marker.length).trim();
  const damageMarker = " Naložen poškozený/blokovaný kus:";
  return afterMarker.split(damageMarker)[0]?.trim() || null;
}

function buildReplacementPolozkaByKus(
  historyRows: LoadingKusHistoryRow[],
  planRows: LoadingPlanRow[],
  polozky: LoadingPolozkaRow[]
) {
  const plannedIds = new Set(planRows.map((row) => row.skladova_polozka_id).filter(Boolean));
  const plannedNameToId = new Map<string, string | null>();

  for (const polozka of polozky) {
    if (!plannedIds.has(polozka.skladova_polozka_id)) continue;

    const name = polozka.nazev?.trim();
    if (!name) continue;

    if (plannedNameToId.has(name)) {
      plannedNameToId.set(name, null);
    } else {
      plannedNameToId.set(name, polozka.skladova_polozka_id);
    }
  }

  const replacementByKus = new Map<string, string>();
  for (const row of historyRows) {
    if (replacementByKus.has(row.kus_id)) continue;

    const plannedName = extractReplacementPlannedItemName(row.poznamka);
    if (!plannedName) continue;

    const plannedId = plannedNameToId.get(plannedName);
    if (plannedId) replacementByKus.set(row.kus_id, plannedId);
  }

  return replacementByKus;
}

function buildLoadingStatusGroups(
  planRows: LoadingPlanRow[],
  assignments: LoadingKusAssignmentRow[],
  kusRows: LoadingKusRow[],
  polozky: LoadingPolozkaRow[],
  bloky: LoadingBlokRow[],
  replacementPolozkaByKus: Map<string, string>
): LoadingStatusGroup[] {
  const planByPolozka = new Map<string, number>();
  for (const row of planRows) {
    const polozkaId = row.skladova_polozka_id;
    if (!polozkaId) continue;
    planByPolozka.set(polozkaId, (planByPolozka.get(polozkaId) ?? 0) + toCount(row.mnozstvi));
  }

  const kusToPolozka = new Map(
    kusRows.map((row) => [row.kus_id, row.skladova_polozka_id])
  );
  const countsByPolozka = new Map<
    string,
    Pick<LoadingStatusItem, "nalozeno" | "rezerva" | "vraceno" | "poskozeno">
  >();

  for (const assignment of assignments) {
    const polozkaId = replacementPolozkaByKus.get(assignment.kus_id) ?? kusToPolozka.get(assignment.kus_id);
    if (!polozkaId) continue;

    const counts = countsByPolozka.get(polozkaId) ?? {
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
    };

    if (assignment.stav === "nalozeno") {
      counts.nalozeno += 1;
      if (assignment.is_rezerva) counts.rezerva += 1;
    } else if (assignment.stav === "vraceno") {
      counts.vraceno += 1;
    } else if (assignment.stav === "poskozeno") {
      counts.poskozeno += 1;
    }

    countsByPolozka.set(polozkaId, counts);
  }

  const polozkaIds = new Set([...planByPolozka.keys(), ...countsByPolozka.keys()]);
  const polozkaMap = new Map(polozky.map((row) => [row.skladova_polozka_id, row]));
  const blokMap = new Map(bloky.map((row) => [row.sklad_blok_id, row]));
  const groupMap = new Map<string, LoadingStatusGroup>();

  for (const polozkaId of polozkaIds) {
    const polozka = polozkaMap.get(polozkaId);
    const blok = polozka?.sklad_blok_id ? blokMap.get(polozka.sklad_blok_id) : null;
    const okruhId = blok?.sklad_blok_id ?? "__bez_okruhu";
    const okruhNazev = blok?.nazev?.trim() || "Bez okruhu";
    const counts = countsByPolozka.get(polozkaId) ?? {
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
    };
    const plan = planByPolozka.get(polozkaId) ?? 0;
    const bezRezervy = Math.max(counts.nalozeno - counts.rezerva, 0);
    const item: LoadingStatusItem = {
      skladova_polozka_id: polozkaId,
      nazev: polozka?.nazev?.trim() || polozkaId,
      pozice: polozka?.pozice ?? null,
      plan,
      nalozeno: counts.nalozeno,
      rezerva: counts.rezerva,
      vraceno: counts.vraceno,
      poskozeno: counts.poskozeno,
      zbyvaNalozit: Math.max(plan - bezRezervy, 0),
      zbyvaVratit: Math.max(counts.nalozeno + counts.poskozeno, 0),
    };

    const group = groupMap.get(okruhId) ?? {
      okruhId,
      okruhNazev,
      poradi: blok?.poradi ?? 999999,
      items: [],
      totals: {
        plan: 0,
        nalozeno: 0,
        rezerva: 0,
        vraceno: 0,
        poskozeno: 0,
        zbyvaNalozit: 0,
        zbyvaVratit: 0,
      },
    };

    group.items.push(item);
    group.totals.plan += item.plan;
    group.totals.nalozeno += item.nalozeno;
    group.totals.rezerva += item.rezerva;
    group.totals.vraceno += item.vraceno;
    group.totals.poskozeno += item.poskozeno;
    group.totals.zbyvaNalozit += item.zbyvaNalozit;
    group.totals.zbyvaVratit += item.zbyvaVratit;
    groupMap.set(okruhId, group);
  }

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const aPos = Number(a.pozice);
        const bPos = Number(b.pozice);
        if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos) {
          return aPos - bPos;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.poradi !== b.poradi) return a.poradi - b.poradi;
      return a.okruhNazev.localeCompare(b.okruhNazev, "cs");
    });
}

function LoadingMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-white">{formatCount(value)}</div>
    </div>
  );
}

function LoadingStatusCard({ groups }: { groups: LoadingStatusGroup[] }) {
  const totals = groups.reduce(
    (acc, group) => {
      acc.plan += group.totals.plan;
      acc.nalozeno += group.totals.nalozeno;
      acc.rezerva += group.totals.rezerva;
      acc.vraceno += group.totals.vraceno;
      acc.poskozeno += group.totals.poskozeno;
      acc.zbyvaNalozit += group.totals.zbyvaNalozit;
      acc.zbyvaVratit += group.totals.zbyvaVratit;
      return acc;
    },
    {
      plan: 0,
      nalozeno: 0,
      rezerva: 0,
      vraceno: 0,
      poskozeno: 0,
      zbyvaNalozit: 0,
      zbyvaVratit: 0,
    }
  );
  const loadingStatus = getLoadingStatusLabel({
    plan: totals.plan,
    aktivni: totals.nalozeno,
    vraceno: totals.vraceno,
    poskozeno: totals.poskozeno,
  });

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Stav nakládky</h2>
          <p className="mt-1 text-sm text-slate-400">
            Plán z techniky zakázky a fyzická realita ze scanů kusů.
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-white">
          {loadingStatus}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
          Zakázka zatím nemá plánovanou ani naskenovanou techniku.
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <LoadingMetric label="Plán" value={totals.plan} />
            <LoadingMetric label="Naloženo" value={totals.nalozeno} />
            <LoadingMetric label="Rezerva" value={totals.rezerva} />
            <LoadingMetric label="Vráceno" value={totals.vraceno} />
            <LoadingMetric label="Poškozeno" value={totals.poskozeno} />
            <LoadingMetric label="Zbývá naložit" value={totals.zbyvaNalozit} />
            <LoadingMetric label="Zbývá vrátit" value={totals.zbyvaVratit} />
          </div>

          <div className="mt-6 space-y-4">
            {groups.map((group) => (
              <section
                key={group.okruhId}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Okruh
                    </div>
                    <h3 className="mt-1 text-xl font-black text-white">{group.okruhNazev}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
                    <LoadingMetric label="Plán" value={group.totals.plan} />
                    <LoadingMetric label="Naloženo" value={group.totals.nalozeno} />
                    <LoadingMetric label="Chybí" value={group.totals.zbyvaNalozit} />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.items.map((item) => (
                    <div
                      key={item.skladova_polozka_id}
                      className="rounded-2xl border border-slate-800 bg-[#081225] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-lg font-black leading-tight text-white">
                            {item.nazev}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-400">
                            Pozice: {formatPosition(item.pozice)}
                          </div>
                        </div>
                        <div
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-black",
                            item.zbyvaNalozit > 0
                              ? "border-amber-700 bg-amber-950 text-amber-100"
                              : item.zbyvaVratit > 0
                                ? "border-blue-700 bg-blue-950 text-blue-100"
                                : "border-emerald-700 bg-emerald-950 text-emerald-100",
                          ].join(" ")}
                        >
                          {item.zbyvaNalozit > 0
                            ? "Chybí"
                            : item.zbyvaVratit > 0
                              ? "V oběhu"
                              : "Uzavřeno"}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        <LoadingMetric label="Plán" value={item.plan} />
                        <LoadingMetric label="Naloženo" value={item.nalozeno} />
                        <LoadingMetric label="Rezerva" value={item.rezerva} />
                        <LoadingMetric label="Vráceno" value={item.vraceno} />
                        <LoadingMetric label="Poškozeno" value={item.poskozeno} />
                        <LoadingMetric label="Zbývá naložit" value={item.zbyvaNalozit} />
                        <LoadingMetric label="Zbývá vrátit" value={item.zbyvaVratit} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function PlanTechnikyCard({ items }: { items: TechnikaSummaryRow[] }) {
  const groups = new Map<
    string,
    { okruhNazev: string; okruhPoradi: number; items: TechnikaSummaryRow[] }
  >();

  for (const item of items) {
    const key = item.okruhNazev || "Bez okruhu";
    const group = groups.get(key) ?? {
      okruhNazev: key,
      okruhPoradi: item.okruhPoradi,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const aPosition = Number(a.pozice);
        const bPosition = Number(b.pozice);
        if (Number.isFinite(aPosition) && Number.isFinite(bPosition) && aPosition !== bPosition) {
          return aPosition - bPosition;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.okruhPoradi !== b.okruhPoradi) return a.okruhPoradi - b.okruhPoradi;
      return a.okruhNazev.localeCompare(b.okruhNazev, "cs");
    });

  return (
    <Card className="mt-6">
      <h2 className="text-2xl font-black text-white">Plán techniky</h2>
      <p className="mt-1 text-sm text-slate-400">
        Čtecí přehled plánu z technika_na_zakazce. Konkrétní kusy vznikají až při loading scanu.
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
          Zakázka zatím nemá plánovanou techniku.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {sortedGroups.map((group) => (
            <section
              key={group.okruhNazev}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Okruh
              </div>
              <h3 className="mt-1 text-xl font-black text-white">{group.okruhNazev}</h3>

              <div className="mt-4 grid gap-3">
                {group.items.map((item) => (
                  <div
                    key={item.skladova_polozka_id}
                    className="rounded-2xl border border-slate-800 bg-[#081225] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-black text-white">{item.nazev}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Kategorie: {item.kategorieNazev}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Podkategorie: {item.podkategorieNazev}
                          </span>
                          <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-100">
                            Pozice: {formatPosition(item.pozice)}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-blue-800 bg-blue-950 px-4 py-3 text-2xl font-black text-blue-100">
                        {formatCount(toCount(item.mnozstvi))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClientTechnicalVerificationCard({
  zakazkaId,
  mistoId,
  statusLabel,
  link,
  dotaznik,
  photos,
  galleryPhotos,
  message,
  hasSavedPlace,
}: {
  zakazkaId: string;
  mistoId: string | null;
  statusLabel: string;
  link: ClientVerificationLinkRow | null;
  dotaznik: ClientVerificationDotaznikRow | null;
  photos: ClientVerificationPhotoRow[];
  galleryPhotos: QuestionnairePhotoGalleryItem[];
  message: "sent" | "missing_email" | "missing_resend_key" | null;
  hasSavedPlace: boolean;
}) {
  const risks = normalizeQuestionnaireRiskCodes(dotaznik?.rizika);
  const decision = getExtraAnswer(dotaznik?.odpovedi_extra, "decision");
  const lzeZajetAutem = getExtraAnswer(dotaznik?.odpovedi_extra, "lze_zajet_autem");
  const mistoZpevnene = getExtraAnswer(dotaznik?.odpovedi_extra, "misto_zpevnene");
  const elektroPripravena = getExtraAnswer(dotaznik?.odpovedi_extra, "elektro_pripravena");
  const kabelPresSilnici = getExtraAnswer(dotaznik?.odpovedi_extra, "kabel_pres_silnici");

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Technické ověření klientem</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Dotazník je volitelný podklad od klienta pro jednu zakázku. Ověřená realita z akcí patří
            dlouhodobě do interních technických poznámek místa.
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-blue-200">Stav</div>
          <div className="mt-1 text-lg font-black text-white">{statusLabel}</div>
        </div>
      </div>

      {hasSavedPlace ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          U ověřených míst může být dotazník zbytečný. Rozhodnutí ale zůstává na šéfovi.
        </div>
      ) : null}

      {message === "sent" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
          <div className="text-sm font-semibold text-emerald-100">Dotazník byl odeslán klientovi.</div>
        </div>
      ) : null}

      {message === "missing_email" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Klient nemá vyplněný email.
        </div>
      ) : null}

      {message === "missing_resend_key" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Chybí env proměnná RESEND_API_KEY.
        </div>
      ) : null}

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Email</div>
          <div className="mt-1 font-semibold text-white">{link?.email_sent_at ? "Odeslán" : "Neodeslán"}</div>
          {link?.email_to ? (
            <div className="mt-1 text-xs text-slate-500">{link.email_to}</div>
          ) : null}
          {link?.email_sent_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Odesláno: {new Date(link.email_sent_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Otevření</div>
          <div className="mt-1 font-semibold text-white">{link?.open_count ?? 0}×</div>
          {link?.last_opened_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Naposledy: {new Date(link.last_opened_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Technická upozornění</div>
          <div className="mt-1 font-semibold text-white">{formatQuestionnaireRiskCount(risks.length)}</div>
          {dotaznik?.submitted_at ? (
            <div className="mt-1 text-xs text-slate-500">
              Odesláno: {new Date(dotaznik.submitted_at).toLocaleString("cs-CZ")}
            </div>
          ) : null}
        </div>
      </div>

      {dotaznik?.submitted_at ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          <div className="mb-2 font-semibold text-white">Souhrn odpovědí</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>Rozhodnutí: {formatChoice(decision)}</div>
            <div>Výjezd technika: {dotaznik.pozadovan_vyjezd_technika ? "Ano" : "Ne"}</div>
            <div>Kontakt: {[dotaznik.kontakt_jmeno, dotaznik.kontakt_telefon].filter(Boolean).join(", ") || "—"}</div>
            <div>Příjezd autem: {formatChoice(lzeZajetAutem)}</div>
            <div>Místo zpevněné: {formatChoice(mistoZpevnene)}</div>
            <div>Elektro připraveno: {formatChoice(elektroPripravena)}</div>
            <div>Elektro: {[dotaznik.elektro_pripojka, dotaznik.elektro_jisteni, dotaznik.elektro_zasuvka].filter(Boolean).join(", ") || "—"}</div>
            <div>Vzdálenost přípojky: {dotaznik.elektro_vzdalenost_m ?? "—"} m</div>
            <div>Kabel přes silnici/průchod: {formatChoice(kabelPresSilnici)}</div>
            <div>Příjezd: {dotaznik.prijezd_poznamka || "—"}</div>
            <div>Parkování: {dotaznik.parkovani_poznamka || "—"}</div>
            <div>
              Fotky:{" "}
              {photos.length > 0
                ? `${photos.length} (${photos.map((photo) => formatPhotoType(photo.typ)).join(", ")})`
                : "—"}
            </div>
          </div>
        </div>
      ) : null}

      {dotaznik?.submitted_at ? (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div>
            <div className="font-semibold text-white">Technická upozornění</div>
            <p className="mt-1 text-sm text-slate-400">
              Automaticky vyhodnocené body z odpovědí klienta. Nejde o score, ale o konkrétní upozornění k zakázce.
            </p>
          </div>

          {risks.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100">
              Klient neuvedl žádná technická upozornění.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {risks.map((risk) => {
                const isPrimary = isPrimaryQuestionnaireRisk(risk);

                return (
                  <div
                    key={risk}
                    className={[
                      "rounded-xl border px-4 py-3 text-sm",
                      isPrimary
                        ? "border-red-500/50 bg-red-950/30 text-red-100"
                        : "border-amber-500/30 bg-amber-950/20 text-amber-100",
                    ].join(" ")}
                  >
                    <div className="font-black">{getQuestionnaireRiskLabel(risk)}</div>
                    <div className={isPrimary ? "mt-1 text-xs text-red-200" : "mt-1 text-xs text-amber-200"}>
                      {risk}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {dotaznik?.submitted_at ? (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div>
            <div className="font-semibold text-white">Fotky od klienta</div>
            <p className="mt-1 text-sm text-slate-400">
              Fotky jsou podklad jen pro tuto zakázku. Neukládají se jako dlouhodobé ověření místa.
            </p>
          </div>
          <QuestionnairePhotoGallery
            photos={galleryPhotos}
            promoteConfig={mistoId ? { zakazkaId, mistoId } : null}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={sendClientQuestionnaireAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
            Odeslat dotazník klientovi
          </button>
        </form>

        <form action={markQuestionnaireNotNeededAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
            Označit jako není potřeba
          </button>
        </form>

        <form action={markQuestionnaireInternallyVerifiedAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/60">
            Označit jako ověřeno interně
          </button>
        </form>
      </div>
    </Card>
  );
}

function ClientApprovalCard({
  zakazkaId,
  status,
  link,
  publicLink,
  message,
}: {
  zakazkaId: string;
  status?: string | null;
  link: ClientApprovalLinkRow | null;
  publicLink: string | null;
  message: "sent" | "revoked" | "missing_email" | "missing_resend_key" | null;
}) {
  const declined = status === "declined";

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Schválení klientem</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Finální souhlas s podobou zakázky. Není to technický dotazník ani fakturace.
          </p>
        </div>
        <Badge variant={status === "approved" ? "success" : declined ? "danger" : "warning"}>
          {getClientApprovalStatusLabel(status)}
        </Badge>
      </div>

      {message === "sent" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100">
          Zakázka byla odeslána klientovi ke schválení.
        </div>
      ) : null}
      {message === "revoked" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100">
          Poslední odkaz na schválení byl zneplatněn.
        </div>
      ) : null}
      {message === "missing_email" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Klient nemá vyplněný email.
        </div>
      ) : null}
      {message === "missing_resend_key" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          Chybí env proměnná RESEND_API_KEY.
        </div>
      ) : null}

      {declined ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-100">
          <div className="font-semibold">Klient odmítl finální podobu zakázky.</div>
          <div className="mt-1">{link?.declined_reason || "Důvod není vyplněný."}</div>
        </div>
      ) : null}

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Email</div>
          <div className="mt-1 font-semibold text-white">{link?.email_sent_at ? "Odeslán" : "Neodeslán"}</div>
          {link?.email_to ? <div className="mt-1 break-words text-xs text-slate-500">{link.email_to}</div> : null}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Otevření klientem</div>
          <div className="mt-1 font-semibold text-white">{link?.opened_at ? "Otevřeno" : "Zatím ne"}</div>
          {link?.opened_at ? (
            <div className="mt-1 text-xs text-slate-500">{new Date(link.opened_at).toLocaleString("cs-CZ")}</div>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Rozhodnutí</div>
          <div className="mt-1 font-semibold text-white">
            {link?.approved_at
              ? `Schváleno ${new Date(link.approved_at).toLocaleString("cs-CZ")}`
              : link?.declined_at
                ? `Odmítnuto ${new Date(link.declined_at).toLocaleString("cs-CZ")}`
                : "Čeká"}
          </div>
        </div>
      </div>

      {publicLink ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
          <div className="font-semibold">Veřejný link vytvořený při posledním odeslání</div>
          <div className="mt-1 break-all text-xs text-blue-200">{publicLink}</div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={sendClientApprovalAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
            Odeslat ke schválení
          </button>
        </form>
        {link && !link.revoked_at && !link.approved_at && !link.declined_at ? (
          <form action={revokeClientApprovalLinkAction}>
            <input type="hidden" name="zakazka_id" value={zakazkaId} />
            <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
              Zneplatnit odkaz
            </button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function PricingRecapCard({
  zakazkaId,
  pricing,
  computedTechPrice,
  computedStaffPrice,
  staffCostItems,
  invoiceBaseData,
  fakturacniFirmy,
  selectedFakturacniFirmaId,
  action,
}: {
  zakazkaId: string;
  pricing: PricingData;
  computedTechPrice: number;
  computedStaffPrice: number;
  staffCostItems: PricingPersonCostItem[];
  invoiceBaseData: Omit<InvoiceDocumentData, "pricing">;
  fakturacniFirmy: FakturacniFirma[];
  selectedFakturacniFirmaId?: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const techPrice = computedTechPrice;
  const staffPrice = computedStaffPrice;
  const beforeDiscount = techPrice + staffPrice;
  const finalPrice = toCount(pricing.cilova_cena) || beforeDiscount;
  const discountPercent = calculateDiscountPercent(beforeDiscount, finalPrice);
  const totalHours = staffCostItems.reduce((sum, item) => sum + item.hours, 0);

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Cenová rekapitulace</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Cena techniky vychází ze skladové „Ceny pro akce“. Cena personálu se počítá z hodin
            přiřazených lidí a jejich interního hodinového nákladu.
          </p>
        </div>
        <Badge variant="default">{formatMoney(finalPrice)}</Badge>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Cena techniky</div>
          <div className="mt-1 font-bold text-white">{formatMoney(techPrice)}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Cena personálu</div>
          <div className="mt-1 font-bold text-white">{formatMoney(staffPrice)}</div>
          <div className="mt-1 text-xs text-slate-400">
            {formatCount(totalHours)} h z Pokrytí práce
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Před slevou</div>
          <div className="mt-1 font-bold text-white">{formatMoney(beforeDiscount)}</div>
        </div>
        <div className="rounded-xl border border-emerald-700 bg-emerald-950/30 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-emerald-300">Po slevě</div>
          <div className="mt-1 font-bold text-white">{formatMoney(finalPrice)}</div>
          <div className="mt-1 text-xs text-emerald-200">Sleva {formatPercent(discountPercent)}</div>
        </div>
      </div>

      <form action={action} className="grid gap-4 md:grid-cols-3">
        <input type="hidden" name="zakazka_id" value={zakazkaId} />
        <input type="hidden" name="cena_techniky" value={computedTechPrice} />
        <input type="hidden" name="cena_personalu" value={computedStaffPrice} />
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">Fakturuje firma</span>
          <FakturacniFirmaSelect
            firmy={fakturacniFirmy}
            defaultValue={selectedFakturacniFirmaId}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">Cílová cena pro klienta</span>
          <input
            name="cilova_cena"
            type="number"
            min="0"
            step="1"
            defaultValue={toCount(pricing.cilova_cena) || finalPrice || ""}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
        <div className="flex items-end">
          <button className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
            Uložit cenu
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <PricingInvoicePreview
          data={{
            ...invoiceBaseData,
            pricing: {
              techPrice,
              staffPrice,
              beforeDiscount,
              discountPercent,
              discountAmount: Math.max(beforeDiscount - finalPrice, 0),
              finalPrice,
            },
          }}
        />
        <span className="text-sm text-slate-400">
          Stejný obsah je připravený pro tisk i klientské schválení.
        </span>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm leading-relaxed text-amber-100">
        Sleva je poskytnuta za předpokladu dodržení podmínek akce ze strany klienta. Pokud tyto podmínky nebudou dodrženy, vyhrazujeme si právo snížit poskytnutou slevu až do plné výše původní ceny. Pokud náklady na zajištění nedodržených podmínek původní cenu překročí, může být rozdíl doúčtován.
      </div>
    </Card>
  );
}

type RealizaceRow = {
  realizace_id: string;
  zakazka_id: string;
  nazev: string | null;
  poradi: number | string | null;
  stage_typ: string | null;
  stage_sirka: number | string | null;
  stage_hloubka: number | string | null;
  sound_typ: string | null;
  lights_typ: string | null;
  led_typ: string | null;
  led_sirka: number | string | null;
  led_vyska: number | string | null;
  led_rohy: boolean | null;
  kamery: number | string | null;
  dron: boolean | null;
};

type InvoiceRow = {
  id: string;
  cislo_dokladu: string;
  stav: string;
  vystaveno_at: string | null;
  splatnost_at: string | null;
  odeslano_at: string | null;
  email_to: string | null;
};

function WorkflowCard({
  status,
  changedAt,
  latestEvents,
}: {
  status?: string | null;
  changedAt?: string | null;
  latestEvents: TimelineEvent[];
}) {
  return (
    <Card className="mt-6 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Workflow zakázky</div>
          <p className="mt-1 text-sm text-slate-400">
            Hlavní stav sjednocuje schválení klientem, logistiku, fakturaci a archivaci.
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-1 text-xs font-bold ${getWorkflowBadgeClassName(status)}`}
        >
          {getWorkflowStatusLabel(status)}
        </span>
      </div>
      <div className="mt-4 text-sm text-slate-300">
        Poslední změna:{" "}
        {changedAt
          ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(changedAt)
            )
          : "Neuvedeno"}
      </div>
      {latestEvents.length > 0 ? (
        <div className="mt-4 space-y-2">
          {latestEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              <div className="text-sm font-semibold text-white">{event.title}</div>
              <div className="mt-1 text-xs text-slate-400">
                {new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(event.date)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function WorkflowChangePendingWarning({
  zakazkaId,
  summary,
}: {
  zakazkaId: string;
  summary?: string | null;
}) {
  return (
    <Card className="mt-6 border-amber-500/40 bg-amber-500/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xl font-black text-amber-100">
            Zakázka byla změněna po klientském schválení
          </div>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-amber-100/90">
            Zakázka byla změněna po klientském schválení a vyžaduje nové potvrzení klientem.
          </p>
          {summary ? (
            <p className="mt-2 text-sm text-amber-200">Změny: {summary}</p>
          ) : null}
        </div>
        <form action={sendClientApprovalAction}>
          <input type="hidden" name="zakazka_id" value={zakazkaId} />
          <button className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400">
            Odeslat změny klientovi ke schválení
          </button>
        </form>
      </div>
    </Card>
  );
}

type RecommendedAction = {
  title: string;
  detail: string;
  href: string;
  tone: "default" | "warning" | "danger" | "success";
};

type PreloadChecklistItem = {
  label: string;
  status: "ok" | "warning" | "danger";
  detail: string;
  href?: string;
};

function getRecommendedAction({
  workflowStatus,
  hasTechnika,
  questionnaireStatus,
  questionnaireRisks,
  hasPrice,
  approvalStatus,
  workflowChangePending,
  peopleCount,
  declinedPeopleCount,
  preloadBlockingCount,
  logisticsStatus,
  invoice,
  zakazkaId,
}: {
  workflowStatus?: string | null;
  hasTechnika: boolean;
  questionnaireStatus: string;
  questionnaireRisks: number;
  hasPrice: boolean;
  approvalStatus?: string | null;
  workflowChangePending?: boolean | null;
  peopleCount: number;
  declinedPeopleCount: number;
  preloadBlockingCount: number;
  logisticsStatus?: string | null;
  invoice: (InvoiceRow & Record<string, unknown>) | null;
  zakazkaId: string;
}): RecommendedAction {
  if (!hasTechnika) {
    return {
      title: "Doplnit techniku",
      detail: "Zakázka nemá plán techniky. Bez něj nejde spolehlivě řešit dostupnost, sklad ani cenu.",
      href: `/zakazky/${zakazkaId}/technika`,
      tone: "danger",
    };
  }

  if (questionnaireStatus === "Neodesláno") {
    return {
      title: "Odeslat dotazník klientovi",
      detail: "Technické informace od klienta ještě nejsou vyžádané.",
      href: "#technicke-overeni",
      tone: "warning",
    };
  }

  if (["Email odeslán", "Klient otevřel"].includes(questionnaireStatus)) {
    return {
      title: "Čeká se na dotazník",
      detail: "Klient má odkaz, ale technické odpovědi ještě nejsou odeslané.",
      href: "#technicke-overeni",
      tone: "warning",
    };
  }

  if (questionnaireRisks > 0 || questionnaireStatus === "Požadován výjezd technika") {
    return {
      title: "Vyřešit technická upozornění",
      detail: "Dotazník obsahuje rizika nebo požadavek na výjezd technika.",
      href: "#technicke-overeni",
      tone: "danger",
    };
  }

  if (!hasPrice) {
    return {
      title: "Doplnit cenu",
      detail: "Cenová rekapitulace zatím nemá konečnou cenu.",
      href: "#fakturace",
      tone: "warning",
    };
  }

  if (workflowChangePending) {
    return {
      title: "Řešit změny po schválení",
      detail: "Zakázka byla změněna po klientském schválení. Pošlete změny znovu klientovi nebo je vyřešte interně.",
      href: "#schvaleni-klienta",
      tone: "danger",
    };
  }

  if (workflowStatus === "navrh" && approvalStatus !== "sent_for_approval") {
    return {
      title: "Odeslat ke schválení",
      detail: "Technika a cena jsou připravené. Další krok je finální potvrzení klientem.",
      href: "#schvaleni-klienta",
      tone: "warning",
    };
  }

  if (workflowStatus === "cekani_na_schvaleni" || approvalStatus === "sent_for_approval") {
    return {
      title: "Čeká se na schválení klientem",
      detail: "Klient má schvalovací odkaz. Sledujte otevření, schválení nebo odmítnutí.",
      href: "#schvaleni-klienta",
      tone: "warning",
    };
  }

  if (peopleCount === 0) {
    return {
      title: "Doplnit lidi",
      detail: "Zakázka nemá přiřazené lidi. Bez crew nejde bezpečně připravit realizaci.",
      href: `/zakazky/${zakazkaId}/people`,
      tone: "danger",
    };
  }

  if (declinedPeopleCount > 0) {
    return {
      title: "Vyřešit odmítnuté lidi",
      detail: "Některá přiřazení byla odmítnuta. Doplňte náhradu nebo upravte plán lidí.",
      href: `/zakazky/${zakazkaId}/people`,
      tone: "warning",
    };
  }

  if (workflowStatus === "schvaleno_klientem" || workflowStatus === "priprava") {
    if (preloadBlockingCount > 0) {
      return {
        title: "Připravit nakládku",
        detail: "Před nakládkou jsou položky, které vyžadují dořešení.",
        href: "#pred-nakladkova-kontrola",
        tone: "warning",
      };
    }
    return {
      title: "Zahájit logistiku",
      detail: "Zakázka vypadá připraveně. Pokračujte do scan/nakládky.",
      href: `/zakazky/${zakazkaId}/scan`,
      tone: "success",
    };
  }

  if (workflowStatus === "dokonceno" && !invoice) {
    return {
      title: "Vystavit fakturu",
      detail: "Zakázka je dokončená a nemá vystavenou fakturu.",
      href: "#fakturace",
      tone: "warning",
    };
  }

  if (invoice && invoice.stav !== "stornovano" && invoice.stav !== "odeslano") {
    return {
      title: "Odeslat fakturu",
      detail: "Faktura je vystavená, ale ještě není odeslaná klientovi.",
      href: "#fakturace",
      tone: "warning",
    };
  }

  if (invoice && invoice.stav !== "stornovano" && invoice.payment_status !== "uhrazeno") {
    return {
      title: "Označit fakturu uhrazenou",
      detail: "Faktura čeká na úhradu nebo potvrzení úhrady.",
      href: "#fakturace",
      tone: "warning",
    };
  }

  if (workflowStatus === "fakturovano") {
    return {
      title: "Archivovat",
      detail: "Zakázka je fakturovaná. Pokud je uzavřená, můžete ji archivovat.",
      href: "#fakturace",
      tone: "success",
    };
  }

  return {
    title: logisticsStatus === "vraceno" ? "Vystavit fakturu" : "Sledovat realizaci",
    detail: logisticsStatus === "vraceno" ? "Logistika je vrácená, dalším krokem je dokončení a fakturace." : "Zakázka je v běhu. Sledujte logistiku, scan a docházku.",
    href: logisticsStatus === "vraceno" ? "#fakturace" : `/zakazky/${zakazkaId}/scan`,
    tone: "default",
  };
}

function WorkflowCockpitCard({ action }: { action: RecommendedAction }) {
  const toneClass =
    action.tone === "danger"
      ? "border-red-500/40 bg-red-500/10"
      : action.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10"
        : action.tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-blue-500/40 bg-blue-500/10";

  return (
    <Card className={`mt-6 ${toneClass}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">Další doporučená akce</div>
          <h2 className="mt-1 text-3xl font-black text-white">{action.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-200">{action.detail}</p>
        </div>
        <a
          href={action.href}
          className="inline-flex w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-600"
        >
          Otevřít další krok
        </a>
      </div>
    </Card>
  );
}

function PreloadChecklistCard({ items }: { items: PreloadChecklistItem[] }) {
  const hasDanger = items.some((item) => item.status === "danger");
  const hasWarning = items.some((item) => item.status === "warning");
  const statusLabel = hasDanger ? "Není připraveno" : hasWarning ? "Vyžaduje kontrolu" : "Připraveno";
  const statusVariant = hasDanger ? "danger" : hasWarning ? "warning" : "success";

  return (
    <div id="pred-nakladkova-kontrola">
      <Card className="mt-6 space-y-4 border-slate-700 bg-[#0b1324]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">Připraveno k nakládce</h2>
            <p className="mt-1 text-sm text-slate-400">
              Rychlá provozní kontrola před tím, než sklad začne fyzicky nakládat techniku.
            </p>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const boxClass =
              item.status === "danger"
                ? "border-red-500/40 bg-red-500/10"
                : item.status === "warning"
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10";
            const body = (
              <div className={`rounded-xl border px-4 py-3 ${boxClass}`}>
                <div className="font-black text-white">{item.label}</div>
                <div className="mt-1 text-sm text-slate-300">{item.detail}</div>
              </div>
            );
            return item.href ? (
              <a key={item.label} href={item.href} className="block transition hover:opacity-85">
                {body}
              </a>
            ) : (
              <div key={item.label}>{body}</div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function OperationalSummaryCard({
  plannedPrice,
  discountAmount,
  finalPrice,
  estimatedTechCost,
  estimatedPeopleCost,
  estimatedTransportCost,
  approvedWorkPayments,
  approvedTravelPayments,
}: {
  plannedPrice: number;
  discountAmount: number;
  finalPrice: number;
  estimatedTechCost: number;
  estimatedPeopleCost: number;
  estimatedTransportCost: number;
  approvedWorkPayments: number;
  approvedTravelPayments: number;
}) {
  const totalOperationalCost =
    estimatedTechCost + estimatedPeopleCost + estimatedTransportCost + approvedWorkPayments + approvedTravelPayments;
  const margin = finalPrice - totalOperationalCost;
  const marginPercent = finalPrice > 0 ? (margin / finalPrice) * 100 : 0;

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Provozní souhrn</h2>
          <p className="mt-1 text-sm text-slate-400">
            Interní odhad ziskovosti zakázky. Není to účetnictví ani daňový report.
          </p>
        </div>
        <Badge variant={margin >= 0 ? "success" : "danger"}>
          Marže {formatMoney(margin)} ({formatPercent(marginPercent)})
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Plánovaná cena</div>
          <div className="mt-1 text-lg font-black text-white">{formatMoney(plannedPrice)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Sleva</div>
          <div className="mt-1 text-lg font-black text-amber-100">{formatMoney(discountAmount)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Konečná cena</div>
          <div className="mt-1 text-lg font-black text-emerald-100">{formatMoney(finalPrice)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Orientační náklady</div>
          <div className="mt-1 text-lg font-black text-red-100">{formatMoney(totalOperationalCost)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Odhad techniky</div>
          <div className="mt-1 font-bold text-slate-100">{formatMoney(estimatedTechCost)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Odhad lidí</div>
          <div className="mt-1 font-bold text-slate-100">{formatMoney(estimatedPeopleCost)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Odhad dopravy</div>
          <div className="mt-1 font-bold text-slate-100">{formatMoney(estimatedTransportCost)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Schválené proplacení</div>
          <div className="mt-1 font-bold text-slate-100">
            Práce {formatMoney(approvedWorkPayments)} · Cesty {formatMoney(approvedTravelPayments)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InvoiceCard({
  zakazkaId,
  invoice,
  previewData,
}: {
  zakazkaId: string;
  invoice: (InvoiceRow & Record<string, unknown>) | null;
  previewData: InvoiceDocumentData | null;
}) {
  const printHref = invoice ? `/zakazky/${zakazkaId}/faktura/${invoice.id}/print` : null;
  const pdfHref = invoice ? `/zakazky/${zakazkaId}/faktura/${invoice.id}/pdf` : null;
  const exportHref = invoice ? `/admin/faktury/export?invoice_id=${invoice.id}` : null;
  const paymentStatus = String(invoice?.payment_status ?? "neuhrazeno");
  const paymentStatusLabel =
    paymentStatus === "uhrazeno"
      ? "Uhrazeno"
      : paymentStatus === "po_splatnosti"
        ? "Po splatnosti"
        : paymentStatus === "stornovano"
          ? "Stornováno"
          : "Neuhrazeno";
  const invoiceStatusLabel =
    invoice?.stav === "stornovano"
      ? "Stornováno"
      : invoice?.stav === "odeslano"
        ? "Odesláno"
        : invoice?.stav === "vystaveno"
          ? "Vystaveno"
          : "Návrh";

  return (
    <Card className="mt-6 space-y-4 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold text-white">Faktura</div>
          <p className="mt-1 text-sm text-slate-400">
            Vystavení uloží snapshot dodavatele, odběratele, zakázky i ceny.
          </p>
        </div>
        <Badge variant="default">{invoice ? invoice.cislo_dokladu : "Neuvedeno"}</Badge>
      </div>

      {invoice ? (
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stav</div>
            <div className="mt-1 font-bold text-white">{invoiceStatusLabel}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Vystaveno</div>
            <div className="mt-1 font-bold text-white">
              {invoice.vystaveno_at
                ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(invoice.vystaveno_at))
                : "Neuvedeno"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Splatnost</div>
            <div className="mt-1 font-bold text-white">
              {invoice.splatnost_at
                ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(invoice.splatnost_at))
                : "Neuvedeno"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Email</div>
            <div className="mt-1 font-bold text-white">{invoice.email_to ?? "Neuvedeno"}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stav úhrady</div>
            <div className="mt-1 font-bold text-white">{paymentStatusLabel}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Variabilní symbol</div>
            <div className="mt-1 font-bold text-white">{String(invoice.variabilni_symbol ?? "Neuvedeno")}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">DUZP</div>
            <div className="mt-1 font-bold text-white">
              {invoice.duzp_at
                ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(String(invoice.duzp_at)))
                : "Neuvedeno"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Celkem s DPH</div>
            <div className="mt-1 font-bold text-white">{formatMoney(invoice.celkem_s_dph as number | string | null)}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">DPH rekapitulace</div>
            <div className="mt-1 font-bold text-white">
              Základ {formatMoney(invoice.zaklad_dane as number | string | null)} · DPH{" "}
              {invoice.platce_dph === false ? "0 %" : formatPercent(invoice.dph_sazba as number | string | null)}{" "}
              {formatMoney(invoice.dph_castka as number | string | null)}
            </div>
            {invoice.paid_at ? (
              <div className="mt-1 text-xs text-slate-400">
                Uhrazeno{" "}
                {new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(String(invoice.paid_at)))} ·{" "}
                {formatMoney(invoice.paid_amount as number | string | null)}
                {invoice.paid_note ? ` · ${invoice.paid_note}` : ""}
              </div>
            ) : null}
            {invoice.storno_reason ? (
              <div className="mt-1 text-xs text-red-200">Storno: {String(invoice.storno_reason)}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Faktura zatím není vystavená.
        </div>
      )}

      <InvoiceActionsClient
        zakazkaId={zakazkaId}
        invoiceId={invoice?.id ?? null}
        printHref={printHref}
        pdfHref={pdfHref}
      />

      {exportHref ? (
        <a
          href={exportHref}
          className="inline-flex w-fit rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
        >
          Export pro účetní CSV
        </a>
      ) : null}

      {previewData ? (
        <div className="flex flex-wrap items-center gap-3">
          <PricingInvoicePreview data={previewData} />
          <span className="text-sm text-slate-400">
            Náhled používá stejný InvoiceDocument jako klient, tisk a PDF.
          </span>
        </div>
      ) : null}
    </Card>
  );
}

export default async function ZakazkaDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  async function updateZakazkaSchedule(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const akceOd = combineDateAndTime(
      String(formData.get("akce_od_datum") ?? ""),
      String(formData.get("akce_od_cas") ?? "")
    );

    const akceDo = combineDateAndTime(
      String(formData.get("akce_do_datum") ?? ""),
      String(formData.get("akce_do_cas") ?? "")
    );

    if (!akceOd || !akceDo) {
      throw new Error("Vyplň začátek a konec akce.");
    }

    const { error } = await supabase
      .from("zakazky")
      .update({
        akce_od: akceOd,
        akce_do: akceDo,
      })
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(error.message);
    }

    const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
      zakazkaId: id,
      actorId: user?.id ?? null,
      changes: ["termin"],
      detail: "Změněn termín akce po klientském schválení.",
      metadata: { akce_od: akceOd, akce_do: akceDo },
    });
    if (!changeResult.ok) throw new Error(changeResult.error);

    revalidatePath(`/zakazky/${id}`);
    revalidatePath("/zakazky");
    revalidatePath("/kalendar");
    revalidatePath("/kalendar/lide");
  }

  async function updateZakazkaPricing(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const zakazkaId = String(formData.get("zakazka_id") ?? "").trim();
    const fakturacniFirmaId = String(formData.get("fakturacni_firma_id") ?? "").trim() || null;
    if (!zakazkaId) throw new Error("Chybí ID zakázky.");

    const techPrice = toOptionalPrice(formData.get("cena_techniky")) ?? 0;
    const staffPrice = toOptionalPrice(formData.get("cena_personalu")) ?? 0;
    const beforeDiscount = techPrice + staffPrice;
    const targetPrice = toOptionalPrice(formData.get("cilova_cena"));
    const finalPrice = targetPrice ?? beforeDiscount;
    const discountPercent = calculateDiscountPercent(beforeDiscount, finalPrice);

    const { error } = await supabase
      .from("zakazky")
      .update({
        cena_techniky: techPrice,
        cena_personalu: staffPrice,
        cena_pred_slevou: beforeDiscount,
        cilova_cena: targetPrice,
        sleva_percent: discountPercent,
        konecna_cena: finalPrice,
        fakturacni_firma_id: fakturacniFirmaId,
        pricing_updated_at: new Date().toISOString(),
      })
      .eq("zakazka_id", zakazkaId);

    if (error) throw new Error(error.message);

    const criticalChanges = [
      "cena_techniky",
      "cena_personalu",
      "sleva",
      "konecna_cena",
      "fakturacni_firma",
    ] as const;
    const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
      zakazkaId,
      actorId: user?.id ?? null,
      changes: [...criticalChanges],
      detail: "Změněna cenová rekapitulace nebo fakturační firma po klientském schválení.",
      metadata: {
        cena_techniky: techPrice,
        cena_personalu: staffPrice,
        sleva_percent: discountPercent,
        konecna_cena: finalPrice,
        fakturacni_firma_id: fakturacniFirmaId,
      },
    });
    if (!changeResult.ok) throw new Error(changeResult.error);

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "pricing_updated",
      actorId: user?.id ?? null,
      title: "Cenová rekapitulace zakázky byla upravena.",
      detail: `Cena před slevou: ${formatMoney(beforeDiscount)}. Konečná cena: ${formatMoney(finalPrice)}. Sleva: ${formatPercent(discountPercent)}.`,
      metadata: {
        cena_techniky: techPrice,
        cena_personalu: staffPrice,
        cena_pred_slevou: beforeDiscount,
        cilova_cena: targetPrice,
        sleva_percent: discountPercent,
        konecna_cena: finalPrice,
      },
    });

    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
  }

  const { data, error } = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", id)
    .single();

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  if (!data) {
    return <div>Zakázka nenalezena</div>;
  }

  const { data: invoiceRaw, error: invoiceError } = await supabase
    .from("zakazka_faktury")
    .select("*")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invoiceError) {
    return <div>Chyba faktury: {invoiceError.message}</div>;
  }

  const latestInvoice = (invoiceRaw ?? null) as (InvoiceRow & Record<string, unknown>) | null;

  const logisticsUserIds = [
    ...new Set(
      [
        data.nakladka_started_by,
        data.nakladka_completed_by,
        data.vykladka_started_by,
        data.vraceno_completed_by,
      ].filter(Boolean)
    ),
  ] as string[];
  let logisticsProfilesById = new Map<string, LogisticsProfileRow>();

  if (logisticsUserIds.length > 0) {
    const { data: logisticsProfilesRaw, error: logisticsProfilesError } = await supabase
      .from("profiles")
      .select("user_id, email, jmeno, prijmeni")
      .in("user_id", logisticsUserIds);

    if (logisticsProfilesError) {
      return <div>Chyba profilů logistiky: {logisticsProfilesError.message}</div>;
    }

    logisticsProfilesById = new Map(
      ((logisticsProfilesRaw ?? []) as LogisticsProfileRow[]).map((profile) => [
        profile.user_id,
        profile,
      ])
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let mistoKonani: MistoKonaniRow | null = null;
  let mistoTechnickePoznamky: PlaceTechnicalNoteRow[] = [];
  let noteAuthorsById = new Map<string, PlaceTechnicalNoteAuthorRow>();
  let noteZakazkyById = new Map<string, PlaceTechnicalNoteZakazkaRow>();
  let existingPlacesForLink: ExistingPlaceOption[] = [];

  if (data.misto_id) {
    const { data: mistoRaw, error: mistoError } = await supabase
      .from("mista_konani")
      .select("misto_id, nazev, adresa_text")
      .eq("misto_id", data.misto_id)
      .maybeSingle();

    if (mistoError) {
      return <div>Chyba místa konání: {mistoError.message}</div>;
    }

    mistoKonani = (mistoRaw ?? null) as MistoKonaniRow | null;

    const { data: notesRaw, error: notesError } = await supabase
      .from("misto_technicke_poznamky")
      .select("id, misto_id, zakazka_id, autor_id, typ, text, dulezite, created_at, updated_at")
      .eq("misto_id", data.misto_id)
      .order("dulezite", { ascending: false })
      .order("created_at", { ascending: false });

    if (notesError) {
      return <div>Chyba technických poznámek místa: {notesError.message}</div>;
    }

    mistoTechnickePoznamky = (notesRaw ?? []) as PlaceTechnicalNoteRow[];

    const authorIds = [
      ...new Set(mistoTechnickePoznamky.map((note) => note.autor_id).filter(Boolean)),
    ] as string[];

    if (authorIds.length > 0) {
      const { data: authorsRaw, error: authorsError } = await supabase
        .from("profiles")
        .select("user_id, email, jmeno, prijmeni")
        .in("user_id", authorIds);

      if (authorsError) {
        return <div>Chyba autorů poznámek: {authorsError.message}</div>;
      }

      noteAuthorsById = new Map(
        ((authorsRaw ?? []) as PlaceTechnicalNoteAuthorRow[]).map((author) => [author.user_id, author])
      );
    }

    const noteZakazkaIds = [
      ...new Set(
        mistoTechnickePoznamky
          .map((note) => note.zakazka_id)
          .filter((zakazkaId): zakazkaId is string => Boolean(zakazkaId && zakazkaId !== id))
      ),
    ];

    if (noteZakazkaIds.length > 0) {
      const { data: noteZakazkyRaw, error: noteZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, cislo_zakazky, nazev")
        .in("zakazka_id", noteZakazkaIds);

      if (noteZakazkyError) {
        return <div>Chyba vazeb poznámek na zakázky: {noteZakazkyError.message}</div>;
      }

      noteZakazkyById = new Map(
        ((noteZakazkyRaw ?? []) as PlaceTechnicalNoteZakazkaRow[]).map((zakazka) => [
          zakazka.zakazka_id,
          zakazka,
        ])
      );
    }
  } else {
    const { data: placesRaw, error: placesError } = await supabase
      .from("mista_konani")
      .select("misto_id, nazev, adresa_text, klient_id")
      .eq("aktivni", true)
      .order("nazev", { ascending: true });

    if (placesError) {
      return <div>Chyba seznamu míst: {placesError.message}</div>;
    }

    existingPlacesForLink = (placesRaw ?? []) as ExistingPlaceOption[];
  }

  const { data: declinedAssignmentsRaw, error: declinedAssignmentsError } = await supabase
    .from("zakazka_lide")
    .select("id, user_id, datum_od, datum_do, typ_bloku, declined_reason")
    .eq("zakazka_id", id)
    .eq("confirmation_status", "declined")
    .order("datum_od", { ascending: true, nullsFirst: false });

  if (declinedAssignmentsError) {
    return <div>Chyba odmítnutých přiřazení: {declinedAssignmentsError.message}</div>;
  }

  const declinedAssignments = (declinedAssignmentsRaw ?? []) as DeclinedAssignmentRow[];
  const declinedUserIds = [
    ...new Set(declinedAssignments.map((assignment) => assignment.user_id).filter(Boolean)),
  ];
  let declinedProfilesById = new Map<string, DeclinedAssignmentProfileRow>();

  if (declinedUserIds.length > 0) {
    const { data: declinedProfilesRaw, error: declinedProfilesError } = await supabase
      .from("profiles")
      .select("user_id, email, jmeno, prijmeni")
      .in("user_id", declinedUserIds);

    if (declinedProfilesError) {
      return <div>Chyba profilů odmítnutých lidí: {declinedProfilesError.message}</div>;
    }

    declinedProfilesById = new Map(
      ((declinedProfilesRaw ?? []) as DeclinedAssignmentProfileRow[]).map((profile) => [
        profile.user_id,
        profile,
      ])
    );
  }

  const declinedAssignmentAlerts: DeclinedAssignmentAlertItem[] = declinedAssignments.map(
    (assignment) => ({
      id: String(assignment.id),
      userName: getProfileName(declinedProfilesById.get(assignment.user_id), assignment.user_id),
      phase: getAssignmentPhaseLabel(assignment.typ_bloku),
      timeRange: formatAssignmentRange(assignment.datum_od, assignment.datum_do),
      reason: assignment.declined_reason?.trim() || "Důvod není vyplněný.",
    })
  );

  const { data: historyRaw, error: historyError } = await supabase
    .from("zakazka_historie")
    .select("historie_id, zakazka_id, event_type, actor_id, title, detail, metadata, created_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (historyError) {
    return <div>Chyba provozní historie: {historyError.message}</div>;
  }

  const historyRows = (historyRaw ?? []) as ZakazkaHistoryRow[];

  const { data: assignmentHistoryRaw, error: assignmentHistoryError } = await supabase
    .from("zakazka_lide")
    .select("id, user_id, typ_bloku, datum_od, datum_do, confirmation_status, declined_reason, created_at, responded_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false });

  if (assignmentHistoryError) {
    return <div>Chyba historie lidí: {assignmentHistoryError.message}</div>;
  }

  const assignmentHistory = (assignmentHistoryRaw ?? []) as AssignmentHistoryRow[];

  const { data: scanHistoryRaw, error: scanHistoryError } = await supabase
    .from("sklad_kus_historie")
    .select("historie_id, typ_akce, poznamka, created_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (scanHistoryError) {
    return <div>Chyba scan historie: {scanHistoryError.message}</div>;
  }

  const historyUserIds = [
    ...new Set(
      [
        ...historyRows.map((row) => row.actor_id),
        ...historyRows.map((row) => getHistoryTargetUserId(row.metadata)),
        ...assignmentHistory.map((row) => row.user_id),
        data.nakladka_started_by,
        data.nakladka_completed_by,
        data.vykladka_started_by,
        data.vraceno_completed_by,
      ].filter(Boolean)
    ),
  ] as string[];
  let historyProfilesById = new Map<string, HistoryProfileRow>();

  if (historyUserIds.length > 0) {
    const { data: historyProfilesRaw, error: historyProfilesError } = await supabase
      .from("profiles")
      .select("user_id, email, jmeno, prijmeni")
      .in("user_id", historyUserIds);

    if (historyProfilesError) {
      return <div>Chyba profilů historie: {historyProfilesError.message}</div>;
    }

    historyProfilesById = new Map(
      ((historyProfilesRaw ?? []) as HistoryProfileRow[]).map((profile) => [
        profile.user_id,
        profile,
      ])
    );
  }

  const centralTimelineEvents: TimelineEvent[] = historyRows
    .filter((row) => Boolean(row.created_at))
    .map((row) => {
      const targetUserId = getHistoryTargetUserId(row.metadata);
      const targetLabel = targetUserId ? getHistoryProfileName(historyProfilesById, targetUserId) : null;

      return {
        id: `history-${row.historie_id}`,
        date: row.created_at as string,
        type: getHistoryTypeLabel(row.event_type),
        actorLabel: getHistoryProfileName(historyProfilesById, row.actor_id),
        title: targetLabel ? `${row.title} (${targetLabel})` : row.title,
        detail: row.detail,
      };
    });

  const hasCentralLogisticsEvent = new Set(
    historyRows.filter((row) => row.event_type.startsWith("logistics_")).map((row) => row.event_type)
  );
  const derivedLogisticsEvents = [
    !hasCentralLogisticsEvent.has("logistics_start_loading")
      ? createLogisticsDerivedEvent({
          id: "logistics-start-loading",
          date: data.nakladka_started_at,
          actorId: data.nakladka_started_by,
          title: "Zahájena nakládka.",
          profilesById: historyProfilesById,
        })
      : null,
    !hasCentralLogisticsEvent.has("logistics_complete_loading")
      ? createLogisticsDerivedEvent({
          id: "logistics-complete-loading",
          date: data.nakladka_completed_at,
          actorId: data.nakladka_completed_by,
          title: "Nakládka dokončena.",
          profilesById: historyProfilesById,
        })
      : null,
    !hasCentralLogisticsEvent.has("logistics_start_unloading")
      ? createLogisticsDerivedEvent({
          id: "logistics-start-unloading",
          date: data.vykladka_started_at,
          actorId: data.vykladka_started_by,
          title: "Zahájena vykládka.",
          profilesById: historyProfilesById,
        })
      : null,
    !hasCentralLogisticsEvent.has("logistics_complete_return")
      ? createLogisticsDerivedEvent({
          id: "logistics-complete-return",
          date: data.vraceno_completed_at,
          actorId: data.vraceno_completed_by,
          title: "Vrácení dokončeno.",
          profilesById: historyProfilesById,
        })
      : null,
  ].filter((event): event is TimelineEvent => Boolean(event));

  const centralAssignmentIds = new Set(
    historyRows
      .map((row) => getHistoryMetadata(row.metadata).assignment_id)
      .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
      .map(String)
  );
  const assignmentTimelineEvents = assignmentHistory.flatMap((assignment) => {
    if (centralAssignmentIds.has(String(assignment.id))) return [];

    const events: TimelineEvent[] = [];
    const userName = getHistoryProfileName(historyProfilesById, assignment.user_id);
    const phase = getAssignmentPhaseLabel(assignment.typ_bloku);

    if (assignment.created_at) {
      events.push({
        id: `assignment-created-${assignment.id}`,
        date: assignment.created_at,
        type: "Lidé",
        actorLabel: "Systém",
        title: `Přidán člověk: ${userName} → ${phase}.`,
        detail: formatAssignmentRange(assignment.datum_od, assignment.datum_do),
      });
    }

    if (assignment.responded_at) {
      const status = String(assignment.confirmation_status ?? "");
      events.push({
        id: `assignment-response-${assignment.id}`,
        date: assignment.responded_at,
        type: "Lidé",
        actorLabel: userName,
        title:
          status === "accepted"
            ? "Potvrzuje účast."
            : status === "declined"
              ? "Odmítl účast."
              : "Stav účasti změněn.",
        detail: status === "declined" && assignment.declined_reason ? `Důvod: ${assignment.declined_reason}` : phase,
      });
    }

    return events;
  });

  const scanTimelineEvents: TimelineEvent[] = ((scanHistoryRaw ?? []) as Array<{
    historie_id: string;
    typ_akce: string | null;
    poznamka: string | null;
    created_at: string | null;
  }>)
    .filter((row) => Boolean(row.created_at))
    .map((row) => ({
      id: `scan-${row.historie_id}`,
      date: row.created_at as string,
      type: "Scan",
      actorLabel: "Scan workflow",
      title: formatScanAuditUdalost(row.typ_akce, row.poznamka),
      detail: row.poznamka,
    }));

  const createdAt = (data as { created_at?: string | null }).created_at;
  const createdTimelineEvent: TimelineEvent[] = createdAt
    ? [
        {
          id: "zakazka-created",
          date: createdAt,
          type: "Zakázka",
          actorLabel: "Systém",
          title: "Zakázka vytvořena.",
          detail: null,
        },
      ]
    : [];

  const timelineEvents = [
    ...createdTimelineEvent,
    ...centralTimelineEvents,
    ...derivedLogisticsEvents,
    ...assignmentTimelineEvents,
    ...scanTimelineEvents,
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { data: dotaznikRaw, error: dotaznikError } = await supabase
    .from("zakazka_dotazniky")
    .select(
      "dotaznik_id, stav, link_id, pozadovan_vyjezd_technika, rizika, kontakt_jmeno, kontakt_telefon, prijezd_poznamka, parkovani_poznamka, elektro_pripojka, elektro_jisteni, elektro_zasuvka, elektro_vzdalenost_m, odpovedi_extra, submitted_at, updated_at"
    )
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dotaznikError) {
    return <div>Chyba dotazníku: {dotaznikError.message}</div>;
  }

  const dotaznik = (dotaznikRaw ?? null) as ClientVerificationDotaznikRow | null;

  let dotaznikPhotos: ClientVerificationPhotoRow[] = [];
  let dotaznikGalleryPhotos: QuestionnairePhotoGalleryItem[] = [];
  if (dotaznik?.dotaznik_id) {
    const { data: photosRaw, error: photosError } = await supabase
      .from("dotaznik_fotky")
      .select("id, storage_bucket, storage_path, typ, popis, original_filename, created_at")
      .eq("dotaznik_odpoved_id", dotaznik.dotaznik_id)
      .order("poradi", { ascending: true })
      .order("created_at", { ascending: true });

    if (photosError) {
      return <div>Chyba fotek dotazníku: {photosError.message}</div>;
    }

    dotaznikPhotos = (photosRaw ?? []) as ClientVerificationPhotoRow[];
    const adminSupabase = createAdminClient();

    dotaznikGalleryPhotos = await Promise.all(
      dotaznikPhotos.map(async (photo) => {
        const { data: signedUrlData } = await adminSupabase.storage
          .from(photo.storage_bucket)
          .createSignedUrl(photo.storage_path, 60 * 60);

        return {
          id: photo.id,
          signedUrl: signedUrlData?.signedUrl ?? null,
          typ: photo.typ,
          popis: photo.popis,
          originalFilename: photo.original_filename,
          createdAt: photo.created_at,
        };
      })
    );
  }

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_client_links")
    .select("link_id, stav, email_to, email_sent_at, opened_at, last_opened_at, open_count, created_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) {
    return <div>Chyba linku dotazníku: {linkError.message}</div>;
  }

  const clientVerificationLink = (linkRaw ?? null) as ClientVerificationLinkRow | null;
  const clientVerificationStatus = getClientVerificationStatus({
    link: clientVerificationLink,
    dotaznik,
  });
  const technicalVerificationMessage =
    resolvedSearchParams?.technicke_overeni === "sent" ||
    resolvedSearchParams?.technicke_overeni === "missing_email" ||
    resolvedSearchParams?.technicke_overeni === "missing_resend_key"
      ? resolvedSearchParams.technicke_overeni
      : null;

  const { data: approvalLinkRaw, error: approvalLinkError } = await supabase
    .from("zakazka_approval_links")
    .select("link_id, zakazka_id, stav, email_to, email_sent_at, opened_at, approved_at, declined_at, declined_reason, revoked_at, created_at")
    .eq("zakazka_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalLinkError) {
    return <div>Chyba schválení klientem: {approvalLinkError.message}</div>;
  }

  const clientApprovalLink = (approvalLinkRaw ?? null) as ClientApprovalLinkRow | null;
  const approvalMessage =
    resolvedSearchParams?.schvaleni === "sent" ||
    resolvedSearchParams?.schvaleni === "revoked" ||
    resolvedSearchParams?.schvaleni === "missing_email" ||
    resolvedSearchParams?.schvaleni === "missing_resend_key"
      ? resolvedSearchParams.schvaleni
      : null;
  const approvalPublicLink =
    resolvedSearchParams?.approval_token && approvalMessage === "sent"
      ? buildApprovalUrl(process.env.NEXT_PUBLIC_APP_URL ?? "", resolvedSearchParams.approval_token)
      : null;

  let klientNazev: string | null = null;
  let invoiceClient: InvoiceClientRow | null = null;
  if (data.klient_id) {
    const { data: klientRaw, error: klientError } = await supabase
      .from("klienti")
      .select("nazev, ico, dic, ulice, mesto, psc, email, telefon")
      .eq("klient_id", data.klient_id)
      .maybeSingle();

    if (klientError) {
      return <div>Chyba: {klientError.message}</div>;
    }

    invoiceClient = (klientRaw ?? null) as InvoiceClientRow | null;
    klientNazev = invoiceClient?.nazev ?? null;
  }

  const headerData = {
    ...data,
    klient_nazev: klientNazev,
  };

  const { data: fakturacniFirmyRaw, error: fakturacniFirmyError } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .eq("aktivni", true)
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (fakturacniFirmyError) {
    return <div>Chyba fakturačních firem: {fakturacniFirmyError.message}</div>;
  }

  const fakturacniFirmy = (fakturacniFirmyRaw ?? []) as FakturacniFirma[];
  const effectiveFakturacniFirma = getEffectiveFakturacniFirma(
    fakturacniFirmy,
    data.fakturacni_firma_id ?? null
  );

  const { data: realizace, error: realizaceError } = await supabase
    .from("zakazka_realizace")
    .select("*")
    .eq("zakazka_id", id);

  if (realizaceError) {
    return <div>Chyba: {realizaceError.message}</div>;
  }

  const { data: technikaSummaryRaw, error: technikaSummaryError } = await supabase
    .from("technika_na_zakazce")
    .select(
      "skladova_polozka_id, mnozstvi, skladove_polozky(nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, interni_naklad)"
    )
    .eq("zakazka_id", id);

  if (technikaSummaryError) {
    return <div>Chyba: {technikaSummaryError.message}</div>;
  }

  const technikaRows = (technikaSummaryRaw ?? []) as TechnikaSummaryRawRow[];
  const planItemInfos = technikaRows
    .map((row) => getSkladovaPolozkaInfo(row.skladove_polozky))
    .filter(Boolean);
  const planBlokIds = [
    ...new Set(planItemInfos.map((item) => item?.sklad_blok_id).filter(Boolean)),
  ] as string[];
  const planKategorieIds = [
    ...new Set(planItemInfos.map((item) => item?.kategorie_techniky_id).filter(Boolean)),
  ] as string[];
  const planPodkategorieIds = [
    ...new Set(planItemInfos.map((item) => item?.podkategorie_techniky_id).filter(Boolean)),
  ] as string[];

  let planBloky: SkladBlokPlanRow[] = [];
  if (planBlokIds.length > 0) {
    const { data: blokyRaw, error: blokyError } = await supabase
      .from("sklad_bloky")
      .select("sklad_blok_id, nazev, poradi")
      .in("sklad_blok_id", planBlokIds);

    if (blokyError) {
      return <div>Chyba okruhů plánu: {blokyError.message}</div>;
    }

    planBloky = (blokyRaw ?? []) as SkladBlokPlanRow[];
  }

  let planKategorie: KategoriePlanRow[] = [];
  if (planKategorieIds.length > 0) {
    const { data: kategorieRaw, error: kategorieError } = await supabase
      .from("kategorie_techniky")
      .select("kategorie_techniky_id, nazev")
      .in("kategorie_techniky_id", planKategorieIds);

    if (kategorieError) {
      return <div>Chyba kategorií plánu: {kategorieError.message}</div>;
    }

    planKategorie = (kategorieRaw ?? []) as KategoriePlanRow[];
  }

  let planPodkategorie: PodkategoriePlanRow[] = [];
  if (planPodkategorieIds.length > 0) {
    const { data: podkategorieRaw, error: podkategorieError } = await supabase
      .from("podkategorie_techniky")
      .select("podkategorie_techniky_id, nazev")
      .in("podkategorie_techniky_id", planPodkategorieIds);

    if (podkategorieError) {
      return <div>Chyba podkategorií plánu: {podkategorieError.message}</div>;
    }

    planPodkategorie = (podkategorieRaw ?? []) as PodkategoriePlanRow[];
  }

  const planBlokMap = new Map(planBloky.map((row) => [row.sklad_blok_id, row]));
  const planKategorieMap = new Map(planKategorie.map((row) => [row.kategorie_techniky_id, row]));
  const planPodkategorieMap = new Map(
    planPodkategorie.map((row) => [row.podkategorie_techniky_id, row])
  );

  const technikaSummary = technikaRows.map((row) => {
    const info = getSkladovaPolozkaInfo(row.skladove_polozky);
    const blok = info?.sklad_blok_id ? planBlokMap.get(info.sklad_blok_id) : null;
    const kategorie = info?.kategorie_techniky_id
      ? planKategorieMap.get(info.kategorie_techniky_id)
      : null;
    const podkategorie = info?.podkategorie_techniky_id
      ? planPodkategorieMap.get(info.podkategorie_techniky_id)
      : null;

    return {
      skladova_polozka_id: row.skladova_polozka_id,
      mnozstvi: row.mnozstvi,
      nazev: info?.nazev?.trim() || row.skladova_polozka_id,
      pozice: info?.pozice ?? null,
      okruhNazev: blok?.nazev?.trim() || "Bez okruhu",
      okruhPoradi: blok?.poradi ?? 999999,
      kategorieNazev: kategorie?.nazev?.trim() || "—",
      podkategorieNazev: podkategorie?.nazev?.trim() || "—",
    };
  }) as TechnikaSummaryRow[];
  const computedTechPrice = technikaRows.reduce((sum, row) => {
    const info = getSkladovaPolozkaInfo(row.skladove_polozky);
    return sum + toCount(row.mnozstvi) * toCount(info?.interni_naklad);
  }, 0);

  const { data: pricingAssignmentsRaw, error: pricingAssignmentsError } = await supabase
    .from("zakazka_lide")
    .select("id, user_id, datum_od, datum_do, typ_bloku, confirmation_status")
    .eq("zakazka_id", id);

  if (pricingAssignmentsError) {
    return <div>Chyba výpočtu ceny personálu: {pricingAssignmentsError.message}</div>;
  }

  const pricingAssignments = ((pricingAssignmentsRaw ?? []) as PricingPersonAssignmentRow[]).filter(
    (row) => row.confirmation_status !== "declined"
  );
  const pricingUserIds = [...new Set(pricingAssignments.map((row) => row.user_id).filter(Boolean))];
  const pricingProfilesById = new Map<string, PricingProfileRow>();

  if (pricingUserIds.length > 0) {
    const { data: pricingProfilesRaw, error: pricingProfilesError } = await supabase
      .from("profiles")
      .select("user_id, hodinovy_naklad_akce")
      .in("user_id", pricingUserIds);

    if (pricingProfilesError) {
      return <div>Chyba hodinových nákladů lidí: {pricingProfilesError.message}</div>;
    }

    for (const profile of (pricingProfilesRaw ?? []) as PricingProfileRow[]) {
      pricingProfilesById.set(profile.user_id, profile);
    }
  }

  const staffCostItems = pricingAssignments.map((assignment) => {
    const hours = calculateHours(assignment.datum_od, assignment.datum_do);
    const hourlyCost = toCount(pricingProfilesById.get(assignment.user_id)?.hodinovy_naklad_akce);
    return {
      id: String(assignment.id),
      userId: assignment.user_id,
      hours,
      hourlyCost,
      total: hours * hourlyCost,
    };
  });
  const computedStaffPrice = staffCostItems.reduce((sum, item) => sum + item.total, 0);

  const { data: attendancePaymentsRaw, error: attendancePaymentsError } = await supabase
    .from("dochazka_zakazky")
    .select("user_id, checkin_at, checkout_at, approved_duration_minutes, payment_status")
    .eq("zakazka_id", id)
    .not("checkout_at", "is", null);

  if (attendancePaymentsError) {
    return <div>Chyba proplacení práce: {attendancePaymentsError.message}</div>;
  }

  const attendancePayments = (attendancePaymentsRaw ?? []) as Array<{
    user_id: string;
    checkin_at: string | null;
    checkout_at: string | null;
    approved_duration_minutes: number | string | null;
    payment_status: string | null;
  }>;
  const attendanceUserIds = [...new Set(attendancePayments.map((row) => row.user_id).filter(Boolean))];
  const attendanceProfilesById = new Map<string, PricingProfileRow>();

  if (attendanceUserIds.length > 0) {
    const { data: attendanceProfilesRaw, error: attendanceProfilesError } = await supabase
      .from("profiles")
      .select("user_id, hodinovy_naklad_akce")
      .in("user_id", attendanceUserIds);

    if (attendanceProfilesError) {
      return <div>Chyba sazeb proplacení práce: {attendanceProfilesError.message}</div>;
    }

    for (const profile of (attendanceProfilesRaw ?? []) as PricingProfileRow[]) {
      attendanceProfilesById.set(profile.user_id, profile);
    }
  }

  const approvedWorkPayments = attendancePayments.reduce((sum, row) => {
    const rate = toCount(attendanceProfilesById.get(row.user_id)?.hodinovy_naklad_akce);
    return sum + getPaymentAmount(getApprovedMinutes(row), rate);
  }, 0);

  const { data: travelPaymentsRaw, error: travelPaymentsError } = await supabase
    .from("cestovni_nahrady")
    .select("km, sazba_za_km, castka, status")
    .eq("zakazka_id", id);

  if (travelPaymentsError) {
    return <div>Chyba cestovních náhrad: {travelPaymentsError.message}</div>;
  }

  const travelPayments = (travelPaymentsRaw ?? []) as Array<{
    km: number | string;
    sazba_za_km: number | string;
    castka: number | string | null;
    status: string | null;
  }>;
  const approvedTravelPayments = travelPayments
    .filter((row) => row.status === "schvaleno" || row.status === "proplaceno")
    .reduce((sum, row) => sum + toCount(row.castka ?? getTravelAmount(row.km, row.sazba_za_km)), 0);

  const { data: transportRowsRaw, error: transportRowsError } = await supabase
    .from("zakazka_doprava")
    .select("id")
    .eq("zakazka_id", id);

  if (transportRowsError) {
    return <div>Chyba dopravy: {transportRowsError.message}</div>;
  }

  const estimatedTransportCost = approvedTravelPayments;

  const planRows = (technikaSummaryRaw ?? []) as LoadingPlanRow[];

  const { data: loadingAssignmentsRaw, error: loadingAssignmentsError } = await supabase
    .from("zakazka_kusy")
    .select("id, kus_id, stav, is_rezerva")
    .eq("zakazka_id", id);

  if (loadingAssignmentsError) {
    return <div>Chyba stavu nakládky: {loadingAssignmentsError.message}</div>;
  }

  const loadingAssignments = (loadingAssignmentsRaw ?? []) as LoadingKusAssignmentRow[];
  const assignmentKusIds = loadingAssignments
    .map((row) => row.kus_id)
    .filter(Boolean);

  let loadingKusy: LoadingKusRow[] = [];
  if (assignmentKusIds.length > 0) {
    const { data: kusyRaw, error: kusyError } = await supabase
      .from("sklad_polozky_kusy")
      .select("kus_id, skladova_polozka_id")
      .in("kus_id", assignmentKusIds);

    if (kusyError) {
      return <div>Chyba kusů nakládky: {kusyError.message}</div>;
    }

    loadingKusy = (kusyRaw ?? []) as LoadingKusRow[];
  }

  let loadingKusHistory: LoadingKusHistoryRow[] = [];
  if (assignmentKusIds.length > 0) {
    const { data: historyRaw, error: historyError } = await supabase
      .from("sklad_kus_historie")
      .select("kus_id, typ_akce, poznamka, created_at")
      .eq("zakazka_id", id)
      .eq("typ_akce", "nalozeno")
      .in("kus_id", assignmentKusIds)
      .order("created_at", { ascending: false });

    if (historyError) {
      return <div>Chyba historie náhrad: {historyError.message}</div>;
    }

    loadingKusHistory = (historyRaw ?? []) as LoadingKusHistoryRow[];
  }

  const loadingPolozkaIds = [
    ...new Set([
      ...planRows.map((row) => row.skladova_polozka_id).filter(Boolean),
      ...loadingKusy.map((row) => row.skladova_polozka_id).filter(Boolean),
    ]),
  ];

  let loadingPolozky: LoadingPolozkaRow[] = [];
  if (loadingPolozkaIds.length > 0) {
    const { data: polozkyRaw, error: polozkyError } = await supabase
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .in("skladova_polozka_id", loadingPolozkaIds);

    if (polozkyError) {
      return <div>Chyba položek nakládky: {polozkyError.message}</div>;
    }

    loadingPolozky = (polozkyRaw ?? []) as LoadingPolozkaRow[];
  }

  const loadingBlokIds = [
    ...new Set(loadingPolozky.map((row) => row.sklad_blok_id).filter(Boolean)),
  ] as string[];

  let loadingBloky: LoadingBlokRow[] = [];
  if (loadingBlokIds.length > 0) {
    const { data: blokyRaw, error: blokyError } = await supabase
      .from("sklad_bloky")
      .select("sklad_blok_id, nazev, poradi")
      .in("sklad_blok_id", loadingBlokIds);

    if (blokyError) {
      return <div>Chyba okruhů nakládky: {blokyError.message}</div>;
    }

    loadingBloky = (blokyRaw ?? []) as LoadingBlokRow[];
  }

  const replacementPolozkaByKus = buildReplacementPolozkaByKus(
    loadingKusHistory,
    planRows,
    loadingPolozky
  );

  const loadingStatusGroups = buildLoadingStatusGroups(
    planRows,
    loadingAssignments,
    loadingKusy,
    loadingPolozky,
    loadingBloky,
    replacementPolozkaByKus
  );
  const invoiceBaseData: Omit<InvoiceDocumentData, "pricing"> = {
    supplier: fakturacniFirmaToInvoiceParty(effectiveFakturacniFirma),
    customer: buildCustomerInvoiceParty(invoiceClient),
    order: {
      orderNumber: data.cislo_zakazky ?? null,
      title: data.nazev ?? null,
      place: data.misto ?? null,
      dateRange: formatZakazkaDateRange(data),
      note: data.poznamka ?? null,
    },
  };
  const currentBeforeDiscount = computedTechPrice + computedStaffPrice;
  const currentFinalPrice = toCount((data as PricingData).cilova_cena) || currentBeforeDiscount;
  const currentVatPayer = effectiveFakturacniFirma?.platce_dph ?? true;
  const currentVatRate = currentVatPayer ? toCount(effectiveFakturacniFirma?.vychozi_sazba_dph ?? 21) : 0;
  const currentTaxBase = currentFinalPrice;
  const currentVatAmount = Number(((currentTaxBase * currentVatRate) / 100).toFixed(2));
  const currentTotalWithVat = currentTaxBase + currentVatAmount;
  const currentInvoiceData: InvoiceDocumentData = {
    ...invoiceBaseData,
    pricing: {
      techPrice: computedTechPrice,
      staffPrice: computedStaffPrice,
      beforeDiscount: currentBeforeDiscount,
      discountPercent: calculateDiscountPercent(currentBeforeDiscount, currentFinalPrice),
      discountAmount: Math.max(currentBeforeDiscount - currentFinalPrice, 0),
      finalPrice: currentFinalPrice,
      vatPayer: currentVatPayer,
      vatRate: currentVatRate,
      taxBase: currentTaxBase,
      vatAmount: currentVatAmount,
      totalWithVat: currentTotalWithVat,
    },
  };
  const invoicePreviewData = latestInvoice ? buildInvoiceDataFromRow(latestInvoice as any) : currentInvoiceData;
  const workflowEvents = timelineEvents.filter((event) => event.type === "Workflow");
  const questionnaireRisks = normalizeQuestionnaireRiskCodes(dotaznik?.rizika).length;
  const nonDeclinedPeopleCount = assignmentHistory.filter((assignment) => assignment.confirmation_status !== "declined").length;
  const acceptedPeopleCount = assignmentHistory.filter((assignment) => assignment.confirmation_status === "accepted").length;
  const pendingPeopleCount = assignmentHistory.filter(
    (assignment) => assignment.confirmation_status !== "accepted" && assignment.confirmation_status !== "declined"
  ).length;
  const availabilityResult = await getTechnikaAvailability({ supabase, zakazkaId: id });
  const availabilityCollisions = availabilityResult.items.filter((item) => item.hasCollision);
  const problematicAvailabilityItems = availabilityResult.items.filter(
    (item) =>
      item.damagedPieces + item.blockedPieces + item.repairPieces + item.pendingCheckPieces + item.retiredPieces > 0
  );
  const approvedWorkflowStates = ["schvaleno_klientem", "priprava", "v_realizaci", "dokonceno", "fakturovano", "archiv"];
  const isApprovedWorkflow = approvedWorkflowStates.includes(String(data.workflow_stav));
  const logisticsReady = Boolean(data.odjezd_ze_skladu || data.sraz_na_miste);
  const preloadItems: PreloadChecklistItem[] = [
    {
      label: "Zakázka schválená",
      status: isApprovedWorkflow ? "ok" : "danger",
      detail: isApprovedWorkflow ? "Klientské schválení nebo pozdější workflow stav je splněný." : "Zakázka ještě není schválená klientem.",
      href: "#schvaleni-klienta",
    },
    {
      label: "Změny po schválení",
      status: data.workflow_change_pending ? "danger" : "ok",
      detail: data.workflow_change_pending
        ? data.workflow_change_summary || "Zakázka má změny čekající na nové potvrzení klientem."
        : "Nejsou evidované neodsouhlasené změny.",
      href: "#schvaleni-klienta",
    },
    {
      label: "Dostupnost techniky",
      status: availabilityCollisions.length > 0 ? "warning" : "ok",
      detail:
        availabilityCollisions.length > 0
          ? `${availabilityCollisions.length} položek má kapacitní kolizi. Zkontrolujte plán techniky a override důvody.`
          : "Kapacitní dostupnost bez kolize podle aktuální serverové kontroly.",
      href: `/zakazky/${id}/technika`,
    },
    {
      label: "Pokrytí lidí",
      status: nonDeclinedPeopleCount === 0 ? "danger" : pendingPeopleCount > 0 ? "warning" : "ok",
      detail:
        nonDeclinedPeopleCount === 0
          ? "Nejsou přiřazení lidé."
          : pendingPeopleCount > 0
            ? `${acceptedPeopleCount} potvrzeno, ${pendingPeopleCount} čeká na reakci.`
            : `${acceptedPeopleCount || nonDeclinedPeopleCount} lidí pokryto.`,
      href: `/zakazky/${id}/people`,
    },
    {
      label: "Odmítnutí lidí",
      status: declinedAssignmentAlerts.length > 0 ? "warning" : "ok",
      detail:
        declinedAssignmentAlerts.length > 0
          ? `${declinedAssignmentAlerts.length} odmítnutých přiřazení čeká na náhradu nebo rozhodnutí.`
          : "Bez odmítnutých přiřazení.",
      href: `/zakazky/${id}/people`,
    },
    {
      label: "Logistika",
      status: logisticsReady ? "ok" : "warning",
      detail: logisticsReady ? "Odjezd nebo sraz je vyplněný." : "Doplňte odjezd ze skladu nebo sraz na místě.",
      href: "#harmonogram",
    },
    {
      label: "Problémové kusy",
      status: problematicAvailabilityItems.length > 0 ? "warning" : "ok",
      detail:
        problematicAvailabilityItems.length > 0
          ? `${problematicAvailabilityItems.length} položek má poškozené, blokované nebo servisní kusy. Při scanu může být nutný override.`
          : "Bez problémových kusů v plánu podle aktuální kontroly.",
      href: `/zakazky/${id}/technika`,
    },
  ];
  const preloadBlockingCount = preloadItems.filter((item) => item.status !== "ok").length;
  const recommendedAction = getRecommendedAction({
    workflowStatus: data.workflow_stav,
    hasTechnika: technikaSummary.length > 0,
    questionnaireStatus: clientVerificationStatus,
    questionnaireRisks,
    hasPrice: currentFinalPrice > 0,
    approvalStatus: data.client_approval_status,
    workflowChangePending: data.workflow_change_pending,
    peopleCount: nonDeclinedPeopleCount,
    declinedPeopleCount: declinedAssignmentAlerts.length,
    preloadBlockingCount,
    logisticsStatus: data.logistika_stav,
    invoice: latestInvoice,
    zakazkaId: id,
  });

  return (
    <div className="w-full">
      <ZakazkaHeaderCard
        zakazkaId={id}
        data={headerData}
        hasInvoice={Boolean(latestInvoice)}
        cancelAction={cancelZakazkaAction}
      />

      <WorkflowCockpitCard action={recommendedAction} />

      {(data as { workflow_change_pending?: boolean | null }).workflow_change_pending ? (
        <WorkflowChangePendingWarning
          zakazkaId={id}
          summary={(data as { workflow_change_summary?: string | null }).workflow_change_summary}
        />
      ) : null}

      <WorkflowCard
        status={(data as { workflow_stav?: string | null }).workflow_stav}
        changedAt={(data as { workflow_changed_at?: string | null }).workflow_changed_at}
        latestEvents={workflowEvents}
      />

      <div id="harmonogram">
        <ZakazkaScheduleCard data={data} action={updateZakazkaSchedule} />
      </div>

      <LogisticsCard zakazkaId={id} data={data as LogisticsData} profilesById={logisticsProfilesById} />

      <ZakazkaBasicLookCard realizace={(realizace ?? []) as RealizaceRow[]} data={data} />

      {!data.misto_id ? (
        <ZakazkaPlaceConnectionCard
          zakazka={{
            zakazkaId: id,
            nazev: data.nazev ?? null,
            klientId: data.klient_id ?? null,
            misto: data.misto ?? null,
            mistoLat: data.misto_lat ?? null,
            mistoLng: data.misto_lng ?? null,
            mistoRadius: data.misto_gps_radius_m ?? null,
          }}
          places={existingPlacesForLink}
        />
      ) : null}

      <PlaceTechnicalNotesCard
        currentZakazkaId={id}
        misto={mistoKonani}
        notes={mistoTechnickePoznamky}
        authorsById={noteAuthorsById}
        zakazkyById={noteZakazkyById}
        showPlaceDetailLink
      />

      <div id="technicke-overeni">
        <ClientTechnicalVerificationCard
          zakazkaId={id}
          mistoId={user ? data.misto_id ?? null : null}
          statusLabel={clientVerificationStatus}
          link={clientVerificationLink}
          dotaznik={dotaznik}
          photos={dotaznikPhotos}
          galleryPhotos={dotaznikGalleryPhotos}
          message={technicalVerificationMessage}
          hasSavedPlace={Boolean(data.misto_id)}
        />
      </div>

      <div id="fakturace">
        <PricingRecapCard
          zakazkaId={id}
          pricing={data as PricingData}
          computedTechPrice={computedTechPrice}
          computedStaffPrice={computedStaffPrice}
          staffCostItems={staffCostItems}
          invoiceBaseData={invoiceBaseData}
          fakturacniFirmy={fakturacniFirmy}
          selectedFakturacniFirmaId={effectiveFakturacniFirma?.id ?? data.fakturacni_firma_id ?? null}
          action={updateZakazkaPricing}
        />
      </div>

      <OperationalSummaryCard
        plannedPrice={currentBeforeDiscount}
        discountAmount={Math.max(currentBeforeDiscount - currentFinalPrice, 0)}
        finalPrice={currentFinalPrice}
        estimatedTechCost={computedTechPrice}
        estimatedPeopleCost={computedStaffPrice}
        estimatedTransportCost={estimatedTransportCost}
        approvedWorkPayments={approvedWorkPayments}
        approvedTravelPayments={approvedTravelPayments}
      />

      <InvoiceCard zakazkaId={id} invoice={latestInvoice} previewData={invoicePreviewData} />

      <div id="schvaleni-klienta">
        <ClientApprovalCard
          zakazkaId={id}
          status={data.client_approval_status}
          link={clientApprovalLink}
          publicLink={approvalPublicLink}
          message={approvalMessage}
        />
      </div>

      <PlanTechnikyCard items={technikaSummary} />

      <LoadingStatusCard groups={loadingStatusGroups} />

      <PreloadChecklistCard items={preloadItems} />

      <ZakazkaDopravaCard zakazkaId={id} />

      <div className="mt-6">
        <ZakazkaSubnav zakazkaId={id} active="detail" showBackLink />
      </div>

      <div className="mt-10">
        {declinedAssignmentAlerts.length > 0 ? (
          <Card className="mb-4 border-red-500/30 bg-red-500/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-red-100">
                  Někdo odmítl přiřazení k této zakázce
                </div>
                <div className="mt-1 text-sm text-red-100/80">
                  Je potřeba vyřešit pokrytí práce.
                </div>
              </div>
              <div className="rounded-md border border-red-400/40 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-100">
                {declinedAssignmentAlerts.length === 1
                  ? "1 odmítnutí"
                  : `${declinedAssignmentAlerts.length} odmítnutí`}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {declinedAssignmentAlerts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-red-400/25 bg-slate-950/60 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{item.userName}</div>
                      <div className="mt-1 text-sm text-slate-300">
                        {item.phase} · {item.timeRange}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-red-100">
                    <span className="font-semibold">Důvod:</span> {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <PeoplePool zakazkaId={id} />
      </div>

      <HistoryTimelineCard events={timelineEvents} />
    </div>
  );
}



