"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  kusId: string;
  /** Nahradí výchozí styly spouštěcího tlačítka (např. výška jako u buněk tabulky). */
  triggerClassName?: string;
  /** Velikost QR ikony uvnitř tlačítka (výchozí kompaktní). */
  iconClassName?: string;
};

export function KusQrActionMenu({ kusId, triggerClassName, iconClassName }: Props) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const node = wrapRef.current;
      const target = event.target as Node | null;
      if (node && target && !node.contains(target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function copyKusId() {
    try {
      await navigator.clipboard.writeText(kusId);
      setOpen(false);
    } catch {
      window.alert("Kopírování ID do schránky se nezdařilo (oprávnění prohlížeče).");
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title="Akce štítku / QR"
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-900 text-slate-300 outline-none transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/60"
        }
      >
        <svg
          viewBox="0 0 24 24"
          className={iconClassName ?? "h-3.5 w-3.5"}
          fill="currentColor"
          aria-hidden
        >
          <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v6h-6v-2h4v-4zm-8 4h2v2H9v-2zm4 0h4v2h-4v-2z" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Akce štítku"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-slate-700 bg-slate-950 py-1 text-xs shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled
            title="Připravováno"
            className="block w-full px-3 py-1.5 text-left text-slate-500"
          >
            Tisk štítku
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            title="Připravováno"
            className="block w-full px-3 py-1.5 text-left text-slate-500"
          >
            Náhled štítku
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void copyKusId()}
            className="block w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-800"
          >
            Kopírovat ID kusu
          </button>
          {/* Budoucí: Historie kusu, Nahlásit poškození, Přesun / změna stavu */}
        </div>
      ) : null}
    </div>
  );
}
