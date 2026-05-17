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
  poznamka: string | null;
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

      <div className="grid gap-2 sm:grid-cols-2">
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

      <FilterPills activeFilter={activeFilter} />

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
