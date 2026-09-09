// Web shim for react-native-maps-directions (native-only, no web target).
// ZeGo runs 100% on OpenStreetMap, never Google Maps, so this draws the
// route via the public OSRM demo router (also OSM-based) instead of the
// Google Directions API the native component calls — same onReady/onError
// contract order-details/index.tsx already expects, so its retry logic
// (remounting via the `key` prop on "NOT_FOUND") keeps working unchanged.
import { useEffect, useRef, useState } from "react";
import { Polyline } from "react-leaflet";

type LatLng = { latitude: number; longitude: number };

interface DirectionsResult {
  distance?: number;
  duration?: number;
  coordinates?: LatLng[];
}

interface MapViewDirectionsProps {
  origin?: LatLng;
  destination?: LatLng;
  strokeWidth?: number;
  strokeColor?: string;
  onReady?: (result: DirectionsResult) => void;
  onError?: (error: unknown) => void;
  // Native-only props, accepted for signature compatibility, unused here.
  apikey?: string;
  precision?: string;
  resetOnChange?: boolean;
  optimizeWaypoints?: boolean;
}

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

export default function MapViewDirections({
  origin,
  destination,
  strokeWidth = 4,
  strokeColor = "#2563eb",
  onReady,
  onError,
}: MapViewDirectionsProps) {
  const [path, setPath] = useState<[number, number][]>([]);
  const requestedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!origin || !destination) return;
    const requestKey = `${origin.latitude},${origin.longitude}-${destination.latitude},${destination.longitude}`;
    if (requestedKeyRef.current === requestKey) return;
    requestedKeyRef.current = requestKey;

    const url = `${OSRM_ROUTE_URL}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

    let cancelled = false;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (!route) throw new Error("NOT_FOUND");
        const points: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng],
        );
        setPath(points);
        onReady?.({
          distance: typeof route.distance === "number" ? route.distance / 1000 : undefined,
          duration: typeof route.duration === "number" ? route.duration / 60 : undefined,
          coordinates: points.map(([latitude, longitude]) => ({ latitude, longitude })),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        requestedKeyRef.current = null;
        onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, onReady, onError]);

  if (!path.length) return null;
  return <Polyline positions={path} color={strokeColor} weight={strokeWidth} />;
}
