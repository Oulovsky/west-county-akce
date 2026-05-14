"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import PeopleTimelineClient from "./lide/PeopleTimelineClient";
import EventTooltip from "./EventTooltip";
import {
  SharedTooltipData,
  getOccupancyBlockClass,
  getOccupancyLabel,
  getOccupancyTone,
} from "./calendarShared";

type Event = {
  id: string;
  nazev: string;
  datum_od: string;
  datum_do: string;
  people_count: number;
  required_people: number;
  has_conflict?: boolean;
  typ_obsluhy?: string | null;
};

type HoveredEvent = {
  x: number;
  y: number;
  data: SharedTooltipData;
};

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

const d = (s: string) => new Date(s);
const startDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
const endDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
const add = (x: Date, n: number) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const weekStart = (x: Date) => {
  const date = new Date(x);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return startDay(date);
};

const monthGrid = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = weekStart(first);
  const end = add(weekStart(last), 6);

  const arr: Date[] = [];
  let cur = new Date(start);

  while (cur <= end) {
    arr.push(new Date(cur));
    cur = add(cur, 1);
  }

  return arr;
};

function isBezObsluhy(value?: string | null) {
  return String(value ?? "").trim().toLowerCase() === "bez_obsluhy";
}

function buildBars(week: Date[], events: Event[]) {
  const ws = startDay(week[0]);
  const we = startDay(week[6]);

  const list = events
    .map((event) => {
      const s = startDay(d(event.datum_od));
      const en = startDay(d(event.datum_do));

      if (en < ws || s > we) return null;

      return {
        e: event,
        s: Math.max(0, Math.floor((s.getTime() - ws.getTime()) / 86400000)),
        en: Math.min(6, Math.floor((en.getTime() - ws.getTime()) / 86400000)),
      };
    })
    .filter(Boolean) as Array<{
    e: Event;
    s: number;
    en: number;
  }>;

  list.sort((a, b) => a.s - b.s);

  const rows: Array<Array<{ e: Event; s: number; en: number }>> = [];

  for (const item of list) {
    let placed = false;

    for (const row of rows) {
      const clash = row.some((x) => !(item.en < x.s || item.s > x.en));
      if (!clash) {
        row.push(item);
        placed = true;
        break;
      }
    }

    if (!placed) rows.push([item]);
  }

  return rows.slice(0, 4);
}

function ToolbarButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-2 text-sm transition",
        active
          ? "border-blue-500 bg-blue-600/20 text-white"
          : "border-transparent text-slate-300 hover:bg-blue-600/10 hover:text-blue-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function KalendarClient({ data }: { data: Event[] }) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [mode, setMode] = useState<"zakazky" | "lide">("zakazky");
  const [view, setView] = useState<"month" | "week">("month");
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>(data || []);
  const [hovered, setHovered] = useState<HoveredEvent | null>(null);

  const today = useMemo(() => startDay(new Date()), []);

  const days = useMemo(() => {
    return view === "month"
      ? monthGrid(date)
      : Array.from({ length: 7 }, (_, i) => add(weekStart(date), i));
  }, [date, view]);

  const weeks = useMemo(() => {
    if (view === "week") return [days];

    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days, view]);

  const rangeFrom = useMemo(() => {
    return days.length ? startDay(days[0]).toISOString() : startDay(date).toISOString();
  }, [days, date]);

  const rangeTo = useMemo(() => {
    return days.length ? endDay(days[days.length - 1]).toISOString() : endDay(date).toISOString();
  }, [days, date]);

  const refresh = useCallback(async () => {
    const visibleDays =
      view === "month"
        ? monthGrid(date)
        : Array.from({ length: 7 }, (_, i) => add(weekStart(date), i));

    const { data: rpcData } = await supabase.rpc("get_kalendar_zakazky", {
      p_from: visibleDays[0].toISOString().split("T")[0],
      p_to: visibleDays[visibleDays.length - 1].toISOString().split("T")[0],
    });

    setEvents((rpcData || []) as Event[]);
  }, [date, view, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel("cal")
      .on("postgres_changes", { event: "*", schema: "public", table: "zakazky" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "zakazka_lide" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [refresh, supabase]);

  return (
    <div className="w-full text-white" onMouseLeave={() => setHovered(null)}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold">Kalendář</h1>

          <div className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#0b1324] p-1">
            <ToolbarButton active={mode === "zakazky"} onClick={() => setMode("zakazky")}>
              Zakázky
            </ToolbarButton>
            <ToolbarButton active={mode === "lide"} onClick={() => setMode("lide")}>
              Lidé
            </ToolbarButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton onClick={() => setDate(add(date, view === "month" ? -30 : -7))}>
            ←
          </ToolbarButton>
          <ToolbarButton onClick={() => setDate(new Date())}>Dnes</ToolbarButton>
          <ToolbarButton onClick={() => setDate(add(date, view === "month" ? 30 : 7))}>
            →
          </ToolbarButton>

          <div className="ml-2 min-w-[160px] text-sm text-slate-300">
            {date.toLocaleString("cs-CZ", { month: "long", year: "numeric" })}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#0b1324] p-1">
            <ToolbarButton active={view === "month"} onClick={() => setView("month")}>
              Měsíc
            </ToolbarButton>
            <ToolbarButton active={view === "week"} onClick={() => setView("week")}>
              Týden
            </ToolbarButton>
          </div>
        </div>
      </div>

      {mode === "lide" ? (
        <div>
          <PeopleTimelineClient from={rangeFrom} to={rangeTo} />
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-7 gap-2 text-sm text-slate-300">
            {DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="space-y-3">
            {weeks.map((week, i) => {
              const bars = buildBars(week, events);
              const rowHeight = 32;
              const rowGap = 6;
              const headerOffset = 36;
              const maxRows = Math.max(bars.length, 1);
              const overlayHeight =
                headerOffset + maxRows * rowHeight + Math.max(0, maxRows - 1) * rowGap + 8;
              const cellHeight = Math.max(96, overlayHeight);

              return (
                <div key={i} className="relative">
                  <div className="grid grid-cols-7 gap-2">
                    {week.map((day) => {
                      const isToday = isSameDay(day, today);

                      return (
                        <div
                          key={day.toISOString()}
                          className={[
                            "relative rounded border p-2 text-sm",
                            isToday
                              ? "border-cyan-500/40 bg-cyan-500/10"
                              : "border-[#334155] bg-[#0b1324]",
                          ].join(" ")}
                          style={{ height: `${cellHeight}px` }}
                        >
                          <div
                            className={
                              isToday
                                ? "inline-flex h-6 min-w-6 items-center justify-center rounded bg-cyan-500/25 px-1 font-semibold text-cyan-100"
                                : ""
                            }
                          >
                            {day.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    {bars.map((row, ri) => {
                      const topPx = headerOffset + ri * (rowHeight + rowGap);

                      return (
                        <div
                          key={ri}
                          className="absolute left-0 right-0 grid grid-cols-7 gap-2"
                          style={{ top: `${topPx}px` }}
                        >
                          {Array.from({ length: 7 }).map((_, ci) => {
                            const item = row.find((x) => x.s === ci);

                            if (!item) {
                              const covered = row.some((x) => ci > x.s && ci <= x.en);
                              if (covered) return null;
                              return <div key={ci} className="h-0" />;
                            }

                            const span = item.en - item.s + 1;
                            const isNoCrew = isBezObsluhy(item.e.typ_obsluhy);
                            const statusTone = isNoCrew
                              ? "blue"
                              : getOccupancyTone(item.e.people_count, item.e.required_people);
                            const statusLabel = isNoCrew
                              ? "Bez obsluhy"
                              : getOccupancyLabel(item.e.people_count, item.e.required_people);
                            const warningLabel = isNoCrew
                              ? null
                              : item.e.has_conflict
                                ? "Kolize lidí na zakázce"
                                : item.e.required_people > 0 && item.e.people_count < item.e.required_people
                                  ? "Chybí lidi"
                                  : null;

                            const tooltipData: SharedTooltipData = {
                              title: item.e.nazev,
                              from: item.e.datum_od,
                              to: item.e.datum_do,
                              statusLabel,
                              statusTone,
                              warningLabel,
                              metaLabel: isNoCrew
                                ? "Akce bez obsluhy"
                                : item.e.required_people > 0
                                  ? `Obsazenost: ${item.e.people_count}/${item.e.required_people}`
                                  : `Přiřazeno lidí: ${item.e.people_count}`,
                            };

                            return (
                              <div
                                key={ci}
                                style={{ gridColumn: `${ci + 1} / span ${span}` }}
                              >
                                <button
                                  type="button"
                                  onClick={() => router.push(`/zakazky/${item.e.id}`)}
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
                                  className={`${getOccupancyBlockClass(
                                    item.e.people_count,
                                    item.e.required_people,
                                    item.e.has_conflict,
                                    item.e.typ_obsluhy
                                  )} pointer-events-auto flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-white transition`}
                                >
                                  <span className="truncate">
                                    {item.e.nazev}
                                    {!isNoCrew && item.e.required_people > 0
                                      ? ` (${item.e.people_count}/${item.e.required_people})`
                                      : ""}
                                  </span>

                                  {!isNoCrew && item.e.has_conflict ? (
                                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-orange-200/50 bg-orange-200/20 px-1 text-[10px] font-bold text-orange-50">
                                      !
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {hovered ? <EventTooltip x={hovered.x} y={hovered.y} data={hovered.data} /> : null}
    </div>
  );
}
