import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ParticipationActions } from "./ParticipationActions";

type AssignmentRow = {
  id: string | number;
  zakazka_id: string;
  user_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  confirmation_status: string | null;
  declined_reason: string | null;
  responded_at: string | null;
  assigned_at: string | null;
  created_at: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  poznamka: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  zrusena: boolean | null;
};

function normalizeStatus(value?: string | null) {
  if (value === "accepted") return "accepted";
  if (value === "declined") return "declined";
  return "pending";
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

export default async function MojePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select(
      "id, zakazka_id, user_id, datum_od, datum_do, typ_bloku, confirmation_status, declined_reason, responded_at, assigned_at, created_at"
    )
    .eq("user_id", user.id)
    .order("datum_od", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    return <div>Chyba načtení mých zakázek: {assignmentsError.message}</div>;
  }

  const assignments = (assignmentsRaw ?? []) as AssignmentRow[];
  const zakazkaIds = [...new Set(assignments.map((assignment) => assignment.zakazka_id))];
  let zakazkyById = new Map<string, ZakazkaRow>();

  if (zakazkaIds.length > 0) {
    const { data: zakazkyRaw, error: zakazkyError } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, misto, poznamka, akce_od, akce_do, datum_od, datum_do, zrusena")
      .in("zakazka_id", zakazkaIds);

    if (zakazkyError) {
      return <div>Chyba načtení detailů zakázek: {zakazkyError.message}</div>;
    }

    zakazkyById = new Map(((zakazkyRaw ?? []) as ZakazkaRow[]).map((zakazka) => [zakazka.zakazka_id, zakazka]));
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
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

      {assignments.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Aktuálně nemáte žádné přiřazené zakázky.</div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignments.map((assignment) => {
            const zakazka = zakazkyById.get(assignment.zakazka_id) ?? null;
            const status = normalizeStatus(assignment.confirmation_status);

            return (
              <Card key={String(assignment.id)} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {getZakazkaTitle(zakazka)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {zakazka?.misto || "Místo není vyplněné"}
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Fáze práce</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {getPhaseLabel(assignment.typ_bloku)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Čas</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatRange(assignment.datum_od, assignment.datum_do)}
                    </div>
                  </div>
                </div>

                {zakazka?.poznamka ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Poznámka</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                      {zakazka.poznamka}
                    </div>
                  </div>
                ) : null}

                {status === "declined" && assignment.declined_reason ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    Důvod odmítnutí: {assignment.declined_reason}
                  </div>
                ) : null}

                {status === "pending" ? (
                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                    Máte novou zakázku.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/zakazky/${assignment.zakazka_id}`}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                  >
                    Otevřít zakázku
                  </Link>
                  <ParticipationActions assignmentId={String(assignment.id)} status={status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
