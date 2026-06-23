import {
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import {
  SPRAVA_TABLE_CHEVRON_SPACER,
  SPRAVA_TABLE_HEADER_CELL,
  SPRAVA_TABLE_HEADER_CELL_MULTILINE,
  SPRAVA_TABLE_HEADER_CELL_SHORT,
  SPRAVA_TABLE_HEADER_CELL_STICKY,
  SPRAVA_TABLE_HEADER_CLASS,
  SPRAVA_TABLE_HEADER_STICKY_CLASS,
  spravaTableGridStyle,
} from "./spravaTableLayout";

function HeaderLines({ lines }: { lines: [string, string] }) {
  return (
    <>
      <span className="block">{lines[0]}</span>
      <span className="block">{lines[1]}</span>
    </>
  );
}

export function SkladTableHeader() {
  return (
    <section
      className={[SPRAVA_TABLE_HEADER_CLASS, SPRAVA_TABLE_HEADER_STICKY_CLASS].join(
        " "
      )}
      style={spravaTableGridStyle}
    >
      <div className={SPRAVA_TABLE_HEADER_CELL_STICKY}>
        <span className="h-4 w-4 shrink-0" aria-hidden />
        <span className={SPRAVA_TABLE_CHEVRON_SPACER} aria-hidden />
        <span>Název</span>
      </div>
      <div className={SPRAVA_TABLE_HEADER_CELL}>Okruh</div>
      <div className={SPRAVA_TABLE_HEADER_CELL}>Kategorie</div>
      <div className={SPRAVA_TABLE_HEADER_CELL}>Podkategorie</div>
      <div className={SPRAVA_TABLE_HEADER_CELL}>Vlastník</div>
      <div className={SPRAVA_TABLE_HEADER_CELL_SHORT}>Pozice</div>
      <div className={SPRAVA_TABLE_HEADER_CELL_SHORT}>Celkem</div>
      <div className={SPRAVA_TABLE_HEADER_CELL_SHORT}>Skladem</div>
      <div
        className={SPRAVA_TABLE_HEADER_CELL_MULTILINE}
        title={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
      >
        <HeaderLines lines={["Plánováno", "na zakázkách"]} />
      </div>
      <div
        className={SPRAVA_TABLE_HEADER_CELL_MULTILINE}
        title={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
      >
        <HeaderLines lines={["Fyzicky", "na zakázkách"]} />
      </div>
      <div className={SPRAVA_TABLE_HEADER_CELL_SHORT}>Poškozené</div>
      <div className={SPRAVA_TABLE_HEADER_CELL_SHORT}>Jednotka</div>
      <div className={SPRAVA_TABLE_HEADER_CELL_MULTILINE}>
        <HeaderLines lines={["Cena", "akce"]} />
      </div>
    </section>
  );
}
