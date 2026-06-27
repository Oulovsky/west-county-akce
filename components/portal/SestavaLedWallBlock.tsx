"use client";

import type { LedWallBlock } from "@/lib/client-portal/sestava-konfigurator-types";
import type { LedBlockKey } from "@/lib/client-portal/sestava-led-blocks";
import { LED_BLOCK_LABELS } from "@/lib/client-portal/sestava-led-blocks";

type Props = {
  blockKey: LedBlockKey;
  block: LedWallBlock;
  readOnly?: boolean;
  inputClass: string;
  labelClass: string;
  maxSirka?: number;
  maxVyska?: number;
  onChange: (next: LedWallBlock) => void;
};

function NumberField({
  label,
  value,
  onChange,
  readOnly,
  inputClass,
  min,
  max,
  step = 0.1,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
  inputClass: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        disabled={readOnly}
        className={inputClass}
      />
    </label>
  );
}

export default function SestavaLedWallBlock({
  blockKey,
  block,
  readOnly,
  inputClass,
  labelClass,
  maxSirka,
  maxVyska,
  onChange,
}: Props) {
  const label = LED_BLOCK_LABELS[blockKey];

  return (
    <details
      open={block.enabled}
      className="rounded-lg border border-white/10 bg-black/20"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-slate-200 [&::-webkit-details-marker]:hidden">
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={(e) => {
            e.stopPropagation();
            onChange({ ...block, enabled: e.target.checked });
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={readOnly}
        />
        <span>{label}</span>
      </summary>
      {block.enabled ? (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label={`Šířka (m) *${maxSirka != null ? ` · max ${maxSirka} m` : ""}`}
              value={block.sirka_m}
              onChange={(sirka_m) => onChange({ ...block, sirka_m })}
              readOnly={readOnly}
              inputClass={inputClass}
              max={maxSirka}
              required
            />
            <NumberField
              label={`Výška (m) *${maxVyska != null ? ` · max ${maxVyska} m` : ""}`}
              value={block.vyska_m}
              onChange={(vyska_m) => onChange({ ...block, vyska_m })}
              readOnly={readOnly}
              inputClass={inputClass}
              max={maxVyska}
              required
            />
          </div>
          {block.sirka_m && block.vyska_m ? (
            <p className="text-xs text-slate-400">
              Rozměr: {block.sirka_m} × {block.vyska_m} m
            </p>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
