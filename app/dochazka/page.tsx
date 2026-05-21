import { redirect } from "next/navigation";
import { isZakazkaId } from "@/lib/mobile/routes";
import { createClient } from "@/lib/supabase/server";
import { DochazkaPlaceholderClient } from "./DochazkaPlaceholderClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ zakazka?: string }>;
};

type ZakazkaOption = {
  zakazkaId: string;
  label: string;
};

type AssignmentRow = {
  zakazka_id: string;
  confirmation_status: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  zrusena: boolean | null;
};

function isAcceptedStatus(status: string | null) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "accepted" || normalized === "potvrzeno" || normalized === "";
}

export default async function DochazkaPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const initialZakazkaId = isZakazkaId(resolvedSearchParams?.zakazka)
    ? resolvedSearchParams?.zakazka
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignmentsRaw } = await supabase
    .from("zakazka_lide")
    .select("zakazka_id, confirmation_status")
    .eq("user_id", user.id);

  const assignments = ((assignmentsRaw ?? []) as AssignmentRow[]).filter((row) =>
    isAcceptedStatus(row.confirmation_status)
  );
  const zakazkaIds = [...new Set(assignments.map((row) => row.zakazka_id).filter(Boolean))];

  let zakazky: ZakazkaOption[] = [];

  if (zakazkaIds.length > 0) {
    const { data: zakazkyRaw } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, zrusena")
      .in("zakazka_id", zakazkaIds);

    zakazky = ((zakazkyRaw ?? []) as ZakazkaRow[])
      .filter((row) => row.zrusena !== true)
      .map((row) => ({
        zakazkaId: row.zakazka_id,
        label: `${row.cislo_zakazky?.trim() || "—"} · ${row.nazev?.trim() || "Bez názvu"}`,
      }));
  }

  return <DochazkaPlaceholderClient zakazky={zakazky} initialZakazkaId={initialZakazkaId} />;
}
