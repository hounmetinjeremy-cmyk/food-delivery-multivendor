"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getZegoApiToken, zegoApiFetch } from "@/lib/zego-api/client";

const CLIENT_APP_URL =
  process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "https://zego-client.hounmetinjeremy.workers.dev";

const CUSTOMER_SSO_TOKEN_QUERY = /* GraphQL */ `
  query CustomerSsoToken {
    customerSsoToken {
      userId
      token
    }
  }
`;

interface CustomerSsoTokenResponse {
  customerSsoToken: { userId: string; token: string };
}

// Reuses the real enatega-multivendor-app (the original fork's customer
// mobile app) as-is, exported to its own web build (zego-client) and
// embedded here — same pattern as the rider dashboard. Kept out of the main
// Accueil tab on purpose: Accueil's own discovery/checkout/payment flow is
// already live in production and stays untouched, this is a separate,
// optional space reachable from Profil, like "Devenir livreur".
export default function ClientAppEmbed() {
  const t = useTranslations();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!getZegoApiToken()) {
      setIframeSrc(CLIENT_APP_URL);
      return;
    }
    zegoApiFetch<CustomerSsoTokenResponse>(CUSTOMER_SSO_TOKEN_QUERY)
      .then((data) => {
        const { token } = data.customerSsoToken;
        setIframeSrc(`${CLIENT_APP_URL}?ssoToken=${encodeURIComponent(token)}`);
      })
      .catch(() => setIframeSrc(CLIENT_APP_URL));
  }, []);

  if (!iframeSrc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("loading_orders")}
      </div>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      title="ZeGo"
      className="h-full w-full border-0"
      allow="geolocation"
    />
  );
}
