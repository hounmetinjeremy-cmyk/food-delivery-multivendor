// Web shim for react-native-maps (which has no web target — see
// order-details/index.tsx, the only screen that uses this). Reimplements
// just the slice of the MapView/Marker API that screen actually uses, on top
// of Leaflet/OpenStreetMap (ZeGo runs 100% on OSM, never Google Maps), so
// that screen's own logic doesn't need to change at all.
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Animated, Image } from "react-native";
import "leaflet/dist/leaflet.css";

export const PROVIDER_DEFAULT = "default";

export type LatLng = { latitude: number; longitude: number };
export type MapStyleElement = unknown;

interface FitOptions {
  edgePadding?: { top: number; right: number; bottom: number; left: number };
  animated?: boolean;
}

export interface MapViewHandle {
  fitToCoordinates: (coordinates: LatLng[], options?: FitOptions) => void;
}

interface MapViewProps {
  style?: React.CSSProperties;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onMapReady?: () => void;
  zoomControlEnabled?: boolean;
  children?: React.ReactNode;
  // Native-only props, accepted so callers don't need per-platform prop
  // lists, ignored here (no web equivalent / not needed on web).
  customMapStyle?: unknown;
  showsUserLocation?: boolean;
  showsCompass?: boolean;
  showsMyLocationButton?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  mapPadding?: { top: number; right: number; bottom: number; left: number };
  provider?: string;
}

function regionToZoom(latitudeDelta?: number): number {
  if (!latitudeDelta || latitudeDelta <= 0) return 14;
  return Math.min(18, Math.max(3, Math.round(Math.log2(360 / latitudeDelta))));
}

// Bridges the imperative fitToCoordinates() ref call and onMapReady between
// our forwardRef handle and the underlying Leaflet map instance.
function MapController({
  onReady,
  handleRef,
}: {
  onReady?: () => void;
  handleRef: React.MutableRefObject<MapViewHandle | null>;
}) {
  const map = useMap();

  useEffect(() => {
    handleRef.current = {
      fitToCoordinates: (coordinates, options) => {
        if (!coordinates.length) return;
        const bounds = L.latLngBounds(
          coordinates.map((c) => [c.latitude, c.longitude] as [number, number]),
        );
        const p = options?.edgePadding;
        map.fitBounds(bounds, {
          paddingTopLeft: p ? [p.left, p.top] : undefined,
          paddingBottomRight: p ? [p.right, p.bottom] : undefined,
          animate: options?.animated !== false,
        });
      },
    };
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { style, initialRegion, onMapReady, zoomControlEnabled, children },
  ref,
) {
  const handleRef = useRef<MapViewHandle | null>(null);
  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates, options) =>
      handleRef.current?.fitToCoordinates(coordinates, options),
  }));

  const center: [number, number] = [
    initialRegion?.latitude ?? 0,
    initialRegion?.longitude ?? 0,
  ];
  const zoom = regionToZoom(initialRegion?.latitudeDelta);

  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={zoomControlEnabled !== false}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController onReady={onMapReady} handleRef={handleRef} />
        {children}
      </MapContainer>
    </div>
  );
});

export default MapView;

// Both Marker and Marker.Animated take a single <Image source={require(...)}
// style={{width,height}} /> child as their custom pin — resolve it to a
// Leaflet icon once so the marker doesn't fall back to Leaflet's default pin.
function iconFromChildren(children: React.ReactNode): L.Icon | undefined {
  const child = React.Children.count(children) === 1
    ? (React.Children.only(children) as React.ReactElement<{
        source?: unknown;
        style?: { width?: number; height?: number };
      }>)
    : undefined;
  if (!child?.props?.source) return undefined;

  const resolved = Image.resolveAssetSource(child.props.source as never);
  if (!resolved?.uri) return undefined;

  const width = child.props.style?.width ?? resolved.width ?? 32;
  const height = child.props.style?.height ?? resolved.height ?? 32;
  return L.icon({
    iconUrl: resolved.uri,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
}

interface MarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

function MarkerBase({ coordinate, title, onPress, children }: MarkerProps) {
  const icon = useMemo(() => iconFromChildren(children), [children]);
  return (
    <LeafletMarker
      position={[coordinate.latitude, coordinate.longitude]}
      icon={icon}
      eventHandlers={onPress ? { click: onPress } : undefined}
    >
      {title ? <Popup>{title}</Popup> : null}
    </LeafletMarker>
  );
}

interface AnimatedMarkerProps {
  coordinate: { latitude: Animated.Value; longitude: Animated.Value };
  title?: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function currentValue(v: Animated.Value): number {
  return (v as any).__getValue();
}

// react-native-maps drives Marker.Animated's position from Animated.Value
// updates without React re-renders — mirror that here by listening for value
// changes and moving the underlying Leaflet marker imperatively.
function AnimatedMarker({ coordinate, title, onPress, children }: AnimatedMarkerProps) {
  const icon = useMemo(() => iconFromChildren(children), [children]);
  const markerRef = useRef<L.Marker | null>(null);
  const position = useRef<[number, number]>([
    currentValue(coordinate.latitude),
    currentValue(coordinate.longitude),
  ]);

  useEffect(() => {
    const applyPosition = () => markerRef.current?.setLatLng(position.current);
    const latId = coordinate.latitude.addListener(({ value }) => {
      position.current = [value, position.current[1]];
      applyPosition();
    });
    const lngId = coordinate.longitude.addListener(({ value }) => {
      position.current = [position.current[0], value];
      applyPosition();
    });
    return () => {
      coordinate.latitude.removeListener(latId);
      coordinate.longitude.removeListener(lngId);
    };
  }, [coordinate.latitude, coordinate.longitude]);

  return (
    <LeafletMarker
      ref={markerRef}
      position={position.current}
      icon={icon}
      eventHandlers={onPress ? { click: onPress } : undefined}
    >
      {title ? <Popup>{title}</Popup> : null}
    </LeafletMarker>
  );
}

export const Marker = Object.assign(MarkerBase, { Animated: AnimatedMarker });
