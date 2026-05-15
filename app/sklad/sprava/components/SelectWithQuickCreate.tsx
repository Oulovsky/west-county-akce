"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { QuickCreateConfigModal } from "./QuickCreateConfigModal";

const plusButtonClassDefault =
  "flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-lg font-bold leading-none text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

const plusButtonClassTable =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-900 text-sm font-bold leading-none text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50";

type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  selectStyle?: CSSProperties;
  selectClassName?: string;
  /** Bez tlačítka + a modalu (např. jednotky jen z konfigurace skladu). */
  showQuickCreate?: boolean;
  quickCreateTitle?: string;
  quickCreatePlaceholder?: string;
  quickCreateDisabled?: boolean;
  quickCreateDisabledTitle?: string;
  onQuickCreate?: (name: string) => Promise<{ error?: string } | void>;
  children?: ReactNode;
  /** Kompaktní varianta pro řádky tabulky správy. */
  variant?: "default" | "table";
};

export function SelectWithQuickCreate({
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  selectStyle,
  selectClassName,
  showQuickCreate = true,
  quickCreateTitle = "",
  quickCreatePlaceholder = "",
  quickCreateDisabled = false,
  quickCreateDisabledTitle,
  onQuickCreate = async () => {},
  children,
  variant = "default",
}: Props) {
  const plusButtonClass =
    variant === "table" ? plusButtonClassTable : plusButtonClassDefault;
  const wrapperGap = variant === "table" ? "gap-0.5" : "gap-1";
  const baseSelectClass =
    selectClassName ??
    (variant === "table"
      ? "min-w-0 flex-1 truncate text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
      : "min-w-0 flex-1");
  const resolvedSelectClassName = [
    baseSelectClass,
    !showQuickCreate ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate(name: string) {
    setSaving(true);
    const result = await onQuickCreate(name);
    setSaving(false);

    if (result && "error" in result && result.error) {
      window.alert(result.error);
      return;
    }

    setModalOpen(false);
  }

  return (
    <>
      <div
        className={
          showQuickCreate
            ? `flex min-w-0 flex-1 items-center ${wrapperGap}`
            : "flex min-w-0 w-full flex-1 items-center"
        }
      >
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
          className={resolvedSelectClassName}
          title={
            options.find((option) => option.value === value)?.label ??
            placeholder
          }
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option, index) => (
            <option
              key={`${option.value}-${option.label}-${index}`}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        {showQuickCreate ? (
          <button
            type="button"
            className={plusButtonClass}
            disabled={disabled || quickCreateDisabled || saving}
            title={quickCreateDisabled ? quickCreateDisabledTitle : quickCreateTitle}
            onClick={() => setModalOpen(true)}
          >
            +
          </button>
        ) : null}
      </div>

      {children}

      {showQuickCreate ? (
        <QuickCreateConfigModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={quickCreateTitle}
          placeholder={quickCreatePlaceholder}
          saving={saving}
          onSubmit={handleCreate}
        />
      ) : null}
    </>
  );
}
