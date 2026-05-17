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
  type PaymentStatus,
} from "@/lib/payments";
import { getAttendancePhaseLabel } from "@/lib/zakazka-attendance";
import { formatKm, getTravelAmount, getTravelStatusLabel } from "@/lib/transport";
import { createClient } from "@/lib/supabase/server";
import {
  approveTravelReimbursementAction,
  markAttendancePaidAction,
  markTravelReimbursementPaidAction,
  rejectTravelReimbursementAction,
} from "./actions";

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

function getProfileName(profile?: ProfileRow | null, fallback?: string | null) {
  const name = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  return name || profile?.email || fallback || "Zaměstnanec";
}

function getZakazkaTitle(row: AttendanceRow) {
  return [row.zakazky?.cislo_zakazky, row.zakazky?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

function getPaymentAccount(profile?: ProfileRow | null) {
  const iban = profile?.iban?.trim();
  if (iban) return { label: iban, qrAccount: iban.replace(/\s+/g, "").toUpperCase() };

  const account = profile?.bank_account_number?.trim();
  const bank = profile?.bank_code?.trim();
  if (!account || !bank) return null;

  return { label: `${account}/${bank}`, qrAccount: `${account}/${bank}` };
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

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentProfileError) {
    return <div className="p-6 text-red-300">{currentProfileError.message}</div>;
  }

  if (!currentProfile || (currentProfile.role !== "admin" && currentProfile.role !== "sef")) {
    return <div className="p-6 text-red-300">Forbidden</div>;
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
  const profilesById = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, jmeno, prijmeni, hodinovy_naklad_akce, bank_account_number, bank_code, iban")
      .in("user_id", userIds);

    if (profilesError) {
      return <div className="p-6 text-red-300">{profilesError.message}</div>;
    }

    for (const profile of (profilesRaw ?? []) as ProfileRow[]) {
      profilesById.set(profile.user_id, profile);
    }
  }

  const items = await Promise.all(
    rows.map(async (row) => {
      const profile = profilesById.get(row.user_id) ?? null;
      const approvedMinutes = getApprovedMinutes(row);
      const measuredMinutes = getMeasuredMinutes(row.checkin_at, row.checkout_at);
      const hourlyRate = Number(profile?.hodinovy_naklad_akce ?? 0);
      const amount = getPaymentAmount(approvedMinutes, hourlyRate);
      const account = getPaymentAccount(profile);
      const message = `WEST COUNTY práce ${getZakazkaTitle(row)}`;
      const qrDataUrl =
        normalizePaymentStatus(row.payment_status) === "ceka_na_proplaceni" && account
          ? await buildQrDataUrl({ account: account.qrAccount, amount, message })
          : null;

      return { row, profile, approvedMinutes, measuredMinutes, hourlyRate, amount, account, message, qrDataUrl };
    })
  );

  const waitingTotal = items
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
  const payoutUserIds = [
    ...new Set([
      ...items
        .filter((item) => normalizePaymentStatus(item.row.payment_status) === "ceka_na_proplaceni")
        .map((item) => item.row.user_id),
      ...travelItems.filter((item) => item.row.status === "schvaleno").map((item) => item.row.user_id),
    ]),
  ];
  const combinedPayouts = await Promise.all(
    payoutUserIds.map(async (userId) => {
      const profile = profilesById.get(userId) ?? null;
      const workAmount = items
        .filter((item) => item.row.user_id === userId && normalizePaymentStatus(item.row.payment_status) === "ceka_na_proplaceni")
        .reduce((sum, item) => sum + item.amount, 0);
      const travelAmount = travelItems
        .filter((item) => item.row.user_id === userId && item.row.status === "schvaleno")
        .reduce((sum, item) => sum + item.amount, 0);
      const total = workAmount + travelAmount;
      const account = getPaymentAccount(profile);
      const message = "WEST COUNTY práce a cesty";
      const qrDataUrl =
        total > 0 && account ? await buildQrDataUrl({ account: account.qrAccount, amount: total, message }) : null;
      return { userId, profile, workAmount, travelAmount, total, account, message, qrDataUrl };
    })
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
          <div className="mt-1 text-3xl font-black text-amber-100">{formatMoneyCzk(waitingTotal)}</div>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/10">
          <div className="text-xs uppercase tracking-wide text-amber-200/80">Cesty k proplacení</div>
          <div className="mt-1 text-3xl font-black text-amber-100">{formatMoneyCzk(travelWaitingTotal)}</div>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/10">
          <div className="text-xs uppercase tracking-wide text-blue-200/80">Celkem dlužíme</div>
          <div className="mt-1 text-3xl font-black text-blue-100">{formatMoneyCzk(waitingTotal + travelWaitingTotal)}</div>
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

      {combinedPayouts.length > 0 ? (
        <Card className="space-y-3 border-blue-500/30 bg-blue-500/10">
          <h2 className="text-xl font-black text-white">QR součet podle zaměstnance</h2>
          <p className="text-sm text-blue-100/80">
            Součet čekající práce a schválených cestovních náhrad pro jednu platbu zaměstnanci.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {combinedPayouts.map((payout) => (
              <div key={payout.userId} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="font-black text-white">{getProfileName(payout.profile, payout.userId)}</div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Práce</div>
                    <div className="font-bold text-slate-100">{formatMoneyCzk(payout.workAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Cesty</div>
                    <div className="font-bold text-slate-100">{formatMoneyCzk(payout.travelAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Celkem</div>
                    <div className="font-black text-blue-100">{formatMoneyCzk(payout.total)}</div>
                  </div>
                </div>
                {payout.qrDataUrl ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-blue-100">Zobrazit QR součet</summary>
                    <img src={payout.qrDataUrl} alt="QR souhrnná platba" className="mt-3 rounded-xl bg-white p-2" />
                  </details>
                ) : (
                  <div className="mt-3 text-sm font-bold text-red-100">Zaměstnanec nemá vyplněné číslo účtu.</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <h2 className="text-2xl font-black text-white">Práce</h2>

      {items.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné pracovní záznamy pro tento filtr.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const status = normalizePaymentStatus(item.row.payment_status);
            return (
              <Card key={item.row.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">
                      {getProfileName(item.profile, item.row.user_id)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-300">{getZakazkaTitle(item.row)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(item.row.checkin_at)} · {getAttendancePhaseLabel(item.row.typ_faze)}
                    </div>
                  </div>
                  <Badge variant={status === "proplaceno" ? "success" : "warning"}>
                    {getPaymentStatusLabel(status)}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Schváleno</div>
                    <div className="font-bold text-emerald-100">{formatHours(item.approvedMinutes)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Naměřeno</div>
                    <div className="font-bold text-slate-100">{formatHours(item.measuredMinutes)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Sazba</div>
                    <div className="font-bold text-slate-100">{formatMoneyCzk(item.hourlyRate)} / h</div>
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
                    <div className="font-bold text-slate-100">{getPaymentStatusLabel(status)}</div>
                  </div>
                </div>

                {status === "ceka_na_proplaceni" ? (
                  <div className="flex flex-wrap items-start gap-3">
                    {item.qrDataUrl ? (
                      <details className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-bold text-blue-100">
                          Zobrazit QR platbu
                        </summary>
                        <div className="mt-3 space-y-2">
                          <img src={item.qrDataUrl} alt="QR platba" className="rounded-xl bg-white p-2" />
                          <div className="text-xs text-slate-400">{item.message}</div>
                        </div>
                      </details>
                    ) : (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                        Zaměstnanec nemá vyplněné číslo účtu.
                      </div>
                    )}

                    <form action={markAttendancePaidAction}>
                      <input type="hidden" name="attendance_id" value={item.row.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
                      >
                        Proplaceno
                      </button>
                    </form>
                  </div>
                ) : item.row.paid_at ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Proplaceno {formatDate(item.row.paid_at)}
                  </div>
                ) : null}
              </Card>
            );
          })}
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
                        Zaměstnanec nemá vyplněné číslo účtu.
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
