"use client";
import { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import LeafletMap from "@/lib/ui/useable-components/leaflet-map/dynamic";
import type { ILeafletMapMarker } from "@/lib/ui/useable-components/leaflet-map";

interface MapProps {
  apiKey: string;
  data: Array<{
    _id: string;
    name: string;
    location: { coordinates: [number, number] };
    image: string;
    address: string;
    slug?: string;
    shopType?: string;
  }>;
  center: { lat: number; lng: number } | null;
}

const Map: FC<MapProps> = ({ data, center }) => {
  const router = useRouter();

  const defaultCenter = useMemo(() => {
    if (data.length > 0) {
      const [lng, lat] = data[0].location.coordinates;
      return { lat: Number(lat), lng: Number(lng) };
    }
    return { lat: 33.6844, lng: 73.0479 }; // Default to Islamabad
  }, [data]);

  const getRedirectUrl = (item: MapProps["data"][number]) =>
    `/${item.shopType === "restaurant" ? "restaurant" : "store"}/${item?.slug}/${item._id}`;

  const markers: ILeafletMapMarker[] = data
    .filter((restaurant) => restaurant.location?.coordinates?.length === 2)
    .map((restaurant) => ({
      lat: Number(restaurant.location.coordinates[1]),
      lng: Number(restaurant.location.coordinates[0]),
      label: restaurant.name,
      iconUrl: restaurant.image,
      iconSize: [50, 50],
      onClick: () => router.push(getRedirectUrl(restaurant)),
    }));

  return (
    <LeafletMap
      height="100vh"
      center={center || defaultCenter}
      zoom={12}
      markers={markers}
    />
  );
};

export default Map;
