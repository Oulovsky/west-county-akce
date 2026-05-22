import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

type RealizaceBasicLookRow = {
  realizace_id: string;
  nazev: string | null;
  poradi: number | string | null;
  stage_typ: string | null;
  stage_sirka: number | string | null;
  stage_hloubka: number | string | null;
  sound_typ: string | null;
  lights_typ: string | null;
  led_typ: string | null;
  led_sirka: number | string | null;
  led_vyska: number | string | null;
  led_rohy: boolean | null;
  kamery: number | string | null;
  dron: boolean | null;
};

type ZakazkaBasicLookData = {
  stage_preset?: string | null;
  stage_width_m?: number | string | null;
  stage_depth_m?: number | string | null;
  sound_preset?: string | null;
  lights_preset?: string | null;
  led_kind?: string | null;
  led_wall_rohy?: boolean | null;
  led_width_m?: number | string | null;
  led_height_m?: number | string | null;
  led_requested_area_m2?: number | string | null;
  kamery_count?: number | string | null;
  dron?: boolean | null;
};

type ZakazkaBasicLookCardProps = {
  realizace: RealizaceBasicLookRow[];
  data: ZakazkaBasicLookData;
};

function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(num);
}

function getLedMaxArea(kind: string) {
  switch (kind) {
    case "p2_indoor":
      return 24.5;
    case "p2_6_outdoor":
      return 17.5;
    case "p3_9_outdoor":
      return 45;
    case "p4_8_outdoor":
      return 22.5;
    case "p6_4_mantel":
      return 21;
    default:
      return null;
  }
}

function getLedLabel(kind?: string | null) {
  switch (kind) {
    case "p2_indoor":
      return "P2 – 24,5 m2 indoor";
    case "p2_6_outdoor":
      return "P2,6 – 17,5 m2 outdoor";
    case "p3_9_outdoor":
      return "P3,9 – 45 m2 outdoor";
    case "p4_8_outdoor":
      return "P4,8 – 22,5 m2 outdoor";
    case "p6_4_mantel":
      return "P6,4 – mantinel – 21 m běžných (22 ks)";
    default:
      return "—";
  }
}

function getStageLabel(value?: string | null) {
  switch (value) {
    case "mala":
      return "Malý setup";
    case "velka":
      return "Velký setup";
    case "nejvetsi":
      return "Největší setup";
    default:
      return "—";
  }
}

function getSoundLightsLabel(value?: string | null) {
  switch (value) {
    case "mala":
      return "Malý setup";
    case "stredni":
      return "Střední setup";
    case "velka":
      return "Velký setup";
    default:
      return "—";
  }
}

function hasLegacyRealizaceRow(item: RealizaceBasicLookRow) {
  return Boolean(
    item.stage_typ ||
      item.stage_sirka ||
      item.stage_hloubka ||
      item.sound_typ ||
      item.lights_typ ||
      item.led_typ ||
      item.led_sirka ||
      item.led_vyska ||
      item.led_rohy ||
      (item.kamery != null && Number(item.kamery) > 0) ||
      item.dron
  );
}

function hasLegacyZakazkaBasicLook(data: ZakazkaBasicLookData) {
  return Boolean(
    data.stage_preset ||
      data.stage_width_m ||
      data.stage_depth_m ||
      data.sound_preset ||
      data.lights_preset ||
      data.led_kind ||
      data.led_width_m ||
      data.led_height_m ||
      data.led_requested_area_m2 ||
      (data.kamery_count != null && Number(data.kamery_count) > 0) ||
      data.dron
  );
}

export function ZakazkaBasicLookCard({ realizace, data }: ZakazkaBasicLookCardProps) {
  const legacyRealizace = realizace.filter(hasLegacyRealizaceRow);
  const hasLegacy =
    legacyRealizace.length > 0 ||
    (realizace.length === 0 && hasLegacyZakazkaBasicLook(data));

  if (!hasLegacy) {
    return null;
  }

  const fallbackLedMaxArea = getLedMaxArea(data.led_kind ?? "");

  return (
    <Card className="mt-6">
      <div className="space-y-6">
        <div>
          <div className="text-lg font-semibold text-white">Basic look</div>
          <div className="mt-1 text-sm text-slate-400">
            {legacyRealizace.length > 0
              ? "Historické produkční zadání po jednotlivých stage / realizacích."
              : "Historické produkční zadání zakázky."}
          </div>
        </div>

        {legacyRealizace.length > 0 ? (
          <div className="grid gap-6">
            {legacyRealizace.map((item, index) => {
              const ledArea =
                item.led_sirka && item.led_vyska
                  ? Number(item.led_sirka) * Number(item.led_vyska)
                  : null;
              const ledMaxArea = getLedMaxArea(item.led_typ ?? "");

              return (
                <Card key={item.realizace_id} className="space-y-6 border-slate-700 bg-slate-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {item.nazev || `Stage ${index + 1}`}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        Pořadí: {formatNumber(item.poradi)}
                      </div>
                    </div>

                    <Badge variant="default">Realizace {index + 1}</Badge>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-slate-700 bg-[#0b1324]">
                      <div className="space-y-4">
                        <div className="text-base font-semibold text-white">Stage</div>

                        <div className="grid gap-4">
                          <Field label="Setup stage">
                            <div className="mt-2 text-slate-100">{getStageLabel(item.stage_typ)}</div>
                          </Field>

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Šířka stage (m)">
                              <div className="mt-2 text-slate-100">{formatNumber(item.stage_sirka)}</div>
                            </Field>

                            <Field label="Hloubka stage (m)">
                              <div className="mt-2 text-slate-100">{formatNumber(item.stage_hloubka)}</div>
                            </Field>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="border-slate-700 bg-[#0b1324]">
                      <div className="space-y-4">
                        <div className="text-base font-semibold text-white">Sound & lights</div>

                        <Field label="Sound">
                          <div className="mt-2 text-slate-100">{getSoundLightsLabel(item.sound_typ)}</div>
                        </Field>

                        <Field label="Lights">
                          <div className="mt-2 text-slate-100">{getSoundLightsLabel(item.lights_typ)}</div>
                        </Field>
                      </div>
                    </Card>
                  </div>

                  <Card className="border-slate-700 bg-[#0b1324]">
                    <div className="space-y-4">
                      <div className="text-base font-semibold text-white">LED / mantinel</div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <Field label="Typ LED / mantinelu">
                          <div className="mt-2 text-slate-100">{getLedLabel(item.led_typ)}</div>
                        </Field>

                        <div className="pb-3">
                          <div className="flex items-center gap-2 whitespace-nowrap text-white">
                            <span>Rohy:</span>
                            <Badge variant={item.led_rohy ? "success" : "default"}>
                              {item.led_rohy ? "Ano" : "Ne"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={item.led_typ === "p6_4_mantel" ? "Délka mantinelu (m)" : "Šířka LED (m)"}>
                          <div className="mt-2 text-slate-100">{formatNumber(item.led_sirka)}</div>
                        </Field>

                        <Field label={item.led_typ === "p6_4_mantel" ? "Výška mantinelu (m)" : "Výška LED (m)"}>
                          <div className="mt-2 text-slate-100">{formatNumber(item.led_vyska)}</div>
                        </Field>
                      </div>

                      <div className="text-sm text-slate-400">
                        Požadovaná plocha / rozsah: {ledArea ? `${formatNumber(ledArea)} m²` : "—"}
                        {ledMaxArea ? ` / maximum ${formatNumber(ledMaxArea)} m²` : ""}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Kamery">
                          <div className="mt-2 text-slate-100">{formatNumber(item.kamery)}</div>
                        </Field>

                        <Field label="Dron">
                          <div className="mt-2">
                            <Badge variant={item.dron ? "success" : "default"}>
                              {item.dron ? "Ano" : "Ne"}
                            </Badge>
                          </div>
                        </Field>
                      </div>
                    </div>
                  </Card>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="space-y-6 border-slate-700 bg-slate-950/40">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-slate-700 bg-slate-950/40">
                <div className="space-y-4">
                  <div className="text-base font-semibold text-white">Stage</div>

                  <Field label="Setup stage">
                    <div className="mt-2 text-slate-100">{getStageLabel(data.stage_preset)}</div>
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Šířka stage (m)">
                      <div className="mt-2 text-slate-100">{formatNumber(data.stage_width_m)}</div>
                    </Field>

                    <Field label="Hloubka stage (m)">
                      <div className="mt-2 text-slate-100">{formatNumber(data.stage_depth_m)}</div>
                    </Field>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-700 bg-slate-950/40">
                <div className="space-y-4">
                  <div className="text-base font-semibold text-white">Sound & lights</div>

                  <Field label="Sound">
                    <div className="mt-2 text-slate-100">{getSoundLightsLabel(data.sound_preset)}</div>
                  </Field>

                  <Field label="Lights">
                    <div className="mt-2 text-slate-100">{getSoundLightsLabel(data.lights_preset)}</div>
                  </Field>
                </div>
              </Card>
            </div>

            <Card className="border-slate-700 bg-slate-950/40">
              <div className="space-y-4">
                <div className="text-base font-semibold text-white">LED / mantinel</div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Field label="Typ LED / mantinelu">
                    <div className="mt-2 text-slate-100">{getLedLabel(data.led_kind)}</div>
                  </Field>

                  <div className="pb-3">
                    <div className="flex items-center gap-2 whitespace-nowrap text-white">
                      <span>Rohy:</span>
                      <Badge variant={data.led_wall_rohy ? "success" : "default"}>
                        {data.led_wall_rohy ? "Ano" : "Ne"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={data.led_kind === "p6_4_mantel" ? "Délka mantinelu (m)" : "Šířka LED (m)"}>
                    <div className="mt-2 text-slate-100">{formatNumber(data.led_width_m)}</div>
                  </Field>

                  <Field label={data.led_kind === "p6_4_mantel" ? "Výška mantinelu (m)" : "Výška LED (m)"}>
                    <div className="mt-2 text-slate-100">{formatNumber(data.led_height_m)}</div>
                  </Field>
                </div>

                <div className="text-sm text-slate-400">
                  Požadovaná plocha / rozsah: {data.led_requested_area_m2 ? `${formatNumber(data.led_requested_area_m2)} m²` : "—"}
                  {fallbackLedMaxArea ? ` / maximum ${formatNumber(fallbackLedMaxArea)} m²` : ""}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Kamery">
                    <div className="mt-2 text-slate-100">{formatNumber(data.kamery_count)}</div>
                  </Field>

                  <Field label="Dron">
                    <div className="mt-2">
                      <Badge variant={data.dron ? "success" : "default"}>
                        {data.dron ? "Ano" : "Ne"}
                      </Badge>
                    </div>
                  </Field>
                </div>
              </div>
            </Card>
          </Card>
        )}
      </div>
    </Card>
  );
}