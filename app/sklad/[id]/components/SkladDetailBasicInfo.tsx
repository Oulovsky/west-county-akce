import { formatNumber } from "@/lib/sklad/helpers";
import type { SkladDetailRow } from "@/lib/sklad/types";
import { InfoRow } from "./InfoRow";

type SkladDetailBasicInfoProps = {
  row: SkladDetailRow;
  celkemKusu: number;
  poskozeneKusy: number;
  pouzitelneKusy: number;
};

export function SkladDetailBasicInfo({
  row,
  celkemKusu,
  poskozeneKusy,
  pouzitelneKusy,
}: SkladDetailBasicInfoProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Základní info</h2>

      <div className="grid gap-3 text-sm text-slate-200">
        <InfoRow label="Kategorie">{row.kategorie_nazev ?? "-"}</InfoRow>
        <InfoRow label="Podkategorie">{row.podkategorie_nazev ?? "-"}</InfoRow>
        <InfoRow label="Pozice">{formatNumber(row.pozice)}</InfoRow>
        <InfoRow label="Jednotka">{row.jednotka}</InfoRow>
        <InfoRow label="Na skladě celkem">
          {formatNumber(celkemKusu)} {row.jednotka}
        </InfoRow>
        <InfoRow label="Blokováno poškozením">
          {formatNumber(poskozeneKusy)} {row.jednotka}
        </InfoRow>
        <InfoRow label="Použitelné">
          {formatNumber(pouzitelneKusy)} {row.jednotka}
        </InfoRow>
      </div>
    </section>
  );
}
