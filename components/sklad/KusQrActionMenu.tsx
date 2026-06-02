"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { KusLabelPrintDialog } from "@/components/sklad/KusLabelPrintDialog";
import {
  getSkladKusFuturePath,
  type SkladKusLabelPayload,
} from "@/lib/sklad/kusLabels";

type Props = {
  kusId: string;
  label?: SkladKusLabelPayload;
  /** Nahradí výchozí styly spouštěcího tlačítka (např. výška jako u buněk tabulky). */
  triggerClassName?: string;
  /** Velikost QR ikony uvnitř tlačítka (výchozí kompaktní). */
  iconClassName?: string;
  /** Vzhled rozbalovací nabídky (vyšší z-index ve vnořeném scroll kontextu). */
  menuVariant?: "default" | "sprava";
  /** Skrýt odkaz na detail kusu — detail má být mimo QR menu (např. /sklad/[id]). */
  hideDetailLink?: boolean;
};

const MENU_WIDTH = 192;
const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;

export function KusQrActionMenu({
  kusId,
  label,
  triggerClassName,
  iconClassName,
  menuVariant = "default",
  hideDetailLink = false,
}: Props) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autoPrintPreview, setAutoPrintPreview] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const trigger = wrapRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? MENU_WIDTH;
      const left = Math.min(
        Math.max(VIEWPORT_PADDING, rect.right - measuredWidth),
        window.innerWidth - measuredWidth - VIEWPORT_PADDING
      );

      setMenuStyle({
        position: "fixed",
        top: Math.min(rect.bottom + MENU_GAP, window.innerHeight - VIEWPORT_PADDING),
        left,
        width: measuredWidth,
        zIndex: 1000,
      });
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const trigger = wrapRef.current;
      const menu = menuRef.current;
      const target = event.target as Node | null;
      if (
        target &&
        !trigger?.contains(target) &&
        !menu?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
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

  function openLabelPreview(autoPrint: boolean) {
    setOpen(false);
    setAutoPrintPreview(autoPrint);
    setPreviewOpen(true);
  }

  const menuClassName = [
    "rounded-lg border py-1 text-xs text-slate-100 shadow-2xl ring-1 ring-black/60",
    menuVariant === "sprava"
      ? "border-slate-500 bg-[#020617]"
      : "border-slate-600 bg-[#020617]",
  ].join(" ");

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Akce štítku"
      className={menuClassName}
      style={{
        ...(menuStyle ?? {
          position: "fixed",
          left: -9999,
          top: -9999,
          width: MENU_WIDTH,
        }),
        backgroundColor: "#020617",
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.75)",
      }}
    >
      {hideDetailLink ? null : (
        <Link
          href={getSkladKusFuturePath(kusId)}
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5 shrink-0"
            fill="currentColor"
            aria-hidden
          >
            <path d="M11 3a1 1 0 1 0 0 2h2.586L7.293 11.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5z" />
          </svg>
          <span>Otevřít detail kusu</span>
        </Link>
      )}
      <button
        type="button"
        role="menuitem"
        disabled={!label}
        title={label ? "Vytisknout QR štítek" : "Chybí data štítku"}
        onClick={() => openLabelPreview(true)}
        className="block w-full px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800 disabled:text-slate-500 disabled:hover:bg-transparent"
      >
        Tisk štítku
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!label}
        title={label ? "Zobrazit náhled štítku" : "Chybí data štítku"}
        onClick={() => openLabelPreview(false)}
        className="block w-full px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800 disabled:text-slate-500 disabled:hover:bg-transparent"
      >
        Náhled štítku
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => void copyKusId()}
        className="block w-full px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800"
      >
        Kopírovat ID kusu
      </button>
      {/* Budoucí: Historie kusu, Nahlásit poškození, Přesun / změna stavu */}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className="relative z-20 shrink-0">
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

      {mounted && menu ? createPortal(menu, document.body) : null}

      {label ? (
        <KusLabelPrintDialog
          open={previewOpen}
          labels={[label]}
          autoPrintOnOpen={autoPrintPreview}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
