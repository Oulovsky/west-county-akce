import {
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import {
  SPRAVA_TABLE_GRID,
  SPRAVA_TABLE_HEADER_CELL,
  SPRAVA_TABLE_HEADER_CELL_STICKY,
  SPRAVA_TABLE_HEADER_CLASS,
} from "./spravaTableLayout";

type Props = {
  tableGrid?: string;
};

function HeaderLines({ lines }: { lines: [string, string] }) {
  return (
    <>
      <span className="block">{lines[0]}</span>
      <span className="block">{lines[1]}</span>
    </>
  );
}

export function SkladTableHeader({ tableGrid = SPRAVA_TABLE_GRID }: Props) {
  return (
    <section className={["grid", tableGrid, SPRAVA_TABLE_HEADER_CLASS].join(" ")}>
      <span className={[SPRAVA_TABLE_HEADER_CELL_STICKY, "min-h-8"].join(" ")}>
        Název
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Okruh</span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>
        Kategorie
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>
        Podkategorie
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Vlastník</span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Pozice</span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Celkem</span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Skladem</span>
      <span
        className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}
        title={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
      >
        <HeaderLines lines={["Plánováno", "na zakázkách"]} />
      </span>
      <span
        className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}
        title={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
      >
        <HeaderLines lines={["Fyzicky", "na zakázkách"]} />
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>
        Poškozené
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Jednotka</span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>
        <HeaderLines lines={["Cena", "pro akce"]} />
      </span>
      <span className={[SPRAVA_TABLE_HEADER_CELL, "min-h-8"].join(" ")}>Detail</span>
    </section>
  );
}
