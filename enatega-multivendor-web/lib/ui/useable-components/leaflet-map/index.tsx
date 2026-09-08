"use client";

import { useEffect, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon paths break under bundlers (webpack/turbopack
// rewrite the asset URLs) unless pointed at CDN-hosted images directly.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface ILeafletMapMarker {
  lat: number;
  lng: number;
  label?: string;
  draggable?: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
  onClick?: () => void;
  iconUrl?: string;
  iconSize?: [number, number];
}

export interface ILeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: ILeafletMapMarker[];
  polyline?: { lat: number; lng: number }[];
  circle?: { lat: number; lng: number; radiusMeters: number };
  height?: string | number;
  onClick?: (lat: number, lng: number) => void;
  className?: string;
  /** Fit the viewport to include every marker + polyline point instead of
   * just centering on `center` — used for route/tracking displays. */
  fitToContent?: boolean;
}

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    const handler = (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onClick]);
  return null;
}

function FitToContent({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], map.getZoom());
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
}

function markerIcon(marker: ILeafletMapMarker) {
  if (!marker.iconUrl) return defaultIcon;
  const [w, h] = marker.iconSize ?? [40, 40];
  return L.icon({ iconUrl: marker.iconUrl, iconSize: [w, h], iconAnchor: [w / 2, h] });
}

// Free OpenStreetMap-tiled map, replacing the Google Maps JS SDK everywhere
// in this app — no API key, no billing account required.
export default function LeafletMap({
  center,
  zoom = 15,
  markers = [],
  polyline,
  circle,
  height = "300px",
  onClick,
  className,
  fitToContent = false,
}: ILeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const contentPoints: [number, number][] = [
    ...markers.map((m): [number, number] => [m.lat, m.lng]),
    ...(polyline ?? []).map((p): [number, number] => [p.lat, p.lng]),
  ];

  return (
    <div style={{ height, width: "100%" }} className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitToContent ? (
          <FitToContent points={contentPoints} />
        ) : (
          <RecenterOnChange lat={center.lat} lng={center.lng} />
        )}
        <ClickHandler onClick={onClick} />
        {markers.map((marker, index) => (
          <Marker
            key={index}
            position={[marker.lat, marker.lng]}
            icon={markerIcon(marker)}
            draggable={marker.draggable}
            eventHandlers={{
              ...(marker.draggable && marker.onDragEnd
                ? {
                    dragend: (e) => {
                      const position = (e.target as L.Marker).getLatLng();
                      marker.onDragEnd?.(position.lat, position.lng);
                    },
                  }
                : {}),
              ...(marker.onClick ? { click: () => marker.onClick?.() } : {}),
            }}
          >
            {marker.label && (
              <Tooltip permanent direction="bottom" offset={[0, 4]} opacity={1}>
                {marker.label}
              </Tooltip>
            )}
          </Marker>
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline
            positions={polyline.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#75D04B", weight: 4 }}
          />
        )}
        {circle && (
          <Circle
            center={[circle.lat, circle.lng]}
            radius={circle.radiusMeters}
            pathOptions={{ color: "#000", fillColor: "#000", fillOpacity: 0.1, weight: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
