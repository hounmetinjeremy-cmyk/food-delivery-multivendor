"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getZegoApiUserId,
  getZegoApiUserRole,
  zegoApiFetch,
} from "@/lib/zego-api/client";

interface RiderOrder {
  id: string;
  orderId: string;
  orderStatus: string;
  restaurant: { name: string; address: string | null };
  deliveryAddress: { deliveryAddress: string } | null;
}

interface RiderProfile {
  _id: string;
  available: boolean | null;
}

const RIDER_ORDERS_QUERY = /* GraphQL */ `
  query RiderOrders {
    riderOrders {
      id
      orderId
      orderStatus
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

// The rider self-service dashboard has no existing UI to reuse (the "Livreur"
// tab is a customer-facing directory for contacting riders), so this is new
// — but it only calls mutations/queries already built and shipped in zego-api
// (orders.ts): riderOrders, toggleAvailablity, updateOrderStatusRider.
export default function RiderDashboard() {
  const t = useTranslations();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleAdvanceStatus = async (order: RiderOrder) => {
    const nextStatus = order.orderStatus === "ASSIGNED" ? "PICKED" : "DELIVERED";
    setUpdatingOrderId(order.id);
    try {
      await zegoApiFetch(UPDATE_ORDER_STATUS_MUTATION, {
        id: order.id,
        status: nextStatus,
      });
      const riderId = getZegoApiUserId();
      if (riderId) await loadData(riderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (isAllowed === null || !isAllowed) return null;

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

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading_orders")}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!isLoading && !error && orders.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucune commande en cours.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium dark:text-white">{order.restaurant.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{order.orderStatus}</span>
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
    </div>
  );
}
