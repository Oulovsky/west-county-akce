"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type TimelineEvent = {
  id: string;
  date: string;
  type: string;
  actorLabel: string;
  title: string;
  detail: string | null;
};

function formatTimelineDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(date.getTime())) return formatTimelineDate(value);
  if (diffMs < 60_000) return "teď";

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `před ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `před ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `před ${diffDays} d`;

  return formatTimelineDate(value);
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={[
        "h-5 w-5 shrink-0 text-slate-400 transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function HistoryTimelineCard({ events }: { events: TimelineEvent[] }) {
  const [open, setOpen] = useState(false);
  const lastEvent = events[0] ?? null;
  const lastEventLabel = useMemo(() => {
    if (!lastEvent) return "Zatím bez provozní historie.";
    return `Poslední událost: ${lastEvent.title} · ${formatRelativeTime(lastEvent.date)}`;
  }, [lastEvent]);

  return (
    <Card className="mt-6 space-y-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-white">Historie zakázky</div>
            <Badge variant="default">{events.length} událostí</Badge>
          </div>
          <div className="mt-1 text-sm text-slate-400">{lastEventLabel}</div>
        </div>
        <div className="rounded-full border border-slate-700 bg-slate-950/70 p-2">
          <ChevronIcon open={open} />
        </div>
      </button>

      {open ? (
        events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
            Zatím bez provozní historie.
          </div>
        ) : (
          <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{event.type}</Badge>
                      <div className="font-semibold text-white">{event.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{event.actorLabel}</div>
                    {event.detail ? (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                        {event.detail}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    {formatTimelineDate(event.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </Card>
  );
}
