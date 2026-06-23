"use client";

import { useMemo } from "react";
import { SelectWithQuickCreate } from "./SelectWithQuickCreate";
import { SPRAVA_TABLE_INHERITED_CELL } from "./spravaTableLayout";
import { tableSelectStyle, tableValueBoxLeft } from "./styles";
import type { SpravaObsahPolozkaUpdaters } from "./spravaCaseObsahTreeTypes";
import { SKLAD_EMPTY_LABEL, SKLAD_EMPTY_LABEL_EM } from "@/lib/sklad/constants";
import type { SkladBlok, TechnickyVlastnik } from "@/lib/sklad/types";

function labelText(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : SKLAD_EMPTY_LABEL_EM;
}

export type SpravaPolozkaInlineFieldValues = {
  skladBlokId: string | null;
  kategorieTechnikyId: string | null;
  podkategorieTechnikyId: string | null;
  technickyVlastnikId: string | null;
  technickyVlastnikNazev?: string | null;
  jednotka: string | null;
};

export type SpravaPolozkaInlineFieldLabels = {
  blokNazev?: string | null;
  kategorieNazev?: string | null;
  podkategorieNazev?: string | null;
  technickyVlastnikNazev?: string | null;
};

type Props = {
  polozkaId: string;
  fields: SpravaPolozkaInlineFieldValues;
  labels?: SpravaPolozkaInlineFieldLabels;
  polozkaUpdaters?: SpravaObsahPolozkaUpdaters;
  bloky: SkladBlok[];
  vlastnici: TechnickyVlastnik[];
  readOnly?: boolean;
};

const selectClassName =
  "min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50";

export function SpravaPolozkaInlineSelects({
  polozkaId,
  fields,
  labels,
  polozkaUpdaters,
  bloky,
  vlastnici,
  readOnly = false,
}: Props) {
  const canEdit = !readOnly && !!polozkaUpdaters;
  const isSaving = polozkaUpdaters?.savingPolozkaId === polozkaId;

  const podkategorieOptions = useMemo(
    () =>
      polozkaUpdaters?.getPodkategorieOptions(fields.podkategorieTechnikyId) ??
      [],
    [fields.podkategorieTechnikyId, polozkaUpdaters]
  );

  const jednotkaOptions = useMemo(
    () => polozkaUpdaters?.getJednotkaOptions(fields.jednotka) ?? [],
    [fields.jednotka, polozkaUpdaters]
  );

  if (!canEdit) {
    return (
      <>
        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={labelText(labels?.blokNazev)}
          >
            {labelText(labels?.blokNazev)}
          </span>
        </div>
        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={labelText(labels?.kategorieNazev)}
          >
            {labelText(labels?.kategorieNazev)}
          </span>
        </div>
        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={labelText(labels?.podkategorieNazev)}
          >
            {labelText(labels?.podkategorieNazev)}
          </span>
        </div>
        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={labelText(labels?.technickyVlastnikNazev)}
          >
            {labelText(labels?.technickyVlastnikNazev)}
          </span>
        </div>
      </>
    );
  }

  const updaters = polozkaUpdaters!;

  return (
    <>
      <div className={SPRAVA_TABLE_INHERITED_CELL}>
        <SelectWithQuickCreate
          variant="table"
          showQuickCreate={false}
          value={fields.skladBlokId ?? ""}
          disabled={isSaving}
          onChange={(value) =>
            updaters.onUpdateZaklad(polozkaId, { blokId: value || null })
          }
          selectStyle={tableSelectStyle}
          selectClassName={selectClassName}
          placeholder="Nepřiřazeno"
          options={bloky.map((b) => ({
            value: b.sklad_blok_id,
            label: b.nazev,
          }))}
        />
      </div>

      <div className={SPRAVA_TABLE_INHERITED_CELL}>
        <SelectWithQuickCreate
          variant="table"
          showQuickCreate={false}
          value={fields.kategorieTechnikyId ?? ""}
          disabled={isSaving}
          onChange={(value) =>
            updaters.onUpdateZaklad(polozkaId, { kategorieId: value || null })
          }
          selectStyle={tableSelectStyle}
          selectClassName={selectClassName}
          placeholder="Bez kategorie"
          options={updaters.kategorieOptions.map((k) => ({
            value: k.kategorie_techniky_id,
            label: k.nazev,
          }))}
        />
      </div>

      <div className={SPRAVA_TABLE_INHERITED_CELL}>
        <SelectWithQuickCreate
          variant="table"
          showQuickCreate={false}
          value={fields.podkategorieTechnikyId ?? ""}
          disabled={isSaving}
          onChange={(value) =>
            updaters.onUpdateZaklad(polozkaId, {
              podkategorieId: value || null,
            })
          }
          selectStyle={tableSelectStyle}
          selectClassName={selectClassName}
          placeholder="Bez podkategorie"
          options={podkategorieOptions.map((p) => ({
            value: p.podkategorie_techniky_id,
            label: p.nazev,
          }))}
        />
      </div>

      <div className={SPRAVA_TABLE_INHERITED_CELL}>
        <select
          value={fields.technickyVlastnikId ?? ""}
          disabled={isSaving}
          onChange={(e) => {
            const value = e.target.value;
            if (value) updaters.onUpdateVlastnik(polozkaId, value);
          }}
          style={tableSelectStyle}
          className={selectClassName}
          title="Vlastník techniky"
        >
          {(fields.technickyVlastnikId &&
          !vlastnici.some(
            (v) => v.id === fields.technickyVlastnikId && v.aktivni
          )
            ? [
                {
                  id: fields.technickyVlastnikId,
                  nazev: fields.technickyVlastnikNazev ?? "Neznámý vlastník",
                  aktivni: false,
                },
              ]
            : []
          ).map((v) => (
            <option key={v.id} value={v.id}>
              {v.nazev}
              {!v.aktivni ? " (neaktivní)" : ""}
            </option>
          ))}
          {vlastnici
            .filter((v) => v.aktivni)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.nazev}
              </option>
            ))}
        </select>
      </div>
    </>
  );
}

export function SpravaPolozkaInlineJednotkaSelect({
  polozkaId,
  jednotka,
  polozkaUpdaters,
  readOnly = false,
}: {
  polozkaId: string;
  jednotka: string | null;
  polozkaUpdaters?: SpravaObsahPolozkaUpdaters;
  readOnly?: boolean;
}) {
  const canEdit = !readOnly && !!polozkaUpdaters;
  const isSaving = polozkaUpdaters?.savingPolozkaId === polozkaId;

  const jednotkaOptions = useMemo(
    () => polozkaUpdaters?.getJednotkaOptions(jednotka) ?? [],
    [jednotka, polozkaUpdaters]
  );

  if (!canEdit) {
    return (
      <span style={tableValueBoxLeft} className="truncate text-[11px]">
        {jednotka ?? SKLAD_EMPTY_LABEL}
      </span>
    );
  }

  return (
    <SelectWithQuickCreate
      variant="table"
      showQuickCreate={false}
      value={jednotka ?? ""}
      disabled={isSaving}
      onChange={(value) => polozkaUpdaters!.onUpdateJednotka(polozkaId, value)}
      selectStyle={tableSelectStyle}
      selectClassName={selectClassName}
      placeholder="Jednotka"
      options={jednotkaOptions.map((j) => ({
        value: j.nazev,
        label: j.nazev,
      }))}
    />
  );
}
