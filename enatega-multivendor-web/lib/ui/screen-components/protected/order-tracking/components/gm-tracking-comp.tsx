"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import HomeIcon from "../../../../../assets/home_icon.png";
import RiderIcon from "../../../../../assets/rider_icon.png";
import StoreIcon from "../../../../../assets/zego-logo.png";
import Image from "@/lib/ui/useable-components/safe-image";
import LeafletMap from "@/lib/ui/useable-components/leaflet-map/dynamic";
import type {
  IOrderEta,
  IRiderTrackingLocation,
} from "@/lib/utils/interfaces/orders.interface";
import {
  decodePolyline,
  trimPolylineToRider,
} from "@/lib/utils/methods/order-eta";

interface IGoogleMapTrackingComponent {
  isLoaded: boolean;
  destination: { lat: number; lng: number };
  origin?: { lat: number; lng: number } | null;
  eta?: IOrderEta | null;
  riderLocation?: IRiderTrackingLocation | null;
  requireBackendRoute?: boolean;
  showStaticLoadingImage?: boolean;
}

function GoogleMapTrackingComponent({
  isLoaded,
  destination,
  origin,
  eta,
  riderLocation,
  requireBackendRoute = false,
  showStaticLoadingImage = true,
}: IGoogleMapTrackingComponent) {
  const t = useTranslations();

  const riderCoordinate = useMemo(() => {
    if (!riderLocation) return null;
    const lat = Number(riderLocation.latitude);
    const lng = Number(riderLocation.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [riderLocation]);

  const route = useMemo(() => {
    const decoded = decodePolyline(eta?.encodedPolyline);
    const trimmed = trimPolylineToRider(decoded, riderLocation);
    if (trimmed.length > 1) return trimmed;
    if (requireBackendRoute) return [];
    if (riderCoordinate) return [riderCoordinate, destination];
    return origin ? [origin, destination] : [];
  }, [
    destination,
    eta?.encodedPolyline,
    origin,
    requireBackendRoute,
    riderCoordinate,
    riderLocation,
  ]);

  if (!isLoaded) {
    if (!showStaticLoadingImage) {
      return (
        <div
          className="flex h-80 items-center justify-center bg-gray-100 px-6 text-center dark:bg-gray-900"
          aria-live="polite"
        >
          <div>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-color" />
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Loading the interactive map…
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="relative">
        <Image
          alt={t("map_showing_delivery_route_alt")}
          className="h-64 w-full object-cover"
          height="300"
          src="https://storage.googleapis.com/a1aa/image/jt1AynRJJVtM9j1LRb30CodA1xsK2R23pWTOmRv3nsM.jpg"
          width="1200"
        />
      </div>
    );
  }

  const markers = [
    { lat: destination.lat, lng: destination.lng, iconUrl: HomeIcon.src },
    ...(origin ? [{ lat: origin.lat, lng: origin.lng, iconUrl: StoreIcon.src }] : []),
    ...(riderCoordinate
      ? [{ lat: riderCoordinate.lat, lng: riderCoordinate.lng, iconUrl: RiderIcon.src }]
      : []),
  ];

  return (
    <div className="relative overflow-hidden rounded-b-2xl">
      <LeafletMap
        height="400px"
        center={riderCoordinate || origin || destination}
        zoom={14}
        markers={markers}
        polyline={route.length > 1 ? route : undefined}
        fitToContent
      />
    </div>
  );
}

export default GoogleMapTrackingComponent;
