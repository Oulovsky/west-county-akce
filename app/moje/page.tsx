import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getAttendancePhaseLabel } from "@/lib/zakazka-attendance";
import { getApprovalStatusLabel, normalizeApprovalStatus } from "@/lib/approval";
import {
  formatHours,
  formatMoneyCzk,
  getApprovedMinutes,
  getClaimedMinutes,
  getMeasuredMinutes,
  getPaymentStatusLabel,
  getWorkApprovedAmount,
  getWorkClaimedAmount,
} from "@/lib/payments";
import { ParticipationActions } from "./ParticipationActions";
import { AttendanceActions } from "./AttendanceActions";
import { submitTravelReimbursementAction } from "./cestovni-nahrady-actions";
import {
  formatKm,
  getAttendanceDopravaRezimLabel,
  getTransportTypeLabel,
  getTravelApprovedAmount,
  getTravelClaimedAmount,
  getTravelClaimedKm,
  getTravelDopravaRezimLabel,
} from "@/lib/transport";
import {
  getNotificationPriorityClass,
  getNotificationPriorityLabel,
} from "@/lib/notifications";

type AssignmentRow = {
  id: string | number;
  zakazka_id: string;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  poznamka: string | null;
  confirmation_status: string | null;
  declined_reason: string | null;
  responded_at: string | null;
  assigned_at: string | null;
  created_at: string | null;
  active_attendance_id?: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  misto_lat: number | string | null;
  misto_lng: number | string | null;
  poznamka: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  zrusena: boolean | null;
  logistika_stav: string | null;
};

type FilterMode = "all" | "pending" | "accepted" | "declined";

type PageProps = {
  searchParams?: Promise<{ filtr?: string }>;
};

type AttendancePaymentRow = {
  id: string;
  zakazka_id: string;
  assignment_id: string | null;
  user_id: string;
  typ_faze: string | null;
  doprava_rezim?: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  claimed_duration_minutes?: number | string | null;
  claimed_amount_czk?: number | string | null;
  approved_duration_minutes: number | string | null;
  approved_amount_czk?: number | string | null;
  approval_status?: string | null;
  payment_status: string | null;
  correction_note?: string | null;
  profiles?: { hodinovy_naklad_akce: number | string | null } | null;
  zakazky?: { cislo_zakazky: string | null; nazev: string | null } | null;
};

type MyTransportRow = {
  id: string;
  zakazka_id: string;
  vozidlo_id: string | null;
  typ_dopravy: string;
  user_id: string | null;
  odjezd_at: string | null;
  prijezd_at: string | null;
  odkud: string | null;
  kam: string | null;
  poznamka: string | null;
};

type VehicleRow = {
  id: string;
  nazev: string;
  spz: string | null;
  typ: string | null;
};

type TravelPaymentRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  zakazka_doprava_id: string | null;
  doprava_rezim?: string | null;
  km: number | string;
  claimed_km?: number | string | null;
  sazba_za_km: number | string;
  spotreba_l_100km?: number | string | null;
  cena_paliva_kc_l?: number | string | null;
  claimed_amount_czk?: number | string | null;
  approved_km?: number | string | null;
  approved_amount_czk?: number | string | null;
  odkud: string | null;
  kam: string | null;
  poznamka: string | null;
  approval_status?: string | null;
  payment_status?: string | null;
  correction_note?: string | null;
  status?: string;
  submitted_at: string | null;
};

type MyNotificationRow = {
  id: string;
  typ: string;
  priorita: string;
  titulek: string;
  zprava: string;
  akce_url: string | null;
  created_at: string;
};

const FILTERS: Array<{ key: FilterMode; label: string }> = [
  { key: "all", label: "Vše" },
  { key: "pending", label: "Nové" },
  { key: "accepted", label: "Potvrzené" },
  { key: "declined", label: "Odmítnuté" },
];

function normalizeStatus(value?: string | null) {
  if (value === "accepted") return "accepted";
  if (value === "declined") return "declined";
  return "pending";
}

function normalizeFilter(value?: string | null): FilterMode {
  if (value === "pending" || value === "accepted" || value === "declined") return value;
  return "all";
}

function getStatusLabel(value?: string | null) {
  const status = normalizeStatus(value);
  if (status === "accepted") return "Potvrzeno";
  if (status === "declined") return "Odmítnuto";
  return "Čeká na potvrzení";
}

function getStatusVariant(value?: string | null) {
  const status = normalizeStatus(value);
  if (status === "accepted") return "success";
  if (status === "declined") return "danger";
  return "warning";
}

function getPhaseLabel(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "Nakládka";
  if (raw === "stavba") return "Stavba";
  if (raw === "bourani" || raw === "bourání") return "Bourání";
  return "Provoz akce";
}

function isLogisticsPhase(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "sklad" || raw === "nakladka" || raw === "nakládka" || raw === "bourani" || raw === "bourání";
}

function getLogisticsStatusLabel(value?: string | null) {
  if (value === "zruseno") return "Zrušeno";
  if (value === "naklada_se") return "Nakládá se";
  if (value === "nalozeno") return "Naloženo";
  if (value === "vykladka") return "Probíhá vykládka";
  if (value === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(from?: string | null, to?: string | null) {
  const fromText = formatDateTime(from);
  const toText = formatDateTime(to);

  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

function getZakazkaTitle(zakazka?: ZakazkaRow | null) {
  if (!zakazka) return "Zakázka";
  return [zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

function getFilteredTitle(filter: FilterMode) {
  if (filter === "pending") return "Nové";
  if (filter === "accepted") return "Potvrzené zakázky";
  if (filter === "declined") return "Odmítnuté";
  return "Vše";
}

function getFilteredEmptyText(filter: FilterMode) {
  if (filter === "pending") return "Žádná nová práce nečeká na potvrzení.";
  if (filter === "accepted") return "Zatím nemáte potvrzené žádné práce.";
  if (filter === "declined") return "Nemáte žádná odmítnutá přiřazení.";
  return "Aktuálně nemáte žádné přiřazené zakázky.";
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getNavigationUrl(zakazka: ZakazkaRow | null) {
  const lat = Number(zakazka?.misto_lat ?? NaN);
  const lng = Number(zakazka?.misto_lng ?? NaN);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  const query = String(zakazka?.misto ?? "").trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function MyNotificationsCard({ notifications }: { notifications: MyNotificationRow[] }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Moje notifikace</h2>
          <p className="mt-1 text-sm text-slate-400">
            Rychlý přehled nepřečtených provozních upozornění.
          </p>
        </div>
        <Link
          href="/notifikace"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800"
        >
          Všechny notifikace
        </Link>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
          Nemáte žádné nepřečtené notifikace.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {notifications.map((notification) => {
            const body = (
              <div className={`h-full rounded-xl border px-4 py-3 ${getNotificationPriorityClass(notification.priorita)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-black text-white">{notification.titulek}</div>
                  <Badge variant={notification.priorita === "critical" ? "danger" : notification.priorita === "warning" ? "warning" : "default"}>
                    {getNotificationPriorityLabel(notification.priorita)}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-200">{notification.zprava}</div>
                <div className="mt-2 text-xs text-slate-400">{formatDateTime(notification.created_at)} · {notification.typ}</div>
              </div>
            );

            return notification.akce_url ? (
              <Link key={notification.id} href={notification.akce_url} className="block transition hover:opacity-85">
                {body}
              </Link>
            ) : (
              <div key={notification.id}>{body}</div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

type AssignmentWithZakazka = {
  assignment: AssignmentRow;
  zakazka: ZakazkaRow | null;
  status: "pending" | "accepted" | "declined";
};

function AssignmentCard({ item }: { item: AssignmentWithZakazka }) {
  const { assignment, zakazka, status } = item;
  const navigationUrl = getNavigationUrl(zakazka);
  const cancelled = Boolean(zakazka?.zrusena);

  return (
    <Card className={["space-y-4", cancelled ? "border-red-500/30 bg-red-500/10 opacity-80" : ""].join(" ")}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 overflow-hidden">
            <div className="break-words text-xl font-black leading-tight text-white">
              {getZakazkaTitle(zakazka)}
            </div>
            <div className="mt-2 break-words text-sm font-semibold text-slate-300">
              {zakazka?.misto || "Místo není vyplněné"}
            </div>
          </div>
          <Badge variant={cancelled ? "danger" : getStatusVariant(status)}>
            {cancelled ? "Zrušeno" : getStatusLabel(status)}
          </Badge>
        </div>

        {cancelled ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            Zakázka byla zrušena
          </div>
        ) : null}

        {status === "pending" && !cancelled ? (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100">
            Máte novou zakázku.
          </div>
        ) : null}

        {isLogisticsPhase(assignment.typ_bloku) ? (
          <div className="inline-flex w-fit rounded-md border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-100">
            {getLogisticsStatusLabel(zakazka?.logistika_stav)}
          </div>
        ) : null}
      </div>

      {!cancelled && status === "accepted" ? (
        <div className="grid grid-cols-3 gap-2 lg:hidden">
          <Link
            href={`/moje/zakazky/${assignment.zakazka_id}`}
            className="flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-2 text-center text-xs font-black text-white"
          >
            Detail
          </Link>
          <Link
            href={`/zakazky/${assignment.zakazka_id}/scan`}
            className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-2 text-center text-xs font-black text-white"
          >
            Scan
          </Link>
          <Link
            href={`/dochazka?zakazka=${encodeURIComponent(assignment.zakazka_id)}`}
            className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-2 text-center text-xs font-black text-emerald-100"
          >
            Práce
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Datum a čas práce</div>
          <div className="mt-1 text-base font-bold text-white">
            {formatRange(assignment.datum_od, assignment.datum_do)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Fáze práce</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {getPhaseLabel(assignment.typ_bloku)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stav</div>
            <div className="mt-1 text-sm font-semibold text-white">{getStatusLabel(status)}</div>
          </div>
        </div>
      </div>

      {assignment.poznamka ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Poznámka k přiřazení</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{assignment.poznamka}</div>
        </div>
      ) : null}

      {zakazka?.poznamka ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Poznámka k zakázce</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{zakazka.poznamka}</div>
        </div>
      ) : null}

      {status === "declined" && assignment.declined_reason ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Důvod odmítnutí: {assignment.declined_reason}
        </div>
      ) : null}

      <div className="hidden gap-2 lg:grid lg:grid-cols-2">
        <Link
          href={`/moje/zakazky/${assignment.zakazka_id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
        >
          Otevřít zakázku
        </Link>
        {navigationUrl ? (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/20 px-5 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-600/30"
          >
            Navigovat
          </a>
        ) : (
          <div className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-500">
            Navigace není dostupná
          </div>
        )}
      </div>

      {!cancelled ? <ParticipationActions assignmentId={String(assignment.id)} status={status} /> : null}

      {!cancelled && status === "accepted" ? (
        <AttendanceActions
          assignmentId={String(assignment.id)}
          active={Boolean(assignment.active_attendance_id)}
        />
      ) : null}
    </Card>
  );
}

function FilterPills({ activeFilter }: { activeFilter: FilterMode }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((filter) => {
        const active = filter.key === activeFilter;
        const href = filter.key === "all" ? "/moje" : `/moje?filtr=${filter.key}`;

        return (
          <Link
            key={filter.key}
            href={href}
            className={[
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition",
              active
                ? "border-blue-400 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}

function AssignmentSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: AssignmentWithZakazka[];
  emptyText: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <Badge variant="default">{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">{emptyText}</div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <AssignmentCard key={String(item.assignment.id)} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function WorkPaymentsOverview({
  rows,
  travelRows,
}: {
  rows: AttendancePaymentRow[];
  travelRows: TravelPaymentRow[];
}) {
  const items = rows
    .filter((row) => row.checkout_at)
    .map((row) => {
      const measuredMinutes = getMeasuredMinutes(row.checkin_at, row.checkout_at);
      const claimedMinutes = getClaimedMinutes(row);
      const approvedMinutes =
        normalizeApprovalStatus(row.approval_status) === "schvaleno"
          ? getApprovedMinutes(row)
          : null;
      const hourlyRate = toNumber(row.profiles?.hodinovy_naklad_akce);
      const claimedAmount = getWorkClaimedAmount({ ...row, hourlyRate });
      const approvedAmount =
        normalizeApprovalStatus(row.approval_status) === "schvaleno"
          ? getWorkApprovedAmount({ ...row, hourlyRate })
          : null;
      return {
        row,
        measuredMinutes,
        claimedMinutes,
        approvedMinutes,
        hourlyRate,
        claimedAmount,
        approvedAmount,
      };
    });

  const waitingTotal = items
    .filter(
      (item) =>
        normalizeApprovalStatus(item.row.approval_status) === "schvaleno" &&
        item.row.payment_status !== "proplaceno"
    )
    .reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0);
  const paidTotal = items
    .filter((item) => item.row.payment_status === "proplaceno")
    .reduce((sum, item) => sum + (item.approvedAmount ?? item.claimedAmount), 0);
  const travelWaitingTotal = travelRows
    .filter(
      (row) =>
        normalizeApprovalStatus(row.approval_status) === "schvaleno" &&
        row.payment_status !== "proplaceno"
    )
    .reduce((sum, row) => sum + getTravelApprovedAmount(row), 0);
  const travelPaidTotal = travelRows
    .filter((row) => row.payment_status === "proplaceno")
    .reduce((sum, row) => sum + getTravelApprovedAmount(row), 0);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Moje proplacení</h2>
          <p className="mt-1 text-sm text-slate-400">
            Provozní přehled uznané práce, cestovních náhrad a interního proplacení.
          </p>
        </div>
        <Badge variant="default">{items.length} záznamů</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-amber-200/80">Práce čeká</div>
          <div className="mt-1 text-2xl font-black text-amber-100">{formatMoneyCzk(waitingTotal)}</div>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-amber-200/80">Cesty čekají</div>
          <div className="mt-1 text-2xl font-black text-amber-100">{formatMoneyCzk(travelWaitingTotal)}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-emerald-200/80">Celkem čeká</div>
          <div className="mt-1 text-2xl font-black text-emerald-100">{formatMoneyCzk(waitingTotal + travelWaitingTotal)}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-emerald-200/80">Celkem proplaceno</div>
          <div className="mt-1 text-2xl font-black text-emerald-100">{formatMoneyCzk(paidTotal + travelPaidTotal)}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
          Zatím nemáte ukončenou žádnou práci.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const title = [item.row.zakazky?.cislo_zakazky, item.row.zakazky?.nazev]
              .filter(Boolean)
              .join(" · ") || "Zakázka";
            const paid = item.row.payment_status === "proplaceno";
            const approval = normalizeApprovalStatus(item.row.approval_status);
            return (
              <div key={item.row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-white">{title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {getAttendancePhaseLabel(item.row.typ_faze)}
                      {item.row.typ_faze === "prejezd" && item.row.doprava_rezim
                        ? ` · ${getAttendanceDopravaRezimLabel(item.row.doprava_rezim)}`
                        : ""}{" "}
                      · {formatDateTime(item.row.checkin_at)}
                    </div>
                  </div>
                  <Badge
                    variant={
                      approval === "schvaleno" ? "success" : approval === "zamitneto" ? "danger" : "warning"
                    }
                  >
                    {getApprovalStatusLabel(approval)}
                    {paid ? " · Proplaceno" : ""}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Nárok čas</div>
                    <div className="font-bold text-slate-100">{formatHours(item.claimedMinutes)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Uznáno čas</div>
                    <div className="font-bold text-emerald-100">
                      {item.approvedMinutes != null ? formatHours(item.approvedMinutes) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Nárok Kč</div>
                    <div className="font-bold text-slate-100">{formatMoneyCzk(item.claimedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Uznáno Kč</div>
                    <div className="font-black text-blue-100">
                      {item.approvedAmount != null ? formatMoneyCzk(item.approvedAmount) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Proplacení</div>
                    <div className="font-bold text-slate-100">{getPaymentStatusLabel(item.row.payment_status)}</div>
                  </div>
                </div>
                {item.row.correction_note ? (
                  <div className="mt-2 text-sm text-slate-400">Poznámka šéfa: {item.row.correction_note}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {travelRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white">Cestovní náhrady</h3>
          {travelRows.map((row) => {
            const approval = normalizeApprovalStatus(row.approval_status);
            const claimedKm = getTravelClaimedKm(row);
            const claimedAmount = getTravelClaimedAmount(row);
            const approvedAmount =
              approval === "schvaleno" ? getTravelApprovedAmount(row) : null;
            return (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-white">
                      {getTravelDopravaRezimLabel(row.doprava_rezim)} · {row.odkud || "Odkud ?"} →{" "}
                      {row.kam || "Kam ?"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">Nárok {formatKm(claimedKm)}</div>
                  </div>
                  <Badge
                    variant={
                      approval === "schvaleno"
                        ? "success"
                        : approval === "zamitneto"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {getApprovalStatusLabel(approval)}
                    {row.payment_status === "proplaceno" ? " · Proplaceno" : ""}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-slate-500">Nárok km</div>
                    <div className="font-bold">{formatKm(claimedKm)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Uznáno km</div>
                    <div className="font-bold text-emerald-100">
                      {approval === "schvaleno" ? formatKm(row.approved_km ?? claimedKm) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Nárok Kč</div>
                    <div className="font-bold">{formatMoneyCzk(claimedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Uznáno Kč</div>
                    <div className="font-black text-blue-100">
                      {approvedAmount != null ? formatMoneyCzk(approvedAmount) : "—"}
                    </div>
                  </div>
                </div>
                {row.correction_note ? (
                  <div className="mt-2 text-sm text-slate-400">Poznámka šéfa: {row.correction_note}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function MyTransportOverview({
  rows,
  vehiclesById,
  zakazkyById,
}: {
  rows: MyTransportRow[];
  vehiclesById: Map<string, VehicleRow>;
  zakazkyById: Map<string, ZakazkaRow>;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Moje doprava</h2>
          <p className="mt-1 text-sm text-slate-400">Přesuny, auta a soukromé cesty naplánované na zakázkách.</p>
        </div>
        <Badge variant="default">{rows.length} záznamů</Badge>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
          Nemáte naplánovaný žádný dopravní záznam.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const vehicle = vehiclesById.get(row.vozidlo_id ?? "");
            const zakazka = zakazkyById.get(row.zakazka_id);
            return (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{getTransportTypeLabel(row.typ_dopravy)}</div>
                    <div className="mt-1 text-sm text-slate-300">
                      {[zakazka?.cislo_zakazky, zakazka?.nazev].filter(Boolean).join(" · ") || "Zakázka"}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {row.odkud || "Odkud ?"} → {row.kam || "Kam ?"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(row.odjezd_at)} - {formatDateTime(row.prijezd_at)}
                    </div>
                    {row.poznamka ? <div className="mt-2 text-sm text-slate-300">{row.poznamka}</div> : null}
                  </div>
                  <Badge variant={vehicle ? "success" : "warning"}>
                    {vehicle ? `${vehicle.nazev}${vehicle.spz ? ` · ${vehicle.spz}` : ""}` : "Bez vozidla"}
                  </Badge>
                </div>

                <details className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-blue-100">Zadat cestovní náhradu</summary>
                  <form action={submitTravelReimbursementAction} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="zakazka_id" value={row.zakazka_id} />
                    <input type="hidden" name="zakazka_doprava_id" value={row.id} />
                    <input type="hidden" name="sazba_za_km" value="0" />
                    <label className="text-sm text-slate-300 md:col-span-2">
                      Režim náhrady
                      <select
                        name="doprava_rezim"
                        defaultValue="soukrome_auto"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      >
                        <option value="firemni_auto">Firemní vozidlo (bez Kč náhrady)</option>
                        <option value="soukrome_auto">Soukromé vozidlo (palivo)</option>
                        <option value="spolujizda">Spolujízda</option>
                        <option value="bez_nahrady">Bez náhrady</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
                      Km
                      <input
                        name="km"
                        type="number"
                        min="0"
                        step="0.1"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Spotřeba (l/100 km)
                      <input
                        name="spotreba_l_100km"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="např. 7"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Cena paliva (Kč/l)
                      <input
                        name="cena_paliva_kc_l"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="např. 38"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Odkud
                      <input
                        name="odkud"
                        defaultValue={row.odkud ?? ""}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Kam
                      <input
                        name="kam"
                        defaultValue={row.kam ?? ""}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300 md:col-span-2">
                      Poznámka
                      <textarea
                        name="poznamka"
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Náhrada za soukromé auto: (km / 100) × spotřeba × cena paliva. Čas přejezdu
                      evidujte zvlášť jako přejezd (mzda).
                    </p>
                    <button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600 md:col-span-2 md:max-w-xs">
                      Odeslat ke schválení
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default async function MojePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const activeFilter = normalizeFilter(resolvedSearchParams?.filtr);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: notificationsRaw, error: notificationsError } = await supabase
    .from("notifikace")
    .select("id, typ, priorita, titulek, zprava, akce_url, created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(6);

  if (notificationsError) {
    return <div>Chyba načtení notifikací: {notificationsError.message}</div>;
  }

  const myNotifications = (notificationsRaw ?? []) as MyNotificationRow[];

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select(
      "id, zakazka_id, user_id, datum_od, datum_do, typ_bloku, poznamka, confirmation_status, declined_reason, responded_at, assigned_at, created_at"
    )
    .eq("user_id", user.id)
    .order("datum_od", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    return <div>Chyba načtení mých zakázek: {assignmentsError.message}</div>;
  }

  const assignments = (assignmentsRaw ?? []) as AssignmentRow[];
  const assignmentIds = assignments.map((assignment) => String(assignment.id));
  if (assignmentIds.length > 0) {
    const { data: activeAttendanceRaw, error: activeAttendanceError } = await supabase
      .from("dochazka_zakazky")
      .select("id, assignment_id")
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .in("assignment_id", assignmentIds);

    if (activeAttendanceError) {
      return <div>Chyba načtení docházky: {activeAttendanceError.message}</div>;
    }

    const activeByAssignment = new Map(
      (activeAttendanceRaw ?? []).map((row) => [String(row.assignment_id), row.id as string])
    );

    for (const assignment of assignments) {
      assignment.active_attendance_id = activeByAssignment.get(String(assignment.id)) ?? null;
    }
  }

  const zakazkaIds = [...new Set(assignments.map((assignment) => assignment.zakazka_id))];
  let zakazkyById = new Map<string, ZakazkaRow>();

  if (zakazkaIds.length > 0) {
    const { data: zakazkyRaw, error: zakazkyError } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, misto, misto_lat, misto_lng, poznamka, akce_od, akce_do, datum_od, datum_do, zrusena, logistika_stav")
      .in("zakazka_id", zakazkaIds);

    if (zakazkyError) {
      return <div>Chyba načtení detailů zakázek: {zakazkyError.message}</div>;
    }

    zakazkyById = new Map(((zakazkyRaw ?? []) as ZakazkaRow[]).map((zakazka) => [zakazka.zakazka_id, zakazka]));
  }

  const items: AssignmentWithZakazka[] = assignments.map((assignment) => ({
    assignment,
    zakazka: zakazkyById.get(assignment.zakazka_id) ?? null,
    status: normalizeStatus(assignment.confirmation_status),
  }));
  const pendingItems = items.filter((item) => item.status === "pending");
  const acceptedItems = items.filter((item) => item.status === "accepted");
  const declinedItems = items.filter((item) => item.status === "declined");
  const filteredItems =
    activeFilter === "all" ? items : items.filter((item) => item.status === activeFilter);

  const { data: attendancePaymentsRaw, error: attendancePaymentsError } = await supabase
    .from("dochazka_zakazky")
    .select(
      "id, zakazka_id, assignment_id, user_id, typ_faze, doprava_rezim, checkin_at, checkout_at, claimed_duration_minutes, claimed_amount_czk, approved_duration_minutes, approved_amount_czk, approval_status, payment_status, correction_note, zakazky(cislo_zakazky, nazev)"
    )
    .eq("user_id", user.id)
    .not("checkout_at", "is", null)
    .order("checkin_at", { ascending: false })
    .limit(50);

  if (attendancePaymentsError) {
    return <div>Chyba načtení odpracovaných hodin: {attendancePaymentsError.message}</div>;
  }

  const attendancePayments = ((attendancePaymentsRaw ?? []) as Array<
    Omit<AttendancePaymentRow, "zakazky"> & {
      zakazky?: AttendancePaymentRow["zakazky"] | AttendancePaymentRow["zakazky"][];
    }
  >).map((row) => ({
    ...row,
    zakazky: Array.isArray(row.zakazky) ? (row.zakazky[0] ?? null) : (row.zakazky ?? null),
  })) as AttendancePaymentRow[];
  const { data: ownProfileRaw, error: ownProfileError } = await supabase
    .from("profiles")
    .select("hodinovy_naklad_akce")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownProfileError) {
    return <div>Chyba načtení sazby: {ownProfileError.message}</div>;
  }

  for (const row of attendancePayments) {
    row.profiles = { hodinovy_naklad_akce: ownProfileRaw?.hodinovy_naklad_akce ?? 0 };
  }

  const { data: myTransportsRaw, error: myTransportsError } = await supabase
    .from("zakazka_doprava")
    .select("id, zakazka_id, vozidlo_id, typ_dopravy, user_id, odjezd_at, prijezd_at, odkud, kam, poznamka")
    .eq("user_id", user.id)
    .order("odjezd_at", { ascending: true, nullsFirst: false });

  if (myTransportsError) {
    return <div>Chyba načtení dopravy: {myTransportsError.message}</div>;
  }

  const myTransports = (myTransportsRaw ?? []) as MyTransportRow[];
  const transportZakazkaIds = [...new Set(myTransports.map((row) => row.zakazka_id).filter(Boolean))];
  const transportVehicleIds = [...new Set(myTransports.map((row) => row.vozidlo_id).filter(Boolean))] as string[];

  if (transportZakazkaIds.length > 0) {
    const missingZakazkaIds = transportZakazkaIds.filter((zakazkaId) => !zakazkyById.has(zakazkaId));
    if (missingZakazkaIds.length > 0) {
      const { data: transportZakazkyRaw, error: transportZakazkyError } = await supabase
        .from("zakazky")
        .select("zakazka_id, cislo_zakazky, nazev, misto, misto_lat, misto_lng, poznamka, akce_od, akce_do, datum_od, datum_do, zrusena, logistika_stav")
        .in("zakazka_id", missingZakazkaIds);

      if (transportZakazkyError) {
        return <div>Chyba načtení zakázek dopravy: {transportZakazkyError.message}</div>;
      }

      for (const zakazka of (transportZakazkyRaw ?? []) as ZakazkaRow[]) {
        zakazkyById.set(zakazka.zakazka_id, zakazka);
      }
    }
  }

  let vehiclesById = new Map<string, VehicleRow>();
  if (transportVehicleIds.length > 0) {
    const { data: vehiclesRaw, error: vehiclesError } = await supabase
      .from("vozidla")
      .select("id, nazev, spz, typ")
      .in("id", transportVehicleIds);

    if (vehiclesError) {
      return <div>Chyba načtení vozidel: {vehiclesError.message}</div>;
    }

    vehiclesById = new Map(((vehiclesRaw ?? []) as VehicleRow[]).map((vehicle) => [vehicle.id, vehicle]));
  }

  const { data: travelPaymentsRaw, error: travelPaymentsError } = await supabase
    .from("cestovni_nahrady")
    .select(
      "id, zakazka_id, user_id, zakazka_doprava_id, doprava_rezim, km, claimed_km, sazba_za_km, spotreba_l_100km, cena_paliva_kc_l, claimed_amount_czk, approved_km, approved_amount_czk, approval_status, payment_status, correction_note, odkud, kam, poznamka, submitted_at"
    )
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });

  if (travelPaymentsError) {
    return <div>Chyba načtení cestovních náhrad: {travelPaymentsError.message}</div>;
  }

  const travelPayments = (travelPaymentsRaw ?? []) as TravelPaymentRow[];

  return (
    <div className="mx-auto max-w-lg space-y-4 lg:max-w-none lg:space-y-6">
      <div className="lg:hidden">
        <h1 className="text-2xl font-black text-white">Moje zakázky</h1>
        <p className="mt-1 text-sm text-slate-400">{assignments.length} přiřazení</p>
      </div>

      <Card className="hidden space-y-3 lg:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Moje zakázky</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Tady vidíte nové i potvrzené práce na zakázkách. Zakázku si můžete otevřít a
              prohlédnout ještě před přijetím.
            </p>
          </div>
          <Badge variant="default">{assignments.length} přiřazení</Badge>
        </div>
      </Card>

      <MyNotificationsCard notifications={myNotifications} />

      <FilterPills activeFilter={activeFilter} />

      <div className="hidden lg:block">
        <WorkPaymentsOverview rows={attendancePayments} travelRows={travelPayments} />
      </div>

      <div className="hidden lg:block">
        <MyTransportOverview rows={myTransports} vehiclesById={vehiclesById} zakazkyById={zakazkyById} />
      </div>

      {activeFilter === "all" ? (
        <>
          <AssignmentSection
            title="Čeká na potvrzení"
            items={pendingItems}
            emptyText="Žádná nová práce nečeká na potvrzení."
          />

          <AssignmentSection
            title="Potvrzené zakázky"
            items={acceptedItems}
            emptyText="Zatím nemáte potvrzené žádné práce."
          />

          <AssignmentSection
            title="Odmítnuté"
            items={declinedItems}
            emptyText="Nemáte žádná odmítnutá přiřazení."
          />
        </>
      ) : (
        <AssignmentSection
          title={getFilteredTitle(activeFilter)}
          items={filteredItems}
          emptyText={getFilteredEmptyText(activeFilter)}
        />
      )}
    </div>
  );
}
