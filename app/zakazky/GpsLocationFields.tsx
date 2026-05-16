"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const LeafletPointMap = dynamic(
  () => import("./LeafletPointMap").then((module) => module.LeafletPointMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-sm text-slate-400">
        Načítám mapu...
      </div>
    ),
  }
);

type GpsLocationValue = {
  lat: string;
  lng: string;
  radiusM: string;
  accuracyM: string;
  source: string;
  updatedAt: string;
};

type Props = {
  placeText?: string;
  placeInputName?: string;
  defaultLat?: number | string | null;
  defaultLng?: number | string | null;
  defaultRadiusM?: number | string | null;
  defaultAccuracyM?: number | string | null;
  defaultSource?: string | null;
  defaultUpdatedAt?: string | null;
  onChange?: (value: GpsLocationValue) => void;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

function toInputValue(value: number | string | null | undefined) {
  return value == null ? "" : String(value);
}

function parseCoordinate(value: string, min: number, max: number) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function GpsLocationFields({
  placeText,
  placeInputName = "misto",
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
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [domPlaceText, setDomPlaceText] = useState("");
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const activePlaceText = placeText ?? domPlaceText;

  function update(patch: Partial<GpsLocationValue>) {
    setValue((current) => {
      const next = { ...current, ...patch };
      return next;
    });
  }

  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  useEffect(() => {
    if (placeText !== undefined || typeof document === "undefined") return;

    const input = document.querySelector<HTMLInputElement>(
      `input[name="${placeInputName}"]`
    );
    if (!input) return;

    setDomPlaceText(input.value);

    function handleInput() {
      setDomPlaceText(input?.value ?? "");
    }

    input.addEventListener("input", handleInput);
    return () => input.removeEventListener("input", handleInput);
  }, [placeInputName, placeText]);

  function getPlaceQuery() {
    if (placeText?.trim()) return placeText.trim();
    if (domPlaceText.trim()) return domPlaceText.trim();

    if (typeof document === "undefined") return "";

    const input = document.querySelector<HTMLInputElement>(
      `input[name="${placeInputName}"]`
    );
    return input?.value.trim() ?? "";
  }

  async function fetchPlaceResults(
    query: string,
    options: { showErrors: boolean; signal?: AbortSignal }
  ) {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "5",
        addressdetails: "1",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": "cs",
          },
          signal: options.signal,
        }
      );

      if (!response.ok) {
        throw new Error("Geocoding request failed");
      }

      const data = (await response.json()) as NominatimResult[];
      if (data.length === 0) {
        if (options.showErrors) {
          setError("Podle místa se nepodařilo najít žádný výsledek.");
        }
        setResults([]);
        return;
      }

      setResults(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (options.showErrors) {
        setError("Vyhledání podle místa se nepodařilo. Zkus to prosím znovu.");
      }
    } finally {
      if (!options.signal?.aborted) {
        setIsSearching(false);
      }
    }
  }

  useEffect(() => {
    const query = activePlaceText.trim();
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setError(null);
      fetchPlaceResults(query, {
        showErrors: false,
        signal: controller.signal,
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activePlaceText]);

  async function searchByPlace() {
    setError(null);
    setResults([]);

    const query = getPlaceQuery();
    if (!query) {
      setError("Nejdřív vyplň textové pole Místo.");
      return;
    }

    await fetchPlaceResults(query, { showErrors: true });
  }

  function selectResult(result: NominatimResult) {
    setResults([]);
    setSelectionMessage("Místo nalezeno. Bod můžeš zpřesnit kliknutím do mapy.");
    update({
      lat: result.lat,
      lng: result.lon,
      accuracyM: "",
      source: "geocoding_selected",
      updatedAt: new Date().toISOString(),
    });
  }

  function handleManualCoordinateChange(patch: Partial<Pick<GpsLocationValue, "lat" | "lng">>) {
    setSelectionMessage("Bod vybrán.");
    update({
      ...patch,
      accuracyM: "",
      source: "manual_map",
      updatedAt: new Date().toISOString(),
    });
  }

  function selectMapPoint(lat: number, lng: number) {
    setSelectionMessage("Bod vybrán.");
    update({
      lat: String(Number(lat.toFixed(6))),
      lng: String(Number(lng.toFixed(6))),
      accuracyM: "",
      source: "manual_map",
      updatedAt: new Date().toISOString(),
    });
  }

  const suggestions = results.length > 0 ? (
    <div className="-mt-4 space-y-2 rounded-xl border border-blue-500/30 bg-slate-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Nalezená místa</div>
        {isSearching ? <div className="text-xs text-slate-400">Aktualizuji...</div> : null}
      </div>
      {results.map((result) => (
        <button
          key={result.place_id}
          type="button"
          onClick={() => selectResult(result)}
          className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-500 hover:bg-blue-500/10"
        >
          <span className="block font-medium text-white">{result.display_name}</span>
          <span className="text-xs text-slate-400">
            {result.lat}, {result.lon}
            {result.type ? ` · ${result.type}` : ""}
          </span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      {suggestions}

      <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
        <div>
          <div className="text-lg font-semibold text-white">GPS lokace místa</div>
          <div className="mt-1 text-sm text-slate-400">
            Vyber přesný bod konání akce kliknutím do mapy. Vyhledání podle místa slouží jako rychlý posun mapy.
          </div>
        </div>

        <Field label="Radius GPS zóny (m)">
          <Input
            name="misto_gps_radius_m"
            inputMode="decimal"
            value={value.radiusM}
            onChange={(event) => update({ radiusM: event.target.value })}
            placeholder="300"
          />
        </Field>

        {selectionMessage ? (
          <div className="rounded-xl border border-green-500/30 bg-green-950/20 px-4 py-3 text-sm text-green-200">
            {selectionMessage}
          </div>
        ) : null}

        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={searchByPlace} disabled={isSearching}>
            {isSearching ? "Vyhledávám..." : "Vyhledat podle místa"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">Mapa pro přesný bod</div>
          <div className="text-xs text-slate-400">
            Klikni do mapy na přesné místo konání. Kolečkem myši mapu přiblížíš nebo oddálíš.
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <LeafletPointMap
              lat={parseCoordinate(value.lat, -90, 90)}
              lng={parseCoordinate(value.lng, -180, 180)}
              onSelect={selectMapPoint}
            />
          </div>
        </div>

        <details className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Technické souřadnice
          </summary>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Latitude">
              <Input
                name="misto_lat"
                inputMode="decimal"
                value={value.lat}
                onChange={(event) => handleManualCoordinateChange({ lat: event.target.value })}
                placeholder="50.123456"
              />
            </Field>

            <Field label="Longitude">
              <Input
                name="misto_lng"
                inputMode="decimal"
                value={value.lng}
                onChange={(event) => handleManualCoordinateChange({ lng: event.target.value })}
                placeholder="12.345678"
              />
            </Field>
          </div>

          <input type="hidden" name="misto_gps_presnost_m" value={value.accuracyM} />
          <input type="hidden" name="misto_gps_zdroj" value={value.source} />
          <input type="hidden" name="misto_gps_updated_at" value={value.updatedAt} />

          {value.accuracyM || value.source ? (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              {value.accuracyM ? `Přesnost: ${value.accuracyM} m` : "Přesnost nezadaná"}
              {value.source ? ` · Zdroj: ${value.source}` : ""}
            </div>
          ) : null}
        </details>
      </Card>
    </>
  );
}
