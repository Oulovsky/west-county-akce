import type React from "react";
import type { FakturacniFirma } from "@/lib/fakturacni-firmy";

type FakturacniFirmaSelectProps = {
  firmy: FakturacniFirma[];
  name?: string;
  value?: string;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
};

export function getDefaultFakturacniFirmaId(firmy: FakturacniFirma[]) {
  return firmy.find((firma) => firma.aktivni && firma.vychozi)?.id ?? "";
}

export function FakturacniFirmaSelect({
  firmy,
  name = "fakturacni_firma_id",
  value,
  defaultValue,
  onChange,
}: FakturacniFirmaSelectProps) {
  const activeFirmy = firmy.filter((firma) => firma.aktivni);
  const selectProps =
    value !== undefined
      ? { value, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value) }
      : { defaultValue: defaultValue ?? getDefaultFakturacniFirmaId(activeFirmy) };

  return (
    <select
      name={name}
      className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      {...selectProps}
    >
      <option value="">Bez fakturační firmy</option>
      {activeFirmy.map((firma) => (
        <option key={firma.id} value={firma.id}>
          {firma.nazev}
          {firma.vychozi ? " (výchozí)" : ""}
        </option>
      ))}
    </select>
  );
}
