"use client";

import { useEffect } from "react";
import type { LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { WEST_COUNTY_HQ_MAP_CENTER } from "@/lib/locations/west-county-hq";

type LeafletPointMapProps = {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
  layer?: "map" | "satellite";
  defaultCenter?: LatLngExpression;
};

const DEFAULT_CENTER: LatLngExpression = WEST_COUNTY_HQ_MAP_CENTER;
const DEFAULT_ZOOM = 8;
const SELECTED_POINT_ZOOM = 15;

function isValidLat(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLng(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function MapClickHandler({ onSelect }: Pick<LeafletPointMapProps, "onSelect">) {
  useMapEvents({
    click(event) {
      onSelect(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6))
      );
    },
  });

  return null;
}

function MapCenterSync({
  lat,
  lng,
}: Pick<LeafletPointMapProps, "lat" | "lng">) {
  const map = useMap();

  useEffect(() => {
    if (!isValidLat(lat) || !isValidLng(lng)) return;

    map.setView([lat, lng], Math.max(map.getZoom(), SELECTED_POINT_ZOOM));
  }, [lat, lng, map]);

  return null;
}

export function LeafletPointMap({
  lat,
  lng,
  onSelect,
  layer = "map",
  defaultCenter = DEFAULT_CENTER,
}: LeafletPointMapProps) {
  const hasPoint = isValidLat(lat) && isValidLng(lng);
  const center: LatLngExpression = hasPoint ? [lat, lng] : defaultCenter;
  const tileLayer =
    layer === "satellite"
      ? {
          key: "satellite",
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        }
      : {
          key: "map",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        };

  return (
    <MapContainer
      center={center}
      zoom={hasPoint ? SELECTED_POINT_ZOOM : DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-80 w-full rounded-xl"
    >
      <TileLayer
        key={tileLayer.key}
        attribution={tileLayer.attribution}
        url={tileLayer.url}
      />
      <MapClickHandler onSelect={onSelect} />
      <MapCenterSync lat={lat} lng={lng} />
      {hasPoint ? (
        <CircleMarker
          center={[lat, lng]}
          pathOptions={{
            color: "#bfdbfe",
            fillColor: "#2563eb",
            fillOpacity: 0.9,
            weight: 3,
          }}
          radius={8}
        />
      ) : null}
    </MapContainer>
  );
}
