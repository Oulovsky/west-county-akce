export type TransportVehicleOption = {
  id: string;
  label: string;
};

type VehicleRow = {
  id: string;
  nazev: string;
  spz?: string | null;
  typ: string;
  vlastnik_user_id?: string | null;
};

export function splitTransportVehiclesForUser(
  rows: VehicleRow[],
  userId: string
): { companyVehicles: TransportVehicleOption[]; privateVehicles: TransportVehicleOption[] } {
  const companyVehicles: TransportVehicleOption[] = [];
  const privateVehicles: TransportVehicleOption[] = [];

  for (const row of rows) {
    const label = [row.nazev, row.spz].filter(Boolean).join(" · ") || "Vozidlo";
    if (row.typ === "firemni") {
      companyVehicles.push({ id: row.id, label });
      continue;
    }
    if (row.typ === "soukrome" && (!row.vlastnik_user_id || row.vlastnik_user_id === userId)) {
      privateVehicles.push({ id: row.id, label });
    }
  }

  return { companyVehicles, privateVehicles };
}
