"use client";

import {
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
  SKLAD_SPRAVA_LABEL_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_LABEL_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import { SkladStatCard } from "./SkladStatCard";

type Props = {
  itemsCount: number;
  totalKusy: number;
  /** Součet zobrazeného sloupce Skladem (po přepočtu). */
  totalSkladem: number;
  totalAkce: number;
  totalFyzickyNaZakazkach: number;
  totalPoskozene: number;
  totalProblemove: number;
  totalFutureCollisions: number;
};

export function SkladStats({
  itemsCount,
  totalKusy,
  totalSkladem,
  totalAkce,
  totalFyzickyNaZakazkach,
  totalPoskozene,
  totalProblemove,
  totalFutureCollisions,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
      <SkladStatCard
        label="Položek"
        value={itemsCount}
      />

      <SkladStatCard
        label="Celkem kusů"
        value={totalKusy}
      />

      <SkladStatCard
        label="Skladem celkem"
        value={totalSkladem}
        hint="Součet sloupce Skladem (celkem − rezervace − blokující poškození)."
      />

      <SkladStatCard
        label={SKLAD_SPRAVA_LABEL_NA_ZAKAZKACH}
        value={totalAkce}
        hint={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
      />

      <SkladStatCard
        label={SKLAD_SPRAVA_LABEL_FYZICKY_NA_ZAKAZKACH}
        value={totalFyzickyNaZakazkach}
        hint={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
      />

      <SkladStatCard
        label="Poškozené"
        value={totalPoskozene}
        accent
      />
      <SkladStatCard
        label="Blok / oprava"
        value={totalProblemove}
        hint="Kusy blokované, v opravě, čekající na kontrolu nebo vyřazené."
        accent
      />
      <SkladStatCard
        label="Budoucí kolize"
        value={totalFutureCollisions}
        hint="Položky, kde budoucí plán nebo fyzicky naložené kusy přesahují použitelnou kapacitu v ročním výhledu."
        accent={totalFutureCollisions > 0}
      />
    </div>
  );
}
