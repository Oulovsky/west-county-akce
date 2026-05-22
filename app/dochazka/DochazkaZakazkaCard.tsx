"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAssignmentPhaseAccentClass } from "@/lib/employee/assignment-display";
import { getAttendancePhaseLabel } from "@/lib/zakazka-attendance";
import type { TransportVehicleOption } from "@/lib/transport-attendance";
import { getZakazkaScanPath } from "@/lib/mobile/routes";
import { AttendanceActions } from "@/app/moje/AttendanceActions";
import { TransportAttendanceActions } from "@/app/moje/TransportAttendanceActions";
import {
  formatRange,
  getLogisticsStatusLabel,
  getZakazkaTitle,
  isLogisticsPhase,
  type DochazkaAssignmentRow,
  type DochazkaZakazkaGroup,
} from "./dochazka-shared";

const PHASE_CARD_CLASS =
  "flex h-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4";
const GRID_CLASS = "grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3";

function getPhaseAccentClass(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") {
    return "border-cyan-400/70 bg-cyan-500/15 text-cyan-50";
  }
  if (raw === "stavba") return "border-amber-400/70 bg-amber-500/15 text-amber-50";
  if (raw === "bourani" || raw === "bourání") {
    return "border-orange-400/70 bg-orange-500/15 text-orange-50";
  }
  return "border-blue-400/70 bg-blue-500/15 text-blue-50";
}

function DochazkaPhaseCard({ assignment, logistikaStav }: { assignment: DochazkaAssignmentRow; logistikaStav: string | null }) {
  return (
    <div className={PHASE_CARD_CLASS}>
      <div
        className={[
          "inline-flex w-fit rounded-xl border px-4 py-2 text-lg font-black tracking-tight",
          getAssignmentPhaseAccentClass(assignment.typ_bloku),
        ].join(" ")}
      >
        {getAttendancePhaseLabel(assignment.typ_bloku)}
      </div>
      <div className="text-sm font-semibold text-slate-300">
        {formatRange(assignment.datum_od, assignment.datum_do)}
      </div>
      {isLogisticsPhase(assignment.typ_bloku) ? (
        <div className="inline-flex w-fit rounded-md border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-100">
          {getLogisticsStatusLabel(logistikaStav)}
        </div>
      ) : null}
      {assignment.poznamka ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
          {assignment.poznamka}
        </div>
      ) : null}
      <div className="mt-auto">
        <AttendanceActions
          assignmentId={assignment.id}
          active={Boolean(assignment.active_attendance_id)}
        />
      </div>
    </div>
  );
}

type TransportState = {
  active: boolean;
  mode: "firemni" | "vlastni" | null;
};

export function DochazkaZakazkaCard({
  group,
  transport,
  companyVehicles,
  privateVehicles,
  highlighted,
}: {
  group: DochazkaZakazkaGroup;
  transport: TransportState | null;
  companyVehicles: TransportVehicleOption[];
  privateVehicles: TransportVehicleOption[];
  highlighted: boolean;
}) {
  const { zakazkaId, zakazka, assignments } = group;

  return (
    <div id={`dochazka-zakazka-${zakazkaId}`} className="scroll-mt-4">
    <Card
      className={[
        "space-y-4",
        highlighted ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "border-slate-700",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-xl font-black text-white">{getZakazkaTitle(zakazka)}</div>
          <div className="mt-1 break-words text-sm text-slate-400">{zakazka?.misto || "Místo není vyplněné"}</div>
        </div>
        <Badge variant="success">Potvrzeno</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/moje/zakazky/${zakazkaId}`}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
        >
          Detail zakázky
        </Link>
        <Link
          href={getZakazkaScanPath(zakazkaId)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-500"
        >
          Scan
        </Link>
      </div>

      {assignments.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Pracovní fáze</div>
          <div className={GRID_CLASS}>
            {assignments.map((assignment) => (
              <DochazkaPhaseCard
                key={assignment.id}
                assignment={assignment}
                logistikaStav={zakazka?.logistika_stav ?? null}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Přeprava</div>
        <div className={PHASE_CARD_CLASS}>
          <div
            className={[
              "inline-flex w-fit rounded-xl border px-4 py-2 text-lg font-black tracking-tight",
              "border-violet-400/70 bg-violet-500/15 text-violet-50",
            ].join(" ")}
          >
            Přeprava
          </div>
          <p className="text-xs font-semibold text-slate-400">
            Firemní nebo vlastní vozidlo · km u vlastního auta při ukončení
          </p>
          <TransportAttendanceActions
            zakazkaId={zakazkaId}
            active={Boolean(transport?.active)}
            activeTransportMode={transport?.mode ?? null}
            companyVehicles={companyVehicles}
            privateVehicles={privateVehicles}
            embedded
          />
        </div>
      </div>
    </Card>
    </div>
  );
}
