"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone, faCommentDots, faMotorcycle, faStar } from "@fortawesome/free-solid-svg-icons";

import { zegoApiFetch, getZegoApiToken } from "@/lib/zego-api/client";
import LeafletMap from "@/lib/ui/useable-components/leaflet-map/dynamic";
import type { ILeafletMapMarker } from "@/lib/ui/useable-components/leaflet-map";

interface Rider {
  id: string;
  name: string;
  phone: string | null;
  imageUrl: string | null;
  vehicleType: string | null;
  ratingAvg: number;
  ratingCount: number;
  location: { coordinates: [number, number] } | null;
}

const AVAILABLE_RIDERS_QUERY = /* GraphQL */ `
  query AvailableRiders {
    availableRiders {
      id
      name
      phone
      imageUrl
      vehicleType
      ratingAvg
      ratingCount
      location {
        coordinates
      }
    }
  }
`;

const START_CONVERSATION_MUTATION = /* GraphQL */ `
  mutation StartConversation($withUserId: ID!) {
    startConversation(withUserId: $withUserId) {
      id
    }
  }
`;

export default function RidersList() {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagingRiderId, setMessagingRiderId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    zegoApiFetch<{ availableRiders: Rider[] }>(AVAILABLE_RIDERS_QUERY)
      .then((data) => {
        if (!cancelled) setRiders(data.availableRiders);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load riders");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMessage = async (riderId: string) => {
    if (!getZegoApiToken()) {
      router.push("/auth/login");
      return;
    }
    setMessagingRiderId(riderId);
    try {
      const data = await zegoApiFetch<{ startConversation: { id: string } }>(
        START_CONVERSATION_MUTATION,
        { withUserId: riderId },
      );
      router.push(`/messages/${data.startConversation.id}`);
    } catch {
      setMessagingRiderId(null);
    }
  };

  const ridersWithLocation = riders.filter((rider) => rider.location);
  const markers: ILeafletMapMarker[] = ridersWithLocation.map((rider) => ({
    lat: Number(rider.location!.coordinates[1]),
    lng: Number(rider.location!.coordinates[0]),
    label: rider.name,
    onClick: () => handleMessage(rider.id),
  }));
  const mapCenter = useMemo(() => {
    if (ridersWithLocation.length > 0) {
      const [lng, lat] = ridersWithLocation[0].location!.coordinates;
      return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }, [ridersWithLocation]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-dispatch-ink dark:text-white">
        Livreurs disponibles
      </h1>

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chargement…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!isLoading && !error && riders.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucun livreur disponible pour le moment.
        </p>
      )}

      {mapCenter && (
        <div className="mb-4">
          <LeafletMap height="40vh" center={mapCenter} zoom={13} markers={markers} fitToContent />
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {riders.map((rider) => (
          <li
            key={rider.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              {rider.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rider.imageUrl} alt={rider.name} className="h-full w-full object-cover" />
              ) : (
                <FontAwesomeIcon icon={faMotorcycle} className="text-gray-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-dispatch-ink dark:text-white">{rider.name}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {rider.vehicleType ?? "Véhicule non précisé"}
                {rider.ratingCount > 0 && (
                  <>
                    {" · "}
                    <FontAwesomeIcon icon={faStar} className="text-amber-400" />{" "}
                    {rider.ratingAvg.toFixed(1)}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {rider.phone && (
                <a
                  href={`tel:${rider.phone}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-color text-white"
                  aria-label={`Appeler ${rider.name}`}
                >
                  <FontAwesomeIcon icon={faPhone} className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => handleMessage(rider.id)}
                disabled={messagingRiderId === rider.id}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-dispatch-ink disabled:opacity-50 dark:border-gray-700 dark:text-white"
                aria-label={`Envoyer un message à ${rider.name}`}
              >
                <FontAwesomeIcon icon={faCommentDots} className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
