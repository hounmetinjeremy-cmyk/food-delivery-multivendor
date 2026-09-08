"use client";

import { useEffect, useRef } from "react";
import { Circle, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon paths break under bundlers unless pointed
// at CDN-hosted images directly.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const vertexIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #000;"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export type ZoneMode = "polygon" | "point" | "radius";

export interface ILatLng {
  lat: number;
  lng: number;
}

export interface IReferenceZone {
  id: string;
  path: ILatLng[];
}

export interface IEditableZoneMapProps {
  mode: ZoneMode;
  center: ILatLng;
  path: ILatLng[];
  radiusMeters?: number;
  zoom?: number;
  height?: string | number;
  onMapClick?: (lat: number, lng: number) => void;
  onVertexDragEnd?: (index: number, lat: number, lng: number) => void;
  onPointDragEnd?: (lat: number, lng: number) => void;
  /** A persistent, always-draggable pin marking the business's own location
   * (separate from the polygon vertices) — used by the restaurant bounds
   * screens across radius/polygon/point modes alike. */
  showCenterMarker?: boolean;
  onCenterDragEnd?: (lat: number, lng: number) => void;
  /** Other zones shown for context only, not editable. */
  referenceZones?: IReferenceZone[];
}

function RecenterOnChange({ lat, lng }: ILatLng) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick?.(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

// Free OpenStreetMap-tiled editable map for delivery-zone drawing (polygon
// vertex editing, single-point placement, or a preview circle whose radius
// is set from a plain number input) — replaces the Google Maps JS SDK's
// Polygon/Circle/drawing tools used across the admin app.
export default function EditableZoneMap({
  mode,
  center,
  path,
  radiusMeters,
  zoom = 14,
  height = "100%",
  onMapClick,
  onVertexDragEnd,
  onPointDragEnd,
  showCenterMarker = false,
  onCenterDragEnd,
  referenceZones = [],
}: IEditableZoneMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%", borderRadius: 10 }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOnChange lat={center.lat} lng={center.lng} />
        <ClickHandler onClick={onMapClick} />

        {referenceZones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.path.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "blue", fillColor: "lightblue", fillOpacity: 0.3, weight: 2 }}
          />
        ))}

        {showCenterMarker && (
          <Marker
            position={[center.lat, center.lng]}
            icon={defaultIcon}
            draggable={!!onCenterDragEnd}
            eventHandlers={
              onCenterDragEnd
                ? {
                    dragend: (e) => {
                      const position = (e.target as L.Marker).getLatLng();
                      onCenterDragEnd(position.lat, position.lng);
                    },
                  }
                : undefined
            }
          />
        )}

        {mode === "polygon" && path.length > 0 && (
          <>
            <Polygon
              positions={path.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: "#000", fillColor: "#000", fillOpacity: 0.35, weight: 2 }}
            />
            {path.map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={vertexIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const position = (e.target as L.Marker).getLatLng();
                    onVertexDragEnd?.(index, position.lat, position.lng);
                  },
                }}
              />
            ))}
          </>
        )}

        {mode === "point" && !showCenterMarker && path.length > 0 && (
          <Marker
            position={[path[0].lat, path[0].lng]}
            icon={defaultIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const position = (e.target as L.Marker).getLatLng();
                onPointDragEnd?.(position.lat, position.lng);
              },
            }}
          />
        )}

        {mode === "radius" && radiusMeters ? (
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusMeters}
            pathOptions={{ color: "#000", fillColor: "#000", fillOpacity: 0.1, weight: 1 }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
