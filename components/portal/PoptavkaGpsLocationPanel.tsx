"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WEST_COUNTY_HQ_MAP_CENTER } from "@/lib/locations/west-county-hq";

const LeafletPointMap = dynamic(
  () => import("@/app/zakazky/LeafletPointMap").then((module) => module.LeafletPointMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-slate-950 text-sm text-slate-400">
        Načítám mapu…
      </div>
    ),
  }
);

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  placeQuery: string;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
  readOnly?: boolean;
};

function parseCoordinate(value: string, min: number, max: number) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export default function PoptavkaGpsLocationPanel({
  placeQuery,
  lat,
  lng,
  onCoordsChange,
  readOnly = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(() =>
    lat != null && lng != null ? "Bod vybrán." : null
  );
  const [mapLayer, setMapLayer] = useState<"map" | "satellite">("map");

  const hasPoint = lat != null && lng != null;

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 3 || readOnly) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
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
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error("Geocoding failed");
        const data = (await response.json()) as NominatimResult[];
        setResults(data);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [placeQuery, readOnly]);

  function selectResult(result: NominatimResult) {
    setResults([]);
    setSelectionMessage("Místo nalezeno. Bod můžete zpřesnit kliknutím do mapy.");
    onCoordsChange(Number(result.lat), Number(result.lon));
  }

  function selectMapPoint(nextLat: number, nextLng: number) {
    setSelectionMessage("Bod vybrán.");
    onCoordsChange(nextLat, nextLng);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div>
        <div className="text-base font-semibold text-white">
          Přesné místo akce na mapě <span className="text-amber-300">*</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Vyhledání běží automaticky podle pole Místo / adresa. Kliknutím do mapy upřesníte bod,
          kde má stát stage a technika.
        </p>
      </div>

      {selectionMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {selectionMessage}
        </div>
      ) : null}

      {!hasPoint && !readOnly ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Vyberte bod na mapě — bez GPS souřadnic nelze pokračovat ani objednat výjezd technika.
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      {results.length > 0 && !readOnly ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nalezená místa {isSearching ? "…" : ""}
          </div>
          <div className="space-y-1">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => selectResult(result)}
                className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-amber-500/40 hover:bg-white/[0.04]"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            Klikněte do mapy na přesné místo konání. Kolečkem myši mapu přiblížíte nebo oddálíte.
          </div>
          {!readOnly ? (
            <div className="inline-flex rounded-xl border border-white/10 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setMapLayer("map")}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  mapLayer === "map"
                    ? "bg-amber-500/80 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                Mapa
              </button>
              <button
                type="button"
                onClick={() => setMapLayer("satellite")}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  mapLayer === "satellite"
                    ? "bg-amber-500/80 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                Letecká
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
          <div className="[&_.leaflet-container]:h-[320px] md:[&_.leaflet-container]:h-[420px]">
            <LeafletPointMap
              lat={lat}
              lng={lng}
              onSelect={readOnly ? () => {} : selectMapPoint}
              layer={mapLayer}
              defaultCenter={WEST_COUNTY_HQ_MAP_CENTER}
            />
          </div>
        </div>

        {hasPoint ? (
          <p className="text-xs text-slate-500">
            GPS: {lat!.toFixed(6)}, {lng!.toFixed(6)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { parseCoordinate };
