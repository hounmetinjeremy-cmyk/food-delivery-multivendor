"use client";

import { useEffect, useState } from "react";
import { getZegoApiUserId, zegoApiFetch } from "@/lib/zego-api/client";
import useCurrencyFormatter from "@/lib/hooks/useCurrencyFormatter";

interface RiderWalletProfile {
  currentWalletAmount: number;
  totalWalletAmount: number;
  withdrawnWalletAmount: number;
}

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  orderId: string | null;
  createdAt: string;
}

const RIDER_WALLET_QUERY = /* GraphQL */ `
  query RiderWallet($id: String!) {
    rider(id: $id) {
      currentWalletAmount
      totalWalletAmount
      withdrawnWalletAmount
    }
    transactionHistory {
      id
      amount
      type
      orderId
      createdAt
    }
  }
`;

const TRANSACTION_LABELS: Record<string, string> = {
  delivery_earning: "Livraison",
  withdrawal: "Retrait",
  adjustment: "Ajustement",
};

// Mirrors the existing rider app's Earnings tab (balance + history) — the
// backend wallet/transactionHistory this reads from didn't exist before
// (riders had no wallet at all), so this is the matching frontend for the
// wallet ledger added alongside it in zego-api.
export default function RiderWallet() {
  const { formatCurrency } = useCurrencyFormatter();
  const [wallet, setWallet] = useState<RiderWalletProfile | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    zegoApiFetch<{ rider: RiderWalletProfile | null; transactionHistory: WalletTransaction[] }>(
      RIDER_WALLET_QUERY,
      { id: riderId },
    )
      .then((data) => {
        setWallet(data.rider);
        setTransactions(data.transactionHistory);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load wallet"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="py-6">
      <h1 className="mb-5 text-2xl font-bold text-gray-900 dark:text-white">Portefeuille</h1>

      <div className="rounded-3xl bg-primary-color p-8 text-white">
        <p>Solde disponible</p>
        <p className="mt-2 text-4xl font-bold">
          {isLoading ? "—" : formatCurrency(wallet?.currentWalletAmount ?? 0)}
        </p>
        <p className="mt-4 text-sm opacity-80">
          Total gagné : {isLoading ? "—" : formatCurrency(wallet?.totalWalletAmount ?? 0)}
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <h2 className="mb-2 mt-6 text-lg font-semibold dark:text-white">Historique</h2>
      {!isLoading && transactions.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucune transaction pour le moment.</p>
      )}
      <div className="flex flex-col gap-2">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <div>
              <p className="font-medium dark:text-white">
                {TRANSACTION_LABELS[transaction.type] ?? transaction.type}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`font-semibold ${
                transaction.type === "withdrawal" ? "text-red-500" : "text-primary-color"
              }`}
            >
              {transaction.type === "withdrawal" ? "-" : "+"}
              {formatCurrency(transaction.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
