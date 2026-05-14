export type TooltipTone = "blue" | "green" | "orange" | "red";

export type SharedTooltipData = {
  title: string;
  from: string;
  to: string;
  people?: string[];
  statusLabel: string;
  statusTone: TooltipTone;
  warningLabel?: string | null;
  metaLabel?: string | null;
};

function isBezObsluhy(value?: string | null) {
  return String(value ?? "").trim().toLowerCase() === "bez_obsluhy";
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getToneBadgeClass(tone: TooltipTone) {
  switch (tone) {
    case "green":
      return "border border-green-400/30 bg-green-500/20 text-green-200";
    case "orange":
      return "border border-orange-400/30 bg-orange-500/20 text-orange-200";
    case "red":
      return "border border-red-400/30 bg-red-500/20 text-red-200";
    default:
      return "border border-blue-400/30 bg-blue-500/20 text-blue-200";
  }
}

export function getTimelineBlockClass(hasConflict: boolean) {
  if (hasConflict) {
    return "border-orange-300/70 bg-orange-500 hover:bg-orange-400";
  }

  return "border-blue-300/40 bg-blue-500 hover:bg-blue-400";
}

export function getOccupancyTone(
  count: number,
  required: number,
  typObsluhy?: string | null
): TooltipTone {
  if (isBezObsluhy(typObsluhy)) return "blue";
  if (!required) return "blue";
  if (count === 0) return "red";
  if (count < required) return "orange";
  return "green";
}

export function getOccupancyLabel(
  count: number,
  required: number,
  typObsluhy?: string | null
) {
  if (isBezObsluhy(typObsluhy)) {
    return "Bez obsluhy";
  }

  if (!required) {
    return count > 0 ? `Přiřazeno ${count} lidí` : "Bez cílové obsazenosti";
  }

  if (count === 0) {
    return "Neobsazeno";
  }

  if (count < required) {
    return `Částečně obsazeno (${count}/${required})`;
  }

  return `Obsazeno (${count}/${required})`;
}

export function getOccupancyBlockClass(
  count: number,
  required: number,
  hasConflict?: boolean,
  typObsluhy?: string | null
) {
  if (isBezObsluhy(typObsluhy)) {
    return "bg-slate-600 hover:bg-slate-500";
  }

  if (hasConflict) {
    return "bg-orange-500 hover:bg-orange-400";
  }

  const tone = getOccupancyTone(count, required, typObsluhy);

  switch (tone) {
    case "red":
      return "bg-red-600 hover:bg-red-500";
    case "orange":
      return "bg-orange-500 hover:bg-orange-400";
    case "green":
      return "bg-green-600 hover:bg-green-500";
    default:
      return "bg-blue-600 hover:bg-blue-500";
  }
}