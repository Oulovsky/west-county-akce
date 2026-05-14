"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EventTooltip from "../EventTooltip";
import { SharedTooltipData, getTimelineBlockClass } from "../calendarShared";

type Row = {
  user_id: string;
  user_name: string;
  typ_bloku: string;
  zakazka_id: string;
  zakazka_nazev: string;
  datum_od: string;
  datum_do: string;
  stav_zakazky_id: string;
};

type UserGroup = {
  user_id: string;
  user_name: string;
  items: TimelineItem[];
};

type TimelineItem = Row & {
  conflict: boolean;
};

type HoveredItem = {
  x: number;
  y: number;
  data: SharedTooltipData;
};

function startOfDay(value: string | Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value: string | Date) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function diffDaysInclusive(from: Date, to: Date) {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / 86400000) + 1;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function splitDisplayName(fullName: string) {
  const trimmed = (fullName || "").trim();

  if (!trimmed) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const parts = trimmed.split(/\s+/);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function overlap(a: Row, b: Row) {
  return (
    new Date(a.datum_od).getTime() < new Date(b.datum_do).getTime() &&
    new Date(a.datum_do).getTime() > new Date(b.datum_od).getTime()
  );
}

function buildItemsWithConflicts(items: Row[]) {
  return items.map((item) => {
    const conflict = items.some((other) => {
      if (other === item) return false;
      if (other.zakazka_id === item.zakazka_id) return false;
      return overlap(item, other);
    });

    return {
      ...item,
      conflict,
    };
  });
}

function buildLanes(items: TimelineItem[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.datum_od).getTime() - new Date(b.datum_od).getTime()
  );

  const laneA: TimelineItem[] = [];
  const laneB: TimelineItem[] = [];
  const laneExtra: TimelineItem[][] = [];

  let preferredLane: 0 | 1 = 0;

  for (const item of sorted) {
    const itemStart = new Date(item.datum_od).getTime();

    const lastA = laneA[laneA.length - 1];
    const lastB = laneB[laneB.length - 1];

    const fitsA = !lastA || itemStart >= new Date(lastA.datum_do).getTime();
    const fitsB = !lastB || itemStart >= new Date(lastB.datum_do).getTime();

    if (fitsA && fitsB) {
      if (preferredLane === 0) {
        laneA.push(item);
        preferredLane = 1;
      } else {
        laneB.push(item);
        preferredLane = 0;
      }
      continue;
    }

    if (fitsA) {
      laneA.push(item);
      preferredLane = 1;
      continue;
    }

    if (fitsB) {
      laneB.push(item);
      preferredLane = 0;
      continue;
    }

    let placed = false;

    for (const lane of laneExtra) {
      const last = lane[lane.length - 1];
      const fits = !last || itemStart >= new Date(last.datum_do).getTime();

      if (fits) {
        lane.push(item);
        placed = true;
        break;
      }
    }

    if (!placed) {
      laneExtra.push([item]);
    }
  }

  return [laneA, laneB, ...laneExtra].filter((lane) => lane.length > 0);
}

function formatBlockLabel(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "sklad" || raw === "logistika") return "Sklad / logistika";
  if (raw === "stavba") return "Stavba";
  if (raw === "bourani") return "Bourání";
  return "Akce";
}

export default function PeopleTimelineClient({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/kalendar/lide?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: "no-store" }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Nepodařilo se načíst data");
        }

        if (!cancelled) {
          setData(Array.isArray(json) ? json : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Neznámá chyba");
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const grouped = useMemo<UserGroup[]>((() => {
    const map = new Map<string, UserGroup>();

    for (const item of data) {
      if (!map.has(item.user_id)) {
        map.set(item.user_id, {
          user_id: item.user_id,
          user_name: item.user_name,
          items: [],
        });
      }

      map.get(item.user_id)!.items.push(item as TimelineItem);
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: buildItemsWithConflicts(group.items),
      }))
      .sort((a, b) => a.user_name.localeCompare(b.user_name, "cs"));
  }) as () => UserGroup[], [data]);

  const rangeStart = startOfDay(from);
  const rangeEnd = endOfDay(to);
  const totalDays = diffDaysInclusive(rangeStart, rangeEnd);
  const totalRangeMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
  const rangeStartTime = rangeStart.getTime();

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStartTime, totalDays]);

  const today = startOfDay(new Date()).getTime();

  if (loading) {
    return <div className="text-sm text-zinc-300">Načítám timeline lidí…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">Chyba: {error}</div>;
  }

  if (grouped.length === 0) {
    return (
      <div className="text-sm text-zinc-400">
        V zadaném období nejsou žádná přiřazení lidí.
      </div>
    );
  }

  return (
    <div className="relative w-full" onMouseLeave={() => setHovered(null)}>
      <div className="mb-4 text-sm text-zinc-400">
        Období: {rangeStart.toLocaleDateString("cs-CZ")} –{" "}
        {rangeEnd.toLocaleDateString("cs-CZ")}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0b1220]">
        <div className="grid" style={{ gridTemplateColumns: "170px 1fr" }}>
          <div className="border-b border-r border-zinc-800 bg-[#0f172a] p-3 text-sm font-semibold text-white">
            Lidé
          </div>

          <div
            className="grid border-b border-zinc-800"
            style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
          >
            {days.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = startOfDay(day).getTime() === today;

              return (
                <div
                  key={day.toISOString()}
                  className={[
                    "border-r border-zinc-800 p-2 text-center text-xs",
                    isToday
                      ? "bg-cyan-900/60 text-cyan-100"
                      : isWeekend
                        ? "bg-zinc-900/70 text-zinc-400"
                        : "bg-zinc-900 text-zinc-300",
                  ].join(" ")}
                >
                  <div className="font-semibold">
                    {day.toLocaleDateString("cs-CZ", { day: "numeric" })}
                  </div>
                  <div className="text-[10px] uppercase">
                    {day.toLocaleDateString("cs-CZ", { weekday: "short" })}
                  </div>
                </div>
              );
            })}
          </div>

          {grouped.map((user) => {
            const nameParts = splitDisplayName(user.user_name);
            const lanes = buildLanes(user.items);

            return (
              <div key={user.user_id} className="contents">
                <div className="border-b border-r border-zinc-800 bg-[#0f172a] px-4 py-5">
                  <div className="text-base text-slate-200">
                    {nameParts.firstName || "—"}
                  </div>
                  <div className="text-2xl font-bold leading-tight text-white">
                    {nameParts.lastName || ""}
                  </div>
                </div>

                <div
                  className="relative border-b border-zinc-800"
                  style={{ minHeight: `${Math.max(lanes.length, 1) * 40 + 16}px` }}
                >
                  <div
                    className="absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
                  >
                    {days.map((day) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = startOfDay(day).getTime() === today;

                      return (
                        <div
                          key={`${user.user_id}-${day.toISOString()}`}
                          className={[
                            "border-r border-zinc-800",
                            isToday
                              ? "bg-cyan-950/20"
                              : isWeekend
                                ? "bg-zinc-900/30"
                                : "bg-transparent",
                          ].join(" ")}
                        />
                      );
                    })}
                  </div>

                  {lanes.map((lane, laneIndex) =>
                    lane.map((item) => {
                      const itemStart = new Date(item.datum_od);
                      const itemEnd = new Date(item.datum_do);

                      const clippedStartMs = Math.max(itemStart.getTime(), rangeStart.getTime());
                      const clippedEndMs = Math.min(itemEnd.getTime(), rangeEnd.getTime());

                      if (clippedEndMs <= clippedStartMs) {
                        return null;
                      }

                      const leftPct = ((clippedStartMs - rangeStart.getTime()) / totalRangeMs) * 100;
                      const widthPct = ((clippedEndMs - clippedStartMs) / totalRangeMs) * 100;
                      const topPx = 8 + laneIndex * 40;
                      const showText = widthPct > 6;

                      const tooltipData: SharedTooltipData = {
                        title: item.zakazka_nazev,
                        from: item.datum_od,
                        to: item.datum_do,
                        people: [item.user_name],
                        statusLabel: item.conflict ? "Kolize" : "Bez kolize",
                        statusTone: item.conflict ? "orange" : "blue",
                        warningLabel: item.conflict ? "Kolize s jinou zakázkou" : null,
                        metaLabel: `Přiřazení: ${formatBlockLabel(item.typ_bloku)}`,
                      };

                      return (
                        <Link
                          key={`${item.zakazka_id}-${item.typ_bloku}-${item.datum_od}-${laneIndex}`}
                          href={`/zakazky/${item.zakazka_id}?user=${item.user_id}`}
                          className={`absolute z-10 rounded-lg border px-2 py-1 text-white shadow transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${getTimelineBlockClass(item.conflict)}`}
                          style={{
                            top: `${topPx}px`,
                            height: "32px",
                            left: `calc(${leftPct}% + 4px)`,
                            width: `max(calc(${widthPct}% - 8px), 18px)`,
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHovered({
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                              data: tooltipData,
                            });
                          }}
                          onMouseMove={(e) => {
                            setHovered({
                              x: e.clientX,
                              y: e.clientY,
                              data: tooltipData,
                            });
                          }}
                          onMouseLeave={() => setHovered(null)}
                        >
                          {showText ? (
                            <div className="truncate text-xs font-semibold">
                              {item.zakazka_nazev}
                            </div>
                          ) : null}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hovered ? <EventTooltip x={hovered.x} y={hovered.y} data={hovered.data} /> : null}
    </div>
  );
}