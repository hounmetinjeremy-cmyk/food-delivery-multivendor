"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getZegoApiUserId,
  getZegoApiUserRole,
  zegoApiFetch,
} from "@/lib/zego-api/client";
import { calculateDistance } from "@/lib/utils/methods/order";
import LeafletMap from "@/lib/ui/useable-components/leaflet-map/dynamic";
import type { ILeafletMapMarker } from "@/lib/ui/useable-components/leaflet-map";

interface RiderOrder {
  id: string;
  orderId: string;
  orderStatus: string;
  rider: { id: string } | null;
  restaurant: { name: string; address: string | null };
  deliveryAddress: { deliveryAddress: string } | null;
}

interface RiderProfile {
  _id: string;
  available: boolean | null;
  location: { coordinates: [number, number] } | null;
}

const RIDER_ORDERS_QUERY = /* GraphQL */ `
  query RiderOrders {
    riderOrders {
      id
      orderId
      orderStatus
      rider {
        id
      }
      restaurant {
        name
        address
      }
      deliveryAddress {
        deliveryAddress
      }
    }
  }
`;

const RIDER_QUERY = /* GraphQL */ `
  query Rider($id: String!) {
    rider(id: $id) {
      _id
      available
      location {
        coordinates
      }
    }
  }
`;

const TOGGLE_AVAILABILITY_MUTATION = /* GraphQL */ `
  mutation ToggleAvailablity($id: String!) {
    toggleAvailablity(id: $id) {
      _id
      available
    }
  }
`;

const UPDATE_ORDER_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateOrderStatusRider($id: String!, $status: String!) {
    updateOrderStatusRider(id: $id, status: $status) {
      id
      orderStatus
    }
  }
`;

const ASSIGN_ORDER_MUTATION = /* GraphQL */ `
  mutation AssignOrder($id: String!) {
    assignOrder(id: $id) {
      id
      orderStatus
    }
  }
`;

const UPDATE_RIDER_LOCATION_MUTATION = /* GraphQL */ `
  mutation UpdateRiderLocation($latitude: String!, $longitude: String!) {
    updateRiderLocation(latitude: $latitude, longitude: $longitude) {
      _id
    }
  }
`;

// Location-ping throttle matched to the existing Enatega rider app
// (lib/context/global/location.context.tsx there): skip updates closer than
// 8s or 20m apart, and only track while actively delivering.
const MIN_PING_INTERVAL_MS = 8000;
const MIN_PING_DISTANCE_METERS = 20;

// Mirrors the existing enatega-multivendor-rider app's Home/orders screens
// (New / Processing, bucketed from one riderOrders list) and its location
// tracking (watchPosition while delivering, throttled updateRiderLocation
// pings) — reusing the same zego-api queries/mutations that already power
// that app, just rendered for the web/APK instead of React Native.
export default function RiderDashboard() {
  const t = useTranslations();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPingRef = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const loadData = useCallback(async (riderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersData, riderData] = await Promise.all([
        zegoApiFetch<{ riderOrders: RiderOrder[] }>(RIDER_ORDERS_QUERY),
        zegoApiFetch<{ rider: RiderProfile | null }>(RIDER_QUERY, { id: riderId }),
      ]);
      setOrders(ordersData.riderOrders);
      setIsAvailable(Boolean(riderData.rider?.available));
      if (riderData.rider?.location) {
        const [lng, lat] = riderData.rider.location.coordinates;
        setMyLocation({ lat: Number(lat), lng: Number(lng) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const role = getZegoApiUserRole();
    const riderId = getZegoApiUserId();
    if (role !== "rider" || !riderId) {
      setIsAllowed(false);
      router.replace("/profile");
      return;
    }
    setIsAllowed(true);
    void loadData(riderId);
  }, [router, loadData]);

  const newOrders = orders.filter((order) => !order.rider);
  const myOrders = orders.filter((order) => order.rider);
  const isActivelyDelivering = myOrders.some(
    (order) => order.orderStatus === "ASSIGNED" || order.orderStatus === "PICKED",
  );

  // Only pings the server while actively delivering, throttled — same gate
  // and thresholds as the existing rider app's foreground tracking.
  useEffect(() => {
    if (!isActivelyDelivering || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });
        const last = lastPingRef.current;
        const now = Date.now();
        if (last) {
          const elapsed = now - last.at;
          const distanceMeters =
            calculateDistance(last.lat, last.lng, latitude, longitude) * 1000;
          if (elapsed < MIN_PING_INTERVAL_MS && distanceMeters < MIN_PING_DISTANCE_METERS) {
            return;
          }
        }
        lastPingRef.current = { at: now, lat: latitude, lng: longitude };
        void zegoApiFetch(UPDATE_RIDER_LOCATION_MUTATION, {
          latitude: String(latitude),
          longitude: String(longitude),
        }).catch(() => {
          // Non-fatal: next watchPosition tick retries.
        });
      },
      () => {
        // Permission denied or unavailable — the dashboard still works
        // without live tracking, just without the position updates.
      },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isActivelyDelivering]);

  const handleToggleAvailability = async () => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    setIsToggling(true);
    try {
      const data = await zegoApiFetch<{ toggleAvailablity: RiderProfile }>(
        TOGGLE_AVAILABILITY_MUTATION,
        { id: riderId },
      );
      setIsAvailable(Boolean(data.toggleAvailablity.available));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setIsToggling(false);
    }
  };

  const refresh = async () => {
    const riderId = getZegoApiUserId();
    if (riderId) await loadData(riderId);
  };

  const handleAssign = async (order: RiderOrder) => {
    setUpdatingOrderId(order.id);
    try {
      await zegoApiFetch(ASSIGN_ORDER_MUTATION, { id: order.id });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAdvanceStatus = async (order: RiderOrder) => {
    const nextStatus = order.orderStatus === "ASSIGNED" ? "PICKED" : "DELIVERED";
    setUpdatingOrderId(order.id);
    try {
      await zegoApiFetch(UPDATE_ORDER_STATUS_MUTATION, {
        id: order.id,
        status: nextStatus,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (isAllowed === null || !isAllowed) return null;

  const markers: ILeafletMapMarker[] = myLocation
    ? [{ lat: myLocation.lat, lng: myLocation.lng, label: "Moi" }]
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dispatch-ink dark:text-white">
          {t("zego_rider_page_name_form_heading")}
        </h1>
        <button
          type="button"
          onClick={handleToggleAvailability}
          disabled={isToggling}
          className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-all ${
            isAvailable ? "bg-primary-color" : "bg-gray-400"
          } disabled:opacity-60`}
        >
          {isAvailable ? "Disponible" : "Indisponible"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/profile/rider-profile-details")}
        className="mb-6 text-sm font-medium text-primary-color underline"
      >
        Véhicule, permis, coordonnées bancaires et horaires
      </button>

      {myLocation && (
        <div className="mb-6">
          <LeafletMap height="30vh" center={myLocation} zoom={14} markers={markers} />
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading_orders")}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!isLoading && !error && (
        <>
          <h2 className="mb-2 mt-4 text-lg font-semibold dark:text-white">
            Nouvelles commandes
          </h2>
          {newOrders.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucune nouvelle commande à prendre.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {newOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <span className="font-medium dark:text-white">{order.restaurant.name}</span>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {order.deliveryAddress?.deliveryAddress ?? order.restaurant.address}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAssign(order)}
                    disabled={updatingOrderId === order.id}
                    className="mt-3 rounded-full bg-primary-color px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    S&apos;assigner
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2 className="mb-2 mt-6 text-lg font-semibold dark:text-white">
            Mes livraisons en cours
          </h2>
          {myOrders.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucune livraison en cours.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium dark:text-white">{order.restaurant.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {order.orderStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {order.deliveryAddress?.deliveryAddress ?? order.restaurant.address}
                  </p>
                  {(order.orderStatus === "ASSIGNED" || order.orderStatus === "PICKED") && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(order)}
                      disabled={updatingOrderId === order.id}
                      className="mt-3 rounded-full bg-primary-color px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {order.orderStatus === "ASSIGNED" ? "Marquer récupéré" : "Marquer livré"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
