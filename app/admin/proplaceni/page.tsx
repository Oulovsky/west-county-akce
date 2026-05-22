import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoneyCzk } from "@/lib/payments";
import { buildPayoutGroupKey } from "@/lib/payout-group";
import { verifyAppAdminOrSefPage } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { PayoutGroupCard } from "./PayoutGroupCards";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ stav?: string }>;
};

type FilterMode = "ceka_na_schvaleni" | "ceka_na_proplaceni" | "proplaceno" | "vse";

function normalizeFilter(value?: string | null): FilterMode {
  if (value === "proplaceno") return "proplaceno";
  if (value === "ceka_na_proplaceni") return "ceka_na_proplaceni";
  if (value === "vse") return "vse";
  return "ceka_na_schvaleni";
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

  const { data: workRaw, error: workError } = await supabase
    .from("dochazka_zakazky")
    .select(
      "id, zakazka_id, user_id, typ_faze, doprava_rezim, checkin_at, checkout_at, claimed_duration_minutes, claimed_amount_czk, approved_duration_minutes, approved_amount_czk, approval_status, payment_status, paid_at, correction_note, zakazky(cislo_zakazky, nazev)"
    )
    .order("checkin_at", { ascending: false });

  if (workError) {
    return <div className="p-6 text-red-300">{workError.message}</div>;
  }

  const { data: travelRaw, error: travelError } = await supabase
    .from("cestovni_nahrady")
    .select(
      "id, zakazka_id, user_id, doprava_rezim, km, claimed_km, sazba_za_km, spotreba_l_100km, cena_paliva_kc_l, claimed_amount_czk, approved_km, approved_amount_czk, approval_status, payment_status, paid_at, correction_note, submitted_at, zakazky(cislo_zakazky, nazev)"
    )
    .order("submitted_at", { ascending: false });
  if (travelError) {
    return <div className="p-6 text-red-300">{travelError.message}</div>;
  }

  const normalizeZakazky = <T extends { zakazky?: unknown }>(row: T) => {
    const z = row.zakazky as { cislo_zakazky: string | null; nazev: string | null } | Array<{
      cislo_zakazky: string | null;
      nazev: string | null;
    }> | null;
    return {
      ...row,
      zakazky: Array.isArray(z) ? (z[0] ?? null) : z,
    };
  };

  const workRows = (workRaw ?? []).map((row) => normalizeZakazky(row));
  const travelRows = (travelRaw ?? []).map((row) => normalizeZakazky(row));

  function groupMatchesFilter(
    groupWork: typeof workRows,
    groupTravel: typeof travelRows
  ) {
    if (filter === "vse") {
      return groupWork.length > 0 || groupTravel.length > 0;
    }
    if (filter === "ceka_na_schvaleni") {
      return (
        groupWork.some(
          (r) => r.checkout_at && r.approval_status === "ceka_na_schvaleni"
        ) ||
        groupTravel.some((r) => r.approval_status === "ceka_na_schvaleni")
      );
    }
    if (filter === "ceka_na_proplaceni") {
      return (
        groupWork.some(
          (r) => r.approval_status === "schvaleno" && r.payment_status === "ceka_na_proplaceni"
        ) ||
        groupTravel.some(
          (r) => r.approval_status === "schvaleno" && r.payment_status === "ceka_na_proplaceni"
        )
      );
    }
    if (filter === "proplaceno") {
      return (
        groupWork.some((r) => r.payment_status === "proplaceno") ||
        groupTravel.some((r) => r.payment_status === "proplaceno")
      );
    }
    return true;
  }

  const groupKeys = new Set<string>();
  for (const row of workRows) {
    if (row.zakazka_id && row.user_id) groupKeys.add(buildPayoutGroupKey(row.zakazka_id, row.user_id));
  }
  for (const row of travelRows) {
    if (row.zakazka_id && row.user_id) groupKeys.add(buildPayoutGroupKey(row.zakazka_id, row.user_id));
  }

  const userIds = [
    ...new Set([
      ...workRows.map((r) => r.user_id),
      ...travelRows.map((r) => r.user_id),
    ].filter(Boolean)),
  ];

  const profilesById = new Map<
    string,
    {
      user_id: string;
      email: string | null;
      jmeno: string | null;
      prijmeni: string | null;
      hodinovy_naklad_akce: number | string | null;
      bank_account_number: string | null;
      bank_code: string | null;
      iban: string | null;
    }
  >();

  if (userIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "user_id, email, jmeno, prijmeni, hodinovy_naklad_akce, bank_account_number, bank_code, iban"
      )
      .in("user_id", userIds);

    if (profilesError) {
      return <div className="p-6 text-red-300">{profilesError.message}</div>;
    }

    for (const profile of profilesRaw ?? []) {
      profilesById.set(profile.user_id, profile);
    }
  }

  const groups = [...groupKeys]
    .map((key) => {
      const [zakazkaId, userId] = key.split(":");
      const groupWork = workRows.filter((r) => r.zakazka_id === zakazkaId && r.user_id === userId);
      const groupTravel = travelRows.filter((r) => r.zakazka_id === zakazkaId && r.user_id === userId);
      const meta = groupWork[0]?.zakazky ?? groupTravel[0]?.zakazky ?? null;
      return {
        key,
        zakazkaId,
        userId,
        meta,
        workRows: groupWork,
        travelRows: groupTravel,
        profile: profilesById.get(userId) ?? null,
      };
    })
    .filter((group) => groupMatchesFilter(group.workRows, group.travelRows));

  groups.sort((a, b) => {
    const titleA = [a.meta?.cislo_zakazky, a.meta?.nazev].filter(Boolean).join(" ");
    const titleB = [b.meta?.cislo_zakazky, b.meta?.nazev].filter(Boolean).join(" ");
    return titleA.localeCompare(titleB, "cs");
  });

  const filters: Array<{ key: FilterMode; label: string; href: string }> = [
    { key: "ceka_na_schvaleni", label: "Čeká na schválení", href: "/admin/proplaceni" },
    {
      key: "ceka_na_proplaceni",
      label: "Čeká na proplacení",
      href: "/admin/proplaceni?stav=ceka_na_proplaceni",
    },
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
            Schvalujte jednotlivé intervaly a náhrady. QR platbu a označení jako proplaceno použijte
            až ve finálním souhrnu zaměstnance na zakázce.
          </p>
        </div>
        <Badge variant="default">{groups.length} skupin</Badge>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-100/90">
        QR pro platbu a možnost označit jako proplaceno se zobrazí až po vypořádání všech požadavků
        zaměstnance na zakázce (schváleno nebo zamítnuto) a pokud existuje alespoň jedna schválená
        položka k výplatě. Otevřená docházka bez ukončení souhrn neblokuje, pouze zobrazí varování.
      </Card>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "rounded-full border px-4 py-2 text-sm font-bold transition",
              filter === item.key
                ? "border-blue-400 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné záznamy pro tento filtr.</div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <PayoutGroupCard
              key={group.key}
              zakazkaId={group.zakazkaId}
              userId={group.userId}
              zakazkaMeta={group.meta}
              profile={group.profile}
              workRows={group.workRows}
              travelRows={group.travelRows}
            />
          ))}
        </div>
      )}
    </div>
  );
}
