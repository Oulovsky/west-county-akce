"use client";

import Link from "next/link";
import { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { formatMoney } from "./formatMoney";
import { formatNumber } from "./formatNumber";
import { toNumber } from "./toNumber";
import {
  dangerBoxRight,
  inputStyle,
  inputStyleSmall,
  mutedBoxRight,
  selectStyle,
  valueBoxLeft,
  valueBoxRight,
} from "./styles";

type Item = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
  celkem_k_dispozici: number;
  jednotka: string | null;
  interni_naklad: number | null;
  fakturacni_cena: number | null;
  sklad_blok_id: string | null;
  na_sklade: number | null;
  na_akcich: number | null;
  poskozene: number | null;
};

type Blok = {
  sklad_blok_id: string;
  nazev: string;
};

type Kategorie = {
  kategorie_techniky_id: string;
  nazev: string;
};

type Podkategorie = {
  podkategorie_techniky_id: string;
  nazev: string;
};

type Jednotka = {
  jednotka_id: string;
  nazev: string;
};

type Draft = {
  nazev: string;
  kusy: string;
  jednotka: string;
  naklad: string;
  rent: string;
};

type Props = {
  item: Item;
  isEditing: boolean;
  isSaving: boolean;
  isHighlight: boolean;
  draft: Draft;
  bloky: Blok[];
  jednotky: Jednotka[];
  kategorieOptions: Kategorie[];
  podkategorieOptions: Podkategorie[];
  onStartEdit: () => void;
  onUpdateZaklad: (
    kategorieId: string | null,
    podkategorieId: string | null,
    blokId: string | null
  ) => void;
  onDraftChange: Dispatch<SetStateAction<Draft>>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export function SkladTableRow({
  item,
  isEditing,
  isSaving,
  isHighlight,
  draft,
  bloky,
  jednotky,
  kategorieOptions,
  podkategorieOptions,
  onStartEdit,
  onUpdateZaklad,
  onDraftChange,
  onKeyDown,
}: Props) {
  const tableGrid =
    "grid-cols-[minmax(190px,2fr)_120px_130px_150px_70px_80px_80px_90px_90px_100px_90px_100px]";

  return (
    <div
      className={[
        "grid",
        tableGrid,
        "border-t border-slate-800 px-3 py-2.5 text-sm transition",
        isHighlight ? "bg-blue-950/40" : "bg-transparent",
        isSaving ? "opacity-60" : "opacity-100",
      ].join(" ")}
    >
      <div
        onClick={() => !isEditing && onStartEdit()}
        className="sticky left-0 z-10 flex min-h-[44px] items-center bg-inherit pr-3"
        style={{ cursor: "pointer" }}
      >
        {isEditing ? (
          <input
            autoFocus
            value={draft.nazev}
            onChange={(e) =>
              onDraftChange((prev) => ({
                ...prev,
                nazev: e.target.value,
              }))
            }
            onKeyDown={onKeyDown}
            style={inputStyle}
          />
        ) : (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {item.nazev}
            </div>

            <div className="mt-0.5 text-xs text-slate-500">
              ID: {item.skladova_polozka_id}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center px-2">
        <select
          value={item.sklad_blok_id ?? ""}
          disabled={isSaving}
          onChange={(e) =>
            onUpdateZaklad(
              null,
              null,
              e.target.value || null
            )
          }
          style={selectStyle}
        >
          <option value="">Nepřiřazeno</option>

          {bloky.map((b) => (
            <option
              key={b.sklad_blok_id}
              value={b.sklad_blok_id}
            >
              {b.nazev}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center px-2">
        <select
          value={item.kategorie_techniky_id ?? ""}
          disabled={isSaving || !item.sklad_blok_id}
          onChange={(e) =>
            onUpdateZaklad(
              e.target.value || null,
              null,
              item.sklad_blok_id
            )
          }
          style={selectStyle}
        >
          <option value="">Bez kategorie</option>

          {kategorieOptions.map((k) => (
            <option
              key={k.kategorie_techniky_id}
              value={k.kategorie_techniky_id}
            >
              {k.nazev}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center px-2">
        <select
          value={item.podkategorie_techniky_id ?? ""}
          disabled={
            isSaving ||
            !item.kategorie_techniky_id
          }
          onChange={(e) =>
            onUpdateZaklad(
              item.kategorie_techniky_id,
              e.target.value || null,
              item.sklad_blok_id
            )
          }
          style={selectStyle}
        >
          <option value="">Bez typu</option>

          {podkategorieOptions.map((p) => (
            <option
              key={p.podkategorie_techniky_id}
              value={p.podkategorie_techniky_id}
            >
              {p.nazev}
            </option>
          ))}
        </select>
      </div>

      <div
        onClick={() => !isEditing && onStartEdit()}
        className="flex items-center justify-end px-2 text-right"
        style={{ cursor: "pointer" }}
      >
        {isEditing ? (
          <input
            value={draft.kusy}
            onChange={(e) =>
              onDraftChange((prev) => ({
                ...prev,
                kusy: e.target.value,
              }))
            }
            onKeyDown={onKeyDown}
            style={inputStyleSmall}
          />
        ) : (
          <span style={valueBoxRight}>
            {formatNumber(item.celkem_k_dispozici)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end px-2 text-right">
        <span style={valueBoxRight}>
          {formatNumber(item.na_sklade)}
        </span>
      </div>

      <div className="flex items-center justify-end px-2 text-right">
        <span style={valueBoxRight}>
          {formatNumber(item.na_akcich)}
        </span>
      </div>

      <div className="flex items-center justify-end px-2 text-right">
        {toNumber(item.poskozene) > 0 ? (
          <Link
            href={`/sklad/${item.skladova_polozka_id}`}
            style={dangerBoxRight}
          >
            {formatNumber(item.poskozene)}
          </Link>
        ) : (
          <span style={mutedBoxRight}>
            {formatNumber(item.poskozene)}
          </span>
        )}
      </div>

      <div
        onClick={() => !isEditing && onStartEdit()}
        className="flex items-center px-2"
        style={{ cursor: "pointer" }}
      >
        {isEditing ? (
          <select
            value={draft.jednotka}
            onChange={(e) =>
              onDraftChange((prev) => ({
                ...prev,
                jednotka: e.target.value,
              }))
            }
            style={selectStyle}
          >
            {jednotky.map((j) => (
              <option
                key={j.jednotka_id}
                value={j.nazev}
              >
                {j.nazev}
              </option>
            ))}
          </select>
        ) : (
          <span style={valueBoxLeft}>
            {item.jednotka ?? "-"}
          </span>
        )}
      </div>

      <div
        onClick={() => !isEditing && onStartEdit()}
        className="flex items-center justify-end px-2 text-right"
        style={{ cursor: "pointer" }}
      >
        {isEditing ? (
          <input
            value={draft.naklad}
            onChange={(e) =>
              onDraftChange((prev) => ({
                ...prev,
                naklad: e.target.value,
              }))
            }
            onKeyDown={onKeyDown}
            style={inputStyleSmall}
          />
        ) : (
          <span style={valueBoxRight}>
            {formatMoney(item.interni_naklad)}
          </span>
        )}
      </div>

      <div
        onClick={() => !isEditing && onStartEdit()}
        className="flex items-center justify-end px-2 text-right"
        style={{ cursor: "pointer" }}
      >
        {isEditing ? (
          <input
            value={draft.rent}
            onChange={(e) =>
              onDraftChange((prev) => ({
                ...prev,
                rent: e.target.value,
              }))
            }
            onKeyDown={onKeyDown}
            style={inputStyleSmall}
          />
        ) : (
          <span style={valueBoxRight}>
            {formatMoney(item.fakturacni_cena)}
          </span>
        )}
      </div>

      <div className="flex items-center px-2">
        <Link
          href={`/sklad/${item.skladova_polozka_id}`}
          className="inline-flex w-full items-center justify-center rounded-xl border border-amber-700 bg-amber-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Detail
        </Link>
      </div>
    </div>
  );
}
