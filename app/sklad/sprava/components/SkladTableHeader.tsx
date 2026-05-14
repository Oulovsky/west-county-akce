type Props = {
  tableGrid: string;
};

export function SkladTableHeader({ tableGrid }: Props) {
  return (
    <div
      className={[
        "grid",
        tableGrid,
        "border-b border-slate-700 bg-slate-900/95 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300",
      ].join(" ")}
    >
      <div className="sticky left-0 z-20 bg-slate-900/95 pr-3">
        Název
      </div>

      <div className="px-2">Okruh</div>
      <div className="px-2">Kategorie</div>
      <div className="px-2">Typ / rozměr</div>
      <div className="px-2 text-right">Celkem</div>
      <div className="px-2 text-right">Skladem</div>
      <div className="px-2 text-right">Akce</div>
      <div className="px-2 text-right">Poškozené</div>
      <div className="px-2">Jednotka</div>
      <div className="px-2 text-right">Náklad</div>
      <div className="px-2 text-right">Rent</div>
      <div className="px-2">Detail</div>
    </div>
  );
}
