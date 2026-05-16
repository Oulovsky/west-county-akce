"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type GpsLocationValue = {
  lat: string;
  lng: string;
  radiusM: string;
  accuracyM: string;
  source: string;
  updatedAt: string;
};

type Props = {
  defaultLat?: number | string | null;
  defaultLng?: number | string | null;
  defaultRadiusM?: number | string | null;
  defaultAccuracyM?: number | string | null;
  defaultSource?: string | null;
  defaultUpdatedAt?: string | null;
  onChange?: (value: GpsLocationValue) => void;
};

function toInputValue(value: number | string | null | undefined) {
  return value == null ? "" : String(value);
}

export function GpsLocationFields({
  defaultLat = null,
  defaultLng = null,
  defaultRadiusM = 300,
  defaultAccuracyM = null,
  defaultSource = null,
  defaultUpdatedAt = null,
  onChange,
}: Props) {
  const [value, setValue] = useState<GpsLocationValue>({
    lat: toInputValue(defaultLat),
    lng: toInputValue(defaultLng),
    radiusM: toInputValue(defaultRadiusM) || "300",
    accuracyM: toInputValue(defaultAccuracyM),
    source: defaultSource ?? "",
    updatedAt: defaultUpdatedAt ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<GpsLocationValue>) {
    setValue((current) => {
      const next = { ...current, ...patch };
      onChange?.(next);
      return next;
    });
  }

  function useCurrentLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError("Prohlížeč nepodporuje zjištění aktuální polohy.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
          accuracyM: String(Math.round(position.coords.accuracy)),
          source: "browser_geolocation",
          updatedAt: new Date().toISOString(),
        });
      },
      () => {
        setError("Aktuální polohu se nepodařilo načíst.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
      <div>
        <div className="text-lg font-semibold text-white">GPS lokace místa</div>
        <div className="mt-1 text-sm text-slate-400">
          Volitelné souřadnice pro navigaci a budoucí GPS ověření docházky.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Latitude">
          <Input
            name="misto_lat"
            inputMode="decimal"
            value={value.lat}
            onChange={(event) => update({ lat: event.target.value })}
            placeholder="50.123456"
          />
        </Field>

        <Field label="Longitude">
          <Input
            name="misto_lng"
            inputMode="decimal"
            value={value.lng}
            onChange={(event) => update({ lng: event.target.value })}
            placeholder="12.345678"
          />
        </Field>

        <Field label="Radius GPS zóny (m)">
          <Input
            name="misto_gps_radius_m"
            inputMode="decimal"
            value={value.radiusM}
            onChange={(event) => update({ radiusM: event.target.value })}
            placeholder="300"
          />
        </Field>
      </div>

      <input type="hidden" name="misto_gps_presnost_m" value={value.accuracyM} />
      <input type="hidden" name="misto_gps_zdroj" value={value.source} />
      <input type="hidden" name="misto_gps_updated_at" value={value.updatedAt} />

      {value.accuracyM || value.source ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          {value.accuracyM ? `Přesnost: ${value.accuracyM} m` : "Přesnost nezadaná"}
          {value.source ? ` · Zdroj: ${value.source}` : ""}
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      <Button type="button" variant="secondary" onClick={useCurrentLocation}>
        Použít aktuální polohu
      </Button>
    </Card>
  );
}
