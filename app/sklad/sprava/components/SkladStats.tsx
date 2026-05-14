"use client";

import { SkladStatCard } from "./SkladStatCard";

type Props = {
  itemsCount: number;
  totalKusy: number;
  totalAkce: number;
  totalPoskozene: number;
};

export function SkladStats({
  itemsCount,
  totalKusy,
  totalAkce,
  totalPoskozene,
}: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SkladStatCard
        label="Položek"
        value={itemsCount}
      />

      <SkladStatCard
        label="Celkem kusů"
        value={totalKusy}
      />

      <SkladStatCard
        label="Akce"
        value={totalAkce}
      />

      <SkladStatCard
        label="Poškozené"
        value={totalPoskozene}
        accent
      />
    </div>
  );
}
