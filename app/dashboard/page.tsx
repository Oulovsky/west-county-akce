import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatHours, formatMoneyCzk, getApprovedMinutes, getPaymentAmount } from "@/lib/payments";
import { getTravelAmount } from "@/lib/transport";

export const dynamic = "force-dynamic";

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  datum_od: string | null;
  akce_od: string | null;
  logistika_stav: string | null;
  workflow_stav: string | null;
  workflow_change_pending: boolean | null;
  client_approval_status: string | null;
  zrusena: boolean | null;
  konecna_cena: number | string | null;
  cilova_cena: number | string | null;
  cena_pred_slevou: number | string | null;
  cena_techniky: number | string | null;
  cena_personalu: number | string | null;
};

type AttendanceRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  checkin_at: string | null;
  checkout_at: string | null;
  approved_duration_minutes: number | string | null;
  payment_status: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
  hodinovy_naklad_akce: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isDateInDay(value: string | null | undefined, day: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= startOfDay(day).getTime() && time <= endOfDay(day).getTime();
}

function getZakazkaStart(row: ZakazkaRow) {
  return row.akce_od || (row.datum_od ? `${row.datum_od}T00:00:00` : null);
}

function zakazkaTitle(row?: Pick<ZakazkaRow, "cislo_zakazky" | "nazev"> | null) {
  return [row?.cislo_zakazky, row?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

function profileName(profile?: ProfileRow | null) {
  const name = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  return name || profile?.email || "Zaměstnanec";
}

function getDashboardNextAction(row: ZakazkaRow) {
  if (row.workflow_change_pending) return "Další krok: znovu schválit změny s klientem";
  if (row.workflow_stav === "cekani_na_schvaleni" || row.client_approval_status === "sent_for_approval") {
    return "Další krok: čekat na klienta nebo poslat připomínku";
  }
  if (["zpozdeni", "problem", "blokovano"].includes(String(row.logistika_stav ?? ""))) {
    return "Další krok: otevřít detail a vyřešit logistiku";
  }
  if (row.workflow_stav === "dokonceno") return "Další krok: vystavit fakturu";
  return "Další krok: otevřít cockpit zakázky";
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-slate-700 bg-slate-900/70 text-slate-100";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function MiniList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; href?: string; meta?: string; tone?: "warning" | "danger" | "default" }>;
  empty: string;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">{title}</h2>
        <Badge variant="default">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-slate-400">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((item, index) => {
            const body = (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="font-bold text-white">{item.label}</div>
                {item.meta ? <div className="mt-1 text-xs text-slate-400">{item.meta}</div> : null}
              </div>
            );
            return item.href ? (
              <Link key={`${item.label}-${index}`} href={item.href} className="block transition hover:opacity-85">
                {body}
              </Link>
            ) : (
              <div key={`${item.label}-${index}`}>{body}</div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const [
    zakazkyRes,
    invoicesRes,
    attendanceRes,
    profilesRes,
    travelRes,
    stockPiecesRes,
    damageHistoryRes,
    zakazkaHistoryRes,
    transportRes,
  ] = await Promise.all([
    supabase.from("zakazky").select("zakazka_id, cislo_zakazky, nazev, datum_od, akce_od, logistika_stav, workflow_stav, workflow_change_pending, client_approval_status, zrusena, konecna_cena, cilova_cena, cena_pred_slevou, cena_techniky, cena_personalu").order("datum_od", { ascending: true }),
    supabase.from("zakazka_faktury").select("id, zakazka_id, cislo_dokladu, stav, payment_status, splatnost_at, konecna_cena, celkem_s_dph"),
    supabase.from("dochazka_zakazky").select("id, zakazka_id, user_id, checkin_at, checkout_at, approved_duration_minutes, payment_status"),
    supabase.from("profiles").select("user_id, email, jmeno, prijmeni, hodinovy_naklad_akce"),
    supabase.from("cestovni_nahrady").select("id, zakazka_id, user_id, km, sazba_za_km, castka, status"),
    supabase.from("sklad_polozky_kusy").select("kus_id, skladova_polozka_id, stav, aktivni, servisni_stav_changed_at, skladove_polozky(nazev)"),
    supabase.from("sklad_kus_historie").select("kus_id, typ_akce, created_at").in("typ_akce", ["poskozeno", "blokovano"]).order("created_at", { ascending: false }).limit(500),
    supabase.from("zakazka_historie").select("event_type, zakazka_id, actor_id, created_at, title").order("created_at", { ascending: false }).limit(1000),
    supabase.from("zakazka_doprava").select("id, zakazka_id, vozidlo_id, typ_dopravy, user_id, odjezd_at, prijezd_at, vozidla(nazev, typ)"),
  ]);

  const zakazky = (zakazkyRes.data ?? []) as ZakazkaRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const attendance = (attendanceRes.data ?? []) as AttendanceRow[];
  const travel = travelRes.data ?? [];
  const history = zakazkaHistoryRes.data ?? [];
  const transports = transportRes.data ?? [];
  const stockPieces = stockPiecesRes.data ?? [];
  const damageHistory = damageHistoryRes.data ?? [];

  const activeZakazky = zakazky.filter((row) => !row.zrusena && row.workflow_stav !== "zruseno");
  const todayEvents = activeZakazky.filter((row) => isDateInDay(getZakazkaStart(row), now));
  const tomorrowEvents = activeZakazky.filter((row) => isDateInDay(getZakazkaStart(row), tomorrow));
  const waitingApproval = activeZakazky.filter((row) => row.workflow_stav === "cekani_na_schvaleni" || row.client_approval_status === "sent_for_approval");
  const changedAfterApproval = activeZakazky.filter((row) => row.workflow_change_pending);
  const cancelled = zakazky.filter((row) => row.zrusena || row.workflow_stav === "zruseno");
  const logisticsProblems = activeZakazky.filter((row) => ["zpozdeni", "problem", "blokovano"].includes(String(row.logistika_stav ?? "")));
  const conflictEvents = history.filter((row: any) => String(row.event_type ?? "").includes("conflict") || String(row.event_type ?? "").includes("override"));
  const conflictZakazkaIds = new Set(conflictEvents.map((row: any) => row.zakazka_id).filter(Boolean));
  const conflictZakazky = activeZakazky.filter((row) => conflictZakazkaIds.has(row.zakazka_id));

  const invoices = invoicesRes.data ?? [];
  const unpaidInvoices = invoices.filter((row: any) => row.stav !== "stornovano" && row.payment_status !== "uhrazeno");
  const workWaiting = attendance
    .filter((row) => row.payment_status === "ceka_na_proplaceni")
    .reduce((sum, row) => {
      const profile = profilesById.get(row.user_id);
      return sum + getPaymentAmount(getApprovedMinutes(row), toNumber(profile?.hodinovy_naklad_akce));
    }, 0);
  const travelWaitingApproval = travel.filter((row: any) => row.status === "ceka_na_schvaleni");
  const travelWaitingPayment = travel
    .filter((row: any) => row.status === "schvaleno")
    .reduce((sum: number, row: any) => sum + toNumber(row.castka ?? getTravelAmount(row.km, row.sazba_za_km)), 0);

  const revenueThisMonth = activeZakazky
    .filter((row) => {
      const start = new Date(getZakazkaStart(row) ?? "").getTime();
      return Number.isFinite(start) && start >= monthStart.getTime() && start < nextMonthStart.getTime();
    })
    .reduce((sum, row) => sum + (toNumber(row.konecna_cena) || toNumber(row.cilova_cena) || toNumber(row.cena_pred_slevou)), 0);
  const revenueNextMonth = activeZakazky
    .filter((row) => {
      const start = new Date(getZakazkaStart(row) ?? "").getTime();
      return Number.isFinite(start) && start >= nextMonthStart.getTime() && start <= nextMonthEnd.getTime();
    })
    .reduce((sum, row) => sum + (toNumber(row.konecna_cena) || toNumber(row.cilova_cena) || toNumber(row.cena_pred_slevou)), 0);

  const techCost = activeZakazky.reduce((sum, row) => sum + toNumber(row.cena_techniky), 0);
  const peopleCost = activeZakazky.reduce((sum, row) => sum + toNumber(row.cena_personalu), 0);
  const transportCost = travel.reduce((sum: number, row: any) => sum + toNumber(row.castka ?? getTravelAmount(row.km, row.sazba_za_km)), 0);

  const problemPieces = stockPieces.filter((row: any) => ["poskozeno", "blokovano", "v_oprave", "ceka_na_kontrolu", "vyrazeno", "odpis"].includes(String(row.stav ?? "")) || row.aktivni === false);
  const repairPieces = stockPieces.filter((row: any) => row.stav === "v_oprave");
  const longRepairPieces = repairPieces.filter((row: any) => {
    const changed = new Date(row.servisni_stav_changed_at ?? "").getTime();
    return Number.isFinite(changed) && now.getTime() - changed > 14 * 24 * 60 * 60 * 1000;
  });
  const damageByItem = new Map<string, number>();
  for (const row of damageHistory as any[]) {
    damageByItem.set(row.kus_id, (damageByItem.get(row.kus_id) ?? 0) + 1);
  }
  const mostDamagedPieces = [...damageByItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const techOverrides = history.filter((row: any) => String(row.event_type ?? "").includes("stock") || String(row.event_type ?? "").includes("technika"));

  const hoursByUser = new Map<string, { minutes: number; actions: Set<string> }>();
  for (const row of attendance) {
    const current = hoursByUser.get(row.user_id) ?? { minutes: 0, actions: new Set<string>() };
    current.minutes += getApprovedMinutes(row);
    current.actions.add(row.zakazka_id);
    hoursByUser.set(row.user_id, current);
  }
  const busiestPeople = [...hoursByUser.entries()]
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 6);
  const openAttendance = attendance.filter((row) => row.checkin_at && !row.checkout_at);
  const declinedShifts = history.filter((row: any) => row.event_type === "assignment_declined" || String(row.title ?? "").toLowerCase().includes("odmít"));
  const peopleConflictCounts = new Map<string, number>();
  for (const row of history.filter((item: any) => String(item.event_type ?? "").includes("people_conflict"))) {
    const key = String(row.actor_id ?? "unknown");
    peopleConflictCounts.set(key, (peopleConflictCounts.get(key) ?? 0) + 1);
  }

  const companyVehicleUse = transports.filter((row: any) => row.typ_dopravy === "firemni_auto");
  const carConflicts = history.filter((row: any) => String(row.event_type ?? "").includes("transport_collision"));
  const privateTrips = transports.filter((row: any) => row.typ_dopravy === "soukrome_auto");
  const travelTotal = travel.reduce((sum: number, row: any) => sum + toNumber(row.castka ?? getTravelAmount(row.km, row.sazba_za_km)), 0);

  return (
    <div className="page-shell w-full space-y-6 text-slate-200">
      <div>
        <h1 className="text-3xl font-black text-white">Provozní dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Rychlý interní přehled problémů, čekajících věcí, orientačních peněz, skladu, lidí a dopravy. Není to účetní BI.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dnešní akce" value={todayEvents.length} tone={todayEvents.length ? "success" : "default"} />
        <StatCard label="Zítra akce" value={tomorrowEvents.length} />
        <StatCard label="Čeká schválení" value={waitingApproval.length} tone="warning" />
        <StatCard label="Kritické změny" value={changedAfterApproval.length} tone={changedAfterApproval.length ? "danger" : "default"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MiniList title="Zakázky: dnes" empty="Dnes není akce." items={todayEvents.map((row) => ({ label: zakazkaTitle(row), href: `/zakazky/${row.zakazka_id}`, meta: getDashboardNextAction(row) }))} />
        <MiniList title="Zakázky: zítra" empty="Zítra není akce." items={tomorrowEvents.map((row) => ({ label: zakazkaTitle(row), href: `/zakazky/${row.zakazka_id}`, meta: getDashboardNextAction(row) }))} />
        <MiniList title="Čeká klient / změny" empty="Nic nečeká na klienta." items={[...waitingApproval, ...changedAfterApproval].map((row) => ({ label: zakazkaTitle(row), href: `/zakazky/${row.zakazka_id}#schvaleni-klienta`, meta: getDashboardNextAction(row), tone: row.workflow_change_pending ? "danger" : "warning" }))} />
        <MiniList title="Problémy a kolize" empty="Bez výrazných kolizí." items={[...logisticsProblems, ...conflictZakazky].map((row) => ({ label: zakazkaTitle(row), href: `/zakazky/${row.zakazka_id}#pred-nakladkova-kontrola`, meta: getDashboardNextAction(row), tone: "warning" }))} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faktury čekají" value={formatMoneyCzk(unpaidInvoices.reduce((sum: number, row: any) => sum + (toNumber(row.celkem_s_dph) || toNumber(row.konecna_cena)), 0))} tone="warning" />
        <StatCard label="Práce k proplacení" value={formatMoneyCzk(workWaiting)} tone="warning" />
        <StatCard label="Cesty ke schválení" value={travelWaitingApproval.length} tone="warning" />
        <StatCard label="Cesty k proplacení" value={formatMoneyCzk(travelWaitingPayment)} tone="warning" />
        <StatCard label="Obrat tento měsíc" value={formatMoneyCzk(revenueThisMonth)} tone="success" />
        <StatCard label="Obrat příští měsíc" value={formatMoneyCzk(revenueNextMonth)} />
        <StatCard label="Odhad nákladů" value={formatMoneyCzk(techCost + peopleCost + transportCost)} />
        <StatCard label="Zrušené zakázky" value={cancelled.length} tone={cancelled.length ? "danger" : "default"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MiniList title="Faktury čekající na akci" empty="Žádná faktura nečeká." items={unpaidInvoices.slice(0, 8).map((row: any) => ({ label: row.cislo_dokladu ?? "Faktura", href: `/zakazky/${row.zakazka_id}#fakturace`, meta: row.payment_status === "po_splatnosti" ? "Další krok: urgovat a označit úhradu" : "Další krok: zkontrolovat úhradu", tone: "warning" }))} />
        <MiniList title="Sklad: problémové kusy" empty="Bez problémových kusů." items={problemPieces.slice(0, 8).map((row: any) => ({ label: row.skladove_polozky?.nazev ?? row.kus_id, href: `/sklad/kus/${row.kus_id}`, meta: row.stav }))} />
        <MiniList title="Sklad: dlouho v opravě" empty="Nic není dlouho v opravě." items={longRepairPieces.map((row: any) => ({ label: row.skladove_polozky?.nazev ?? row.kus_id, href: `/sklad/kus/${row.kus_id}`, meta: "V opravě déle než 14 dní" }))} />
        <MiniList title="Nejčastější poškození kusů" empty="Zatím bez historie poškození." items={mostDamagedPieces.map(([kusId, count]) => ({ label: kusId, href: `/sklad/kus/${kusId}`, meta: `${count} událostí` }))} />
        <MiniList title="Override techniky" empty="Bez override techniky." items={techOverrides.slice(0, 8).map((row: any) => ({ label: row.title ?? row.event_type, href: row.zakazka_id ? `/zakazky/${row.zakazka_id}` : undefined, meta: row.event_type }))} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MiniList title="Crew: nejvíce hodin" empty="Zatím bez odpracovaných hodin." items={busiestPeople.map(([userId, data]) => ({ label: profileName(profilesById.get(userId)), meta: `${formatHours(data.minutes)} · ${data.actions.size} akcí` }))} />
        <MiniList title="Crew: neukončená docházka" empty="Všechny docházky jsou ukončené." items={openAttendance.map((row) => ({ label: profileName(profilesById.get(row.user_id)), href: `/zakazky/${row.zakazka_id}`, meta: row.checkin_at ?? undefined, tone: "warning" }))} />
        <MiniList title="Crew: odmítnuté směny" empty="Bez odmítnutých směn." items={declinedShifts.slice(0, 8).map((row: any) => ({ label: row.title ?? "Odmítnutá směna", href: row.zakazka_id ? `/zakazky/${row.zakazka_id}` : undefined, meta: row.created_at }))} />
        <MiniList title="Crew: kolize lidí" empty="Bez evidovaných kolizí lidí." items={[...peopleConflictCounts.entries()].map(([userId, count]) => ({ label: profileName(profilesById.get(userId)), meta: `${count} kolizí` }))} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Využití firemních aut" value={companyVehicleUse.length} />
        <StatCard label="Kolize aut" value={carConflicts.length} tone={carConflicts.length ? "warning" : "default"} />
        <StatCard label="Soukromé cesty" value={privateTrips.length} />
        <StatCard label="Cestovní náhrady celkem" value={formatMoneyCzk(travelTotal)} />
      </section>
    </div>
  );
}
