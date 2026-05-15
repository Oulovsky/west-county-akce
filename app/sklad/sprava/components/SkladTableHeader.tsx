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
      <span className="sticky left-0 z-20 bg-slate-900/95 pr-1">Název</span>
      <span className="px-1">Okruh</span>
      <span className="px-1">Kategorie</span>
      <span className="px-1">Typ / rozměr</span>
      <span className="px-1 text-right">Celkem</span>
      <span className="px-1 text-right">Skladem</span>
      <span className="px-1 text-right">Akce</span>
      <span className="px-1 text-right">Poškozené</span>
      <span className="px-1">Jednotka</span>
      <span className="px-1 text-right">Náklad</span>
      <span className="px-1 text-right">Rent</span>
      <span className="px-1">Detail</span>
    </section>
  );
}
