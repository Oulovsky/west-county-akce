"use client";

const CASE_TREE_CHEVRON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-800/60 bg-emerald-950/40 text-xs font-bold text-emerald-200 transition hover:border-emerald-600 hover:bg-emerald-900/60 hover:text-white";

type Props = {
  isExpanded: boolean;
  onToggle: () => void;
  label: string;
};

export function SpravaObsahExpandControl({
  isExpanded,
  onToggle,
  label,
}: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={CASE_TREE_CHEVRON}
      title={isExpanded ? `Sbalit obsah ${label}` : `Rozbalit obsah ${label}`}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? `Sbalit obsah ${label}` : `Rozbalit obsah ${label}`}
    >
      {isExpanded ? "▾" : "▸"}
    </button>
  );
}
