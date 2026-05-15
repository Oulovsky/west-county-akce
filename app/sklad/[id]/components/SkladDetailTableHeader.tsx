import { headerBoxClassName } from "../helpers/classNames";
import {
  SKLAD_DETAIL_CENTER_CELL_CLASS_NAME,
  skladDetailHeaderGridClassName,
} from "../helpers/tableLayout";

export function SkladDetailTableHeader() {
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;
  const headerGridClassName = skladDetailHeaderGridClassName();

  return (
    <div className="bg-slate-950/30 px-3 pt-3">
      <div className={headerGridClassName}>
        <div className="flex items-center px-2">
          <span className={headerBoxClassName()}>Název</span>
        </div>

        <div className="flex items-center px-2">
          <span className={headerBoxClassName()}>Kategorie</span>
        </div>

        <div className="flex items-center px-2">
          <span className={headerBoxClassName()}>Podkategorie</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Pozice</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Celkem</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Blokováno</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Použitelné</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Jednotka</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Akce</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Rent</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Stav</span>
        </div>

        <div className={centerCellClassName}>
          <span className={headerBoxClassName("justify-center text-center")}>Akce</span>
        </div>
      </div>
    </div>
  );
}
