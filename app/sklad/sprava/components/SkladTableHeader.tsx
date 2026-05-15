import {
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
  SKLAD_SPRAVA_LABEL_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import {
  SPRAVA_TABLE_GRID,
  SPRAVA_TABLE_HEADER_CLASS,
} from "./spravaTableLayout";

type Props = {
  tableGrid?: string;
};

export function SkladTableHeader({ tableGrid = SPRAVA_TABLE_GRID }: Props) {
  return (
    <section className={["grid", tableGrid, SPRAVA_TABLE_HEADER_CLASS].join(" ")}>
      <span className="sticky left-0 z-20 flex min-h-8 items-center bg-slate-900/95 pr-1">
        Název
      </span>
      <span className="flex min-h-8 items-center px-1">Okruh</span>
      <span className="flex min-h-8 items-center px-1">Kategorie</span>
      <span className="flex min-h-8 items-center px-1">Typ / rozměr</span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Celkem
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Skladem
      </span>
      <span
        className="flex min-h-8 items-center justify-center px-1 text-center"
        title={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
      >
        {SKLAD_SPRAVA_LABEL_NA_ZAKAZKACH}
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Poškozené
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Jednotka
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Náklad
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Rent
      </span>
      <span className="flex min-h-8 items-center justify-center px-1 text-center">
        Detail
      </span>
    </section>
  );
}
