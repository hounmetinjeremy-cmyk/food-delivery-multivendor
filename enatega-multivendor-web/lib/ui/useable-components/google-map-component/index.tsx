"use client";
import { useContext } from "react";
import LeafletMap from "@/lib/ui/useable-components/leaflet-map/dynamic";
import { IGoogleMapComponentProps } from "@/lib/utils/interfaces";
import { GoogleMapsContext } from "@/lib/context/global/google-maps.context";

// Restaurant location + delivery-radius display, backed by the free
// Leaflet/OpenStreetMap stack instead of the Google Maps JS SDK.
const GoogleMapComponent = ({
  center,
  circleRadius = 300, // Default radius of 300 meters
  visible,
}: IGoogleMapComponentProps) => {
  const { isLoaded } = useContext(GoogleMapsContext);

  if (!visible) return null;

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-gray-200 rounded-md flex items-center justify-center text-gray-500"></div>
    );
  }

  return (
    <div className="map-container" style={{ position: "relative" }}>
      <LeafletMap
        height="360px"
        center={center}
        zoom={15}
        markers={[{ lat: center.lat, lng: center.lng }]}
        circle={{ lat: center.lat, lng: center.lng, radiusMeters: circleRadius }}
      />
    </div>
  );
};

export default GoogleMapComponent;
