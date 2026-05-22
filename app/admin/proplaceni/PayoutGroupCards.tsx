import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getApprovalStatusLabel, normalizeApprovalStatus } from "@/lib/approval";
import { getMissingBankAccountMessage, getPaymentAccount } from "@/lib/bank-account";
import {
  formatHours,
  formatMoneyCzk,
  getApprovedMinutes,
  getClaimedMinutes,
  getWorkApprovedAmount,
  getWorkClaimedAmount,
  normalizePaymentStatus,
} from "@/lib/payments";
import { getPayoutGroupState, type TravelClaimRow, type WorkIntervalRow } from "@/lib/payout-group";
import {
  formatKm,
  getAttendanceDopravaRezimLabel,
  getTravelApprovedAmount,
  getTravelApprovedKm,
  getTravelClaimedAmount,
  getTravelClaimedKm,
  getTravelDopravaRezimLabel,
} from "@/lib/transport";
import { getAttendancePhaseLabel } from "@/lib/zakazka-attendance";
import {
  approveAttendanceIntervalAction,
  approveTravelClaimAction,
  markZakazkaEmployeePayoutAction,
  rejectAttendanceIntervalAction,
  rejectTravelClaimAction,
} from "./actions";

type ProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
  hodinovy_naklad_akce: number | string | null;
  bank_account_number: string | null;
  bank_code: string | null;
  iban: string | null;
};

type ZakazkaMeta = { cislo_zakazky: string | null; nazev: string | null };

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProfileName(profile?: ProfileRow | null, fallback?: string) {
  const name = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  return name || profile?.email || fallback || "Zaměstnanec";
}

function getZakazkaTitle(meta?: ZakazkaMeta | null) {
  return [meta?.cislo_zakazky, meta?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

async function buildQrDataUrl(account: string, amount: number, message: string) {
  const payload = `SPD*1.0*ACC:${account}*AM:${amount.toFixed(2)}*CC:CZK*MSG:${message.slice(0, 60)}`;
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500";

export async function PayoutGroupCard({
  zakazkaId,
  userId,
  zakazkaMeta,
  profile,
  workRows,
  travelRows,
}: {
  zakazkaId: string;
  userId: string;
  zakazkaMeta?: ZakazkaMeta | null;
  profile?: ProfileRow | null;
  workRows: WorkIntervalRow[];
  travelRows: TravelClaimRow[];
}) {
  const hourlyRate = Number(profile?.hodinovy_naklad_akce ?? 0);
  const state = getPayoutGroupState({ workRows, travelRows, bankProfile: profile });
  const account = getPaymentAccount(profile);
  const bankMessage = getMissingBankAccountMessage(profile);
  const qrDataUrl =
    state.canShowPayout && account
      ? await buildQrDataUrl(account.qrAccount, state.total, `WEST COUNTY ${getZakazkaTitle(zakazkaMeta)}`)
      : null;

  const workIntervals = workRows.filter((r) => r.checkout_at);
  const workPrejezdy = workIntervals.filter((r) => r.typ_faze === "prejezd");
  const workOther = workIntervals.filter((r) => r.typ_faze !== "prejezd");

  return (
    <Card className="space-y-4 border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="text-lg font-black text-white">{getProfileName(profile, userId)}</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">{getZakazkaTitle(zakazkaMeta)}</div>
        </div>
        <Badge variant={state.canShowPayout ? "success" : state.pendingWork.length + state.pendingTravel.length > 0 ? "warning" : "default"}>
          {state.canShowPayout
            ? "Připraveno k proplacení"
            : state.pendingWork.length + state.pendingTravel.length > 0
              ? "Čeká na schválení"
              : "Souhrn"}
        </Badge>
      </div>

      {state.openCheckins.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-bold">Otevřená docházka:</span> zaměstnanec má{" "}
          {state.openCheckins.length} aktivní check-in bez ukončení. Proplacení už uzavřených a
          vyřešených částí tím není blokováno.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
        QR pro platbu a možnost označit jako proplaceno se zobrazí až po vypořádání všech požadavků
        zaměstnance na zakázce (každá uzavřená část musí být schválena nebo zamítnuta a musí existovat
        alespoň jedna schválená položka k výplatě).
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Práce k výplatě</div>
          <div className="mt-1 font-black text-blue-100">{formatMoneyCzk(state.workTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Cesty k výplatě</div>
          <div className="mt-1 font-black text-blue-100">{formatMoneyCzk(state.travelTotal)}</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
          <div className="text-xs uppercase tracking-wide text-blue-200/80">Celkem</div>
          <div className="mt-1 text-2xl font-black text-blue-100">{formatMoneyCzk(state.total)}</div>
        </div>
      </div>

      {state.pendingWork.length > 0 || state.pendingTravel.length > 0 ? (
        <div className="text-sm text-amber-200">
          Zbývá vyřídit: {state.pendingWork.length} intervalů práce, {state.pendingTravel.length}{" "}
          náhrad.
        </div>
      ) : null}

      {state.canShowPayout ? (
        <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          {qrDataUrl ? (
            <details className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-bold text-blue-100">QR platba (souhrn)</summary>
              <img src={qrDataUrl} alt="QR platba" className="mt-3 rounded-xl bg-white p-2" />
            </details>
          ) : null}
          <form action={markZakazkaEmployeePayoutAction}>
            <input type="hidden" name="zakazka_id" value={zakazkaId} />
            <input type="hidden" name="user_id" value={userId} />
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
            >
              Označit jako proplaceno
            </button>
          </form>
        </div>
      ) : state.allClosedResolved && !state.hasPayable ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          Vše vyřízeno, k proplacení je 0 Kč (vše zamítnuto nebo bez schválených položek).
        </div>
      ) : state.allClosedResolved && state.hasPayable && !state.hasBankAccount ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
          {bankMessage ?? "Zaměstnanec nemá vyplněný bankovní účet."}
        </div>
      ) : null}

      {workOther.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Práce</h3>
          {workOther.map((row) => (
            <IntervalApprovalCard key={row.id} row={row} hourlyRate={hourlyRate} />
          ))}
        </section>
      ) : null}

      {workPrejezdy.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Přejezdy (pracovní čas / mzda)
          </h3>
          {workPrejezdy.map((row) => (
            <IntervalApprovalCard key={row.id} row={row} hourlyRate={hourlyRate} isPrejezd />
          ))}
        </section>
      ) : null}

      {travelRows.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Náhrady za dopravu (km / palivo)
          </h3>
          {travelRows.map((row) => (
            <TravelApprovalCard key={row.id} row={row} />
          ))}
        </section>
      ) : null}
    </Card>
  );
}

function IntervalApprovalCard({
  row,
  hourlyRate,
  isPrejezd = false,
}: {
  row: WorkIntervalRow;
  hourlyRate: number;
  isPrejezd?: boolean;
}) {
  const approval = normalizeApprovalStatus(row.approval_status);
  const claimedMinutes = getClaimedMinutes(row);
  const claimedAmount = getWorkClaimedAmount({ ...row, hourlyRate });
  const defaultApprovedMinutes = claimedMinutes;
  const defaultApprovedAmount = Math.round((defaultApprovedMinutes / 60) * hourlyRate);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold text-white">
            {getAttendancePhaseLabel(row.typ_faze)}
            {isPrejezd && row.doprava_rezim
              ? ` · ${getAttendanceDopravaRezimLabel(row.doprava_rezim)}`
              : ""}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(row.checkin_at)} · {formatDateTime(row.checkin_at)} –{" "}
            {formatDateTime(row.checkout_at)}
          </div>
        </div>
        <Badge
          variant={
            approval === "schvaleno" ? "success" : approval === "zamitneto" ? "danger" : "warning"
          }
        >
          {getApprovalStatusLabel(approval)}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Nárok čas</div>
          <div className="font-bold">{formatHours(claimedMinutes)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Uznáno čas</div>
          <div className="font-bold text-emerald-100">
            {row.approved_duration_minutes != null ? formatHours(getApprovedMinutes(row)) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Nárok Kč</div>
          <div className="font-bold">{formatMoneyCzk(claimedAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Uznáno Kč</div>
          <div className="font-bold text-blue-100">
            {approval === "schvaleno"
              ? formatMoneyCzk(getWorkApprovedAmount({ ...row, hourlyRate }))
              : "—"}
          </div>
        </div>
      </div>

      {row.correction_note ? (
        <div className="mt-2 text-sm text-slate-400">Poznámka: {row.correction_note}</div>
      ) : null}

      {normalizePaymentStatus(row.payment_status) === "proplaceno" ? (
        <div className="mt-2 text-sm text-emerald-300">Proplaceno v rámci souhrnu zakázky.</div>
      ) : approval === "ceka_na_schvaleni" ? (
        <div className="mt-4 space-y-3">
          <form action={approveAttendanceIntervalAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="attendance_id" value={row.id} />
            <label className="text-xs text-slate-400">
              Uznaný čas (min)
              <input
                name="approved_duration_minutes"
                type="number"
                min={0}
                step={1}
                defaultValue={defaultApprovedMinutes}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400">
              Uznaná částka (Kč)
              <input
                name="approved_amount_czk"
                type="number"
                min={0}
                step={1}
                defaultValue={defaultApprovedAmount}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400 md:col-span-1">
              Poznámka
              <input name="correction_note" className={inputClass} placeholder="Volitelné" />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-600 md:col-span-3 md:max-w-xs"
            >
              Schválit
            </button>
          </form>
          <form action={rejectAttendanceIntervalAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="attendance_id" value={row.id} />
            <input
              name="correction_note"
              required
              placeholder="Důvod zamítnutí"
              className="min-w-[12rem] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-600"
            >
              Zamítnout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TravelApprovalCard({ row }: { row: TravelClaimRow }) {
  const approval = normalizeApprovalStatus(row.approval_status);
  const claimedKm = getTravelClaimedKm(row);
  const claimedAmount = getTravelClaimedAmount(row);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold text-white">{getTravelDopravaRezimLabel(row.doprava_rezim)}</div>
          <div className="mt-1 text-xs text-slate-500">Nárok {formatKm(claimedKm)}</div>
        </div>
        <Badge
          variant={
            approval === "schvaleno" ? "success" : approval === "zamitneto" ? "danger" : "warning"
          }
        >
          {getApprovalStatusLabel(approval)}
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
            {approval === "schvaleno" ? formatKm(getTravelApprovedKm(row)) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Nárok Kč</div>
          <div className="font-bold">{formatMoneyCzk(claimedAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Uznáno Kč</div>
          <div className="font-bold text-blue-100">
            {approval === "schvaleno" ? formatMoneyCzk(getTravelApprovedAmount(row)) : "—"}
          </div>
        </div>
      </div>

      {row.correction_note ? (
        <div className="mt-2 text-sm text-slate-400">Poznámka: {row.correction_note}</div>
      ) : null}

      {normalizePaymentStatus(row.payment_status) === "proplaceno" ? (
        <div className="mt-2 text-sm text-emerald-300">Proplaceno v rámci souhrnu zakázky.</div>
      ) : approval === "ceka_na_schvaleni" ? (
        <div className="mt-4 space-y-3">
          <form action={approveTravelClaimAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="travel_id" value={row.id} />
            <label className="text-xs text-slate-400">
              Uznané km
              <input
                name="approved_km"
                type="number"
                min={0}
                step={0.1}
                defaultValue={claimedKm}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400">
              Uznaná částka (Kč)
              <input
                name="approved_amount_czk"
                type="number"
                min={0}
                step={1}
                defaultValue={claimedAmount}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400">
              Poznámka
              <input name="correction_note" className={inputClass} placeholder="Volitelné" />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-600 md:col-span-3 md:max-w-xs"
            >
              Schválit náhradu
            </button>
          </form>
          <form action={rejectTravelClaimAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="travel_id" value={row.id} />
            <input
              name="correction_note"
              required
              placeholder="Důvod zamítnutí"
              className="min-w-[12rem] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-600"
            >
              Zamítnout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
