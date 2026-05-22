import Link from "next/link";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatHours,
  formatMoneyCzk,
  getApprovedMinutes,
  getMeasuredMinutes,
  getPaymentAmount,
  getPaymentStatusLabel,
  normalizePaymentStatus,
} from "@/lib/payments";
import { formatKm, getTravelAmount, getTravelStatusLabel } from "@/lib/transport";
import { buildWorkZakazkaPayoutTree } from "@/lib/admin/work-payout-display";
import { loadPayoutEmployeeProfiles, type PayoutEmployeeProfile } from "@/lib/admin/payout-profiles";
import { loadPayoutOverridesByKeys } from "@/lib/admin/payout-overrides-server";
import { resolveFinalPayoutAmount, toOverrideAmountNumber } from "@/lib/admin/work-payout-override";
import { getMissingBankAccountMessage, getPaymentAccount } from "@/lib/bank-account";
import { verifyAppAdminOrSefPage } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import {
  approveTravelReimbursementAction,
  clearWorkPayoutOverrideAction,
  markTravelReimbursementPaidAction,
  markZakazkaEmployeeWorkPaidAction,
  rejectTravelReimbursementAction,
  saveWorkPayoutOverrideAction,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ stav?: string }>;
};

type AttendanceRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  typ_faze: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  approved_duration_minutes: number | string | null;
  payment_status: string | null;
  paid_at: string | null;
  paid_by: string | null;
  zakazky?: { cislo_zakazky: string | null; nazev: string | null } | null;
};

type TravelRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  zakazka_doprava_id: string | null;
  km: number | string;
  sazba_za_km: number | string;
  castka: number | string | null;
  odkud: string | null;
  kam: string | null;
  poznamka: string | null;
  status: string;
  submitted_at: string | null;
  paid_at: string | null;
  rejected_reason: string | null;
  zakazky?: { cislo_zakazky: string | null; nazev: string | null } | null;
};

type FilterMode = "ceka_na_proplaceni" | "proplaceno" | "vse";

function normalizeFilter(value?: string | null): FilterMode {
  if (value === "proplaceno") return "proplaceno";
  if (value === "vse") return "vse";
  return "ceka_na_proplaceni";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getProfileName(
  profile?: Pick<PayoutEmployeeProfile, "jmeno" | "prijmeni" | "email"> | null,
  fallback?: string | null
) {
  const name = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  return name || profile?.email || fallback || "Zaměstnanec";
}

function getZakazkaTitle(row: AttendanceRow) {
  return [row.zakazky?.cislo_zakazky, row.zakazky?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

function buildWorkPayoutGroupKey(zakazkaId: string, userId: string) {
  return `${zakazkaId}:${userId}`;
}

async function buildQrDataUrl({
  account,
  amount,
  message,
}: {
  account: string;
  amount: number;
  message: string;
}) {
  const payload = `SPD*1.0*ACC:${account}*AM:${amount.toFixed(2)}*CC:CZK*MSG:${message.slice(0, 60)}`;
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filter = normalizeFilter(resolvedSearchParams?.stav);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-6 text-red-300">Unauthorized</div>;
  }

  const access = await verifyAppAdminOrSefPage(supabase);
  if (!access.ok) {
    return <div className="p-6 text-red-300">{access.message}</div>;
  }

  let query = supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id, typ_faze, checkin_at, checkout_at, approved_duration_minutes, payment_status, paid_at, paid_by, zakazky(cislo_zakazky, nazev)")
    .not("checkout_at", "is", null)
    .order("checkin_at", { ascending: false });

  if (filter !== "vse") {
    query = query.eq("payment_status", filter);
  }

  const { data: attendanceRaw, error: attendanceError } = await query;

  if (attendanceError) {
    return <div className="p-6 text-red-300">{attendanceError.message}</div>;
  }

  const rows = ((attendanceRaw ?? []) as Array<
    Omit<AttendanceRow, "zakazky"> & {
      zakazky?: AttendanceRow["zakazky"] | AttendanceRow["zakazky"][];
    }
  >).map((row) => ({
    ...row,
    zakazky: Array.isArray(row.zakazky) ? (row.zakazky[0] ?? null) : (row.zakazky ?? null),
  })) as AttendanceRow[];

  let travelQuery = supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id, zakazka_doprava_id, km, sazba_za_km, castka, odkud, kam, poznamka, status, submitted_at, paid_at, rejected_reason, zakazky(cislo_zakazky, nazev)")
    .order("submitted_at", { ascending: false });

  if (filter === "proplaceno") {
    travelQuery = travelQuery.eq("status", "proplaceno");
  } else if (filter !== "vse") {
    travelQuery = travelQuery.in("status", ["ceka_na_schvaleni", "schvaleno"]);
  }

  const { data: travelRaw, error: travelError } = await travelQuery;
  if (travelError) {
    return <div className="p-6 text-red-300">{travelError.message}</div>;
  }

  const travelRows = ((travelRaw ?? []) as Array<
    Omit<TravelRow, "zakazky"> & {
      zakazky?: TravelRow["zakazky"] | TravelRow["zakazky"][];
    }
  >).map((row) => ({
    ...row,
    zakazky: Array.isArray(row.zakazky) ? (row.zakazky[0] ?? null) : (row.zakazky ?? null),
  })) as TravelRow[];

  const userIds = [
    ...new Set([...rows.map((row) => row.user_id), ...travelRows.map((row) => row.user_id)].filter(Boolean)),
  ];
  const { profilesById, error: profilesError } = await loadPayoutEmployeeProfiles(supabase, userIds);

  if (profilesError) {
    return <div className="p-6 text-red-300">{profilesError}</div>;
  }

  const items = rows.map((row) => {
    const profile = profilesById.get(row.user_id) ?? null;
    const approvedMinutes = getApprovedMinutes(row);
    const measuredMinutes = getMeasuredMinutes(row.checkin_at, row.checkout_at);
    const hourlyRate = Number(profile?.hodinovy_naklad_akce ?? 0);
    const amount = getPaymentAmount(approvedMinutes, hourlyRate);

    return { row, profile, approvedMinutes, measuredMinutes, hourlyRate, amount };
  });

  const calculatedWorkWaitingTotal = items
    .filter((item) => normalizePaymentStatus(item.row.payment_status) === "ceka_na_proplaceni")
    .reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = items
    .filter((item) => normalizePaymentStatus(item.row.payment_status) === "proplaceno")
    .reduce((sum, item) => sum + item.amount, 0);
  const travelItems = await Promise.all(
    travelRows.map(async (row) => {
      const profile = profilesById.get(row.user_id) ?? null;
      const amount = Number(row.castka ?? getTravelAmount(row.km, row.sazba_za_km));
      const account = getPaymentAccount(profile);
      const message = `WEST COUNTY cesta ${getZakazkaTitle(row as unknown as AttendanceRow)}`;
      const qrDataUrl =
        row.status === "schvaleno" && account
          ? await buildQrDataUrl({ account: account.qrAccount, amount, message })
          : null;
      return { row, profile, amount, account, message, qrDataUrl };
    })
  );
  const travelWaitingTotal = travelItems
    .filter((item) => item.row.status === "schvaleno")
    .reduce((sum, item) => sum + item.amount, 0);
  const travelPaidTotal = travelItems
    .filter((item) => item.row.status === "proplaceno")
    .reduce((sum, item) => sum + item.amount, 0);
  const workGroupKeys = [
    ...new Set(items.map((item) => buildWorkPayoutGroupKey(item.row.zakazka_id, item.row.user_id))),
  ];

  const zakazkaIdsForOverrides = [...new Set(items.map((item) => item.row.zakazka_id))];
  const { overridesByKey, error: overridesError } = await loadPayoutOverridesByKeys(
    zakazkaIdsForOverrides,
    userIds
  );

  if (overridesError) {
    return <div className="p-6 text-red-300">{overridesError}</div>;
  }

  const workPayoutGroups = await Promise.all(
    workGroupKeys.map(async (groupKey) => {
      const [zakazkaId, userId] = groupKey.split(":");
      const groupItems = items.filter(
        (item) => item.row.zakazka_id === zakazkaId && item.row.user_id === userId
      );
      const profile = profilesById.get(userId) ?? null;
      const zakazkaTitle = groupItems[0] ? getZakazkaTitle(groupItems[0].row) : "Zakázka";
      const waitingItems = groupItems.filter(
        (item) => normalizePaymentStatus(item.row.payment_status) === "ceka_na_proplaceni"
      );
      const calculatedWaitingTotal = waitingItems.reduce((sum, item) => sum + item.amount, 0);
      const overrideRow = overridesByKey.get(groupKey) ?? null;
      const overrideAmount = toOverrideAmountNumber(overrideRow?.override_amount_czk);
      const finalPayoutAmount = resolveFinalPayoutAmount(calculatedWaitingTotal, overrideAmount);
      const account = getPaymentAccount(profile);
      const message = `WEST COUNTY práce ${zakazkaTitle}`;
      const qrDataUrl =
        calculatedWaitingTotal > 0 && account
          ? await buildQrDataUrl({ account: account.qrAccount, amount: finalPayoutAmount, message })
          : null;

      return {
        key: groupKey,
        zakazkaId,
        userId,
        profile,
        zakazkaTitle,
        groupItems,
        waitingItems,
        calculatedWaitingTotal,
        finalPayoutAmount,
        hasOverride: overrideAmount !== null,
        correctionNote: overrideRow?.correction_note ?? null,
        overrideAmount,
        account,
        message,
        qrDataUrl,
      };
    })
  );

  const workWaitingTotal = workPayoutGroups
    .filter((group) => group.calculatedWaitingTotal > 0)
    .reduce((sum, group) => sum + group.finalPayoutAmount, 0);

  const workZakazkaTree = buildWorkZakazkaPayoutTree(
    workPayoutGroups.map((group) => ({
      key: group.key,
      zakazkaId: group.zakazkaId,
      userId: group.userId,
      zakazkaTitle: group.zakazkaTitle,
      profile: group.profile,
      groupItems: group.groupItems.map((item) => item.row),
      hourlyRate: Number(group.profile?.hodinovy_naklad_akce ?? 0),
      calculatedWaitingTotal: group.calculatedWaitingTotal,
      finalPayoutAmount: group.finalPayoutAmount,
      hasOverride: group.hasOverride,
      correctionNote: group.correctionNote,
      account: group.account,
      message: group.message,
      qrDataUrl: group.qrDataUrl,
    })),
    (profile, userId) => getProfileName(profile, userId)
  );

  const filters: Array<{ key: FilterMode; label: string; href: string }> = [
    { key: "ceka_na_proplaceni", label: "Čeká na proplacení", href: "/admin/proplaceni" },
    { key: "proplaceno", label: "Proplaceno", href: "/admin/proplaceni?stav=proplaceno" },
    { key: "vse", label: "Vše", href: "/admin/proplaceni?stav=vse" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6 text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-blue-200 hover:text-blue-100">
            ← Zpět do adminu
          </Link>
          <h1 className="mt-3 text-3xl font-black text-white">Proplacení práce a cest</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Interní evidence uznaného času, schválených cestovních náhrad a proplacení zaměstnanců.
          </p>
        </div>
        <Badge variant="default">{items.length + travelItems.length} záznamů</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-500/30 bg-amber-500/10">
          <div className="text-xs uppercase tracking-wide text-amber-200/80">Práce k proplacení</div>
          <div className="mt-1 text-3xl font-black text-amber-100">{formatMoneyCzk(workWaitingTotal)}</div>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/10">
          <div className="text-xs uppercase tracking-wide text-amber-200/80">Cesty k proplacení</div>
          <div className="mt-1 text-3xl font-black text-amber-100">{formatMoneyCzk(travelWaitingTotal)}</div>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/10">
          <div className="text-xs uppercase tracking-wide text-blue-200/80">Celkem dlužíme</div>
          <div className="mt-1 text-3xl font-black text-blue-100">{formatMoneyCzk(workWaitingTotal + travelWaitingTotal)}</div>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <div className="text-xs uppercase tracking-wide text-emerald-200/80">Celkem proplaceno</div>
          <div className="mt-1 text-3xl font-black text-emerald-100">{formatMoneyCzk(paidTotal + travelPaidTotal)}</div>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition",
              filter === item.key
                ? "border-blue-400 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <h2 className="text-2xl font-black text-white">Práce</h2>

      {workZakazkaTree.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné pracovní záznamy pro tento filtr.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {workZakazkaTree.map((zakazka) => (
            <details
              key={zakazka.zakazkaId}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60"
            >
              <summary className="cursor-pointer list-none px-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{zakazka.zakazkaTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {zakazka.employees.length}{" "}
                      {zakazka.employees.length === 1 ? "zaměstnanec" : "zaměstnanců"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">K proplacení</div>
                    <div className="text-xl font-black text-blue-100">{formatMoneyCzk(zakazka.waitingTotal)}</div>
                  </div>
                </div>
              </summary>

              <div className="space-y-2 border-t border-slate-800 px-3 pb-3 pt-2">
                {zakazka.employees.map((employee) => (
                  <details
                    key={employee.key}
                    className="rounded-xl border border-slate-800 bg-slate-950/70"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-bold text-white">
                          {getProfileName(employee.profile, employee.userId)}
                        </div>
                        <div className="text-sm font-black text-blue-100">
                          {formatMoneyCzk(employee.finalPayoutAmount)}
                        </div>
                      </div>
                    </summary>

                    <div className="space-y-3 border-t border-slate-800 px-4 pb-4 pt-3">
                      {employee.calculatedWaitingTotal > 0 ? (
                        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-4 space-y-3">
                          <p className="text-sm text-blue-100/90">
                            QR pro platbu a označení jako proplaceno se vztahují k celé částce
                            zaměstnance na zakázce.
                          </p>
                          <p className="text-xs text-blue-100/70">
                            Bez korekce se použije vypočtená částka. Vyplněná korekce má přednost pro QR
                            platbu.
                          </p>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-500">Účet</div>
                              <div className="font-bold text-slate-100">
                                {employee.payout.account?.label ?? "Není vyplněn"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-500">K proplacení</div>
                              {employee.hasOverride ? (
                                <div className="space-y-1">
                                  <div className="text-slate-400">
                                    Vypočteno: {formatMoneyCzk(employee.calculatedWaitingTotal)}
                                  </div>
                                  <div className="font-black text-blue-100">
                                    Po korekci: {formatMoneyCzk(employee.finalPayoutAmount)}
                                  </div>
                                </div>
                              ) : (
                                <div className="font-black text-blue-100">
                                  {formatMoneyCzk(employee.finalPayoutAmount)}
                                </div>
                              )}
                            </div>
                          </div>

                          <form action={saveWorkPayoutOverrideAction} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Korekce částky
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-slate-400">
                                Částka (Kč)
                                <input
                                  name="override_amount_czk"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={employee.hasOverride ? employee.finalPayoutAmount : ""}
                                  placeholder={String(employee.calculatedWaitingTotal)}
                                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                                />
                              </label>
                              <label className="flex min-w-[12rem] flex-[2] flex-col gap-1 text-xs text-slate-400">
                                Poznámka (volitelně)
                                <input
                                  name="correction_note"
                                  type="text"
                                  defaultValue={employee.correctionNote ?? ""}
                                  placeholder="Důvod korekce"
                                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                                />
                              </label>
                              <input type="hidden" name="zakazka_id" value={employee.zakazkaId} />
                              <input type="hidden" name="user_id" value={employee.userId} />
                              <button
                                type="submit"
                                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-600"
                              >
                                Uložit korekci
                              </button>
                            </div>
                          </form>
                          {employee.hasOverride ? (
                            <form action={clearWorkPayoutOverrideAction}>
                              <input type="hidden" name="zakazka_id" value={employee.zakazkaId} />
                              <input type="hidden" name="user_id" value={employee.userId} />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                              >
                                Zrušit korekci (použít vypočtenou částku)
                              </button>
                            </form>
                          ) : null}

                          <div className="flex flex-wrap items-start gap-3">
                            {employee.payout.qrDataUrl ? (
                              <details className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                <summary className="cursor-pointer text-sm font-bold text-blue-100">
                                  Zobrazit QR platbu
                                </summary>
                                <div className="mt-3 space-y-2">
                                  <img
                                    src={employee.payout.qrDataUrl}
                                    alt="QR platba za zakázku"
                                    className="rounded-xl bg-white p-2"
                                  />
                                  <div className="text-xs text-slate-400">{employee.payout.message}</div>
                                </div>
                              </details>
                            ) : (
                              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                                {getMissingBankAccountMessage(employee.profile) ??
                                  "Zaměstnanec nemá vyplněné číslo účtu."}
                              </div>
                            )}
                            <form action={markZakazkaEmployeeWorkPaidAction}>
                              <input type="hidden" name="zakazka_id" value={employee.zakazkaId} />
                              <input type="hidden" name="user_id" value={employee.userId} />
                              <button
                                type="submit"
                                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
                              >
                                Proplaceno
                              </button>
                            </form>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {employee.phaseSummaries.map((phase) => (
                          <div
                            key={phase.phase}
                            className={[
                              "rounded-xl border px-3 py-3 text-sm",
                              phase.hasData
                                ? "border-slate-700 bg-slate-900/80"
                                : "border-slate-800/60 bg-slate-950/40 text-slate-500",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "font-bold",
                                phase.hasData ? "text-slate-100" : "text-slate-500",
                              ].join(" ")}
                            >
                              {phase.label}
                              {phase.intervalCount > 1 ? (
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                  ({phase.intervalCount}×)
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Naměřeno</div>
                                <div className={phase.hasData ? "font-semibold text-slate-200" : ""}>
                                  {formatHours(phase.measuredMinutes)}
                                </div>
                              </div>
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Uznané</div>
                                <div className={phase.hasData ? "font-semibold text-emerald-100" : ""}>
                                  {formatHours(phase.approvedMinutes)}
                                </div>
                              </div>
                              <div>
                                <div className="uppercase tracking-wide text-slate-500">Částka</div>
                                <div className={phase.hasData ? "font-semibold text-blue-100" : ""}>
                                  {formatMoneyCzk(phase.amount)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <h2 className="text-2xl font-black text-white">Cestovní náhrady</h2>

      {travelItems.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné cestovní náhrady pro tento filtr.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {travelItems.map((item) => {
            const status = item.row.status;
            const title = [item.row.zakazky?.cislo_zakazky, item.row.zakazky?.nazev].filter(Boolean).join(" · ") || "Zakázka";
            return (
              <Card key={item.row.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">
                      {getProfileName(item.profile, item.row.user_id)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-300">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.row.odkud || "Odkud ?"} → {item.row.kam || "Kam ?"}
                    </div>
                  </div>
                  <Badge variant={status === "proplaceno" ? "success" : status === "zamitnuto" ? "danger" : "warning"}>
                    {getTravelStatusLabel(status)}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Km</div>
                    <div className="font-bold text-slate-100">{formatKm(item.row.km)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Sazba</div>
                    <div className="font-bold text-slate-100">{item.row.sazba_za_km} Kč/km</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Částka</div>
                    <div className="font-black text-blue-100">{formatMoneyCzk(item.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Účet</div>
                    <div className="font-bold text-slate-100">{item.account?.label ?? "Není vyplněn"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Stav</div>
                    <div className="font-bold text-slate-100">{getTravelStatusLabel(status)}</div>
                  </div>
                </div>

                {item.row.poznamka ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                    {item.row.poznamka}
                  </div>
                ) : null}

                {status === "ceka_na_schvaleni" ? (
                  <div className="flex flex-wrap gap-3">
                    <form action={approveTravelReimbursementAction}>
                      <input type="hidden" name="travel_id" value={item.row.id} />
                      <button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600">
                        Schválit
                      </button>
                    </form>
                    <form action={rejectTravelReimbursementAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="travel_id" value={item.row.id} />
                      <input
                        name="rejected_reason"
                        placeholder="Důvod zamítnutí"
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                      />
                      <button className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-600">
                        Zamítnout
                      </button>
                    </form>
                  </div>
                ) : status === "schvaleno" ? (
                  <div className="flex flex-wrap items-start gap-3">
                    {item.qrDataUrl ? (
                      <details className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-bold text-blue-100">
                          Zobrazit QR platbu
                        </summary>
                        <div className="mt-3 space-y-2">
                          <img src={item.qrDataUrl} alt="QR platba cestovní náhrady" className="rounded-xl bg-white p-2" />
                          <div className="text-xs text-slate-400">{item.message}</div>
                        </div>
                      </details>
                    ) : (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                        {getMissingBankAccountMessage(item.profile) ?? "Zaměstnanec nemá vyplněné číslo účtu."}
                      </div>
                    )}
                    <form action={markTravelReimbursementPaidAction}>
                      <input type="hidden" name="travel_id" value={item.row.id} />
                      <button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600">
                        Proplaceno
                      </button>
                    </form>
                  </div>
                ) : status === "zamitnuto" && item.row.rejected_reason ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    Zamítnuto: {item.row.rejected_reason}
                  </div>
                ) : status === "proplaceno" && item.row.paid_at ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Proplaceno {formatDate(item.row.paid_at)}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
