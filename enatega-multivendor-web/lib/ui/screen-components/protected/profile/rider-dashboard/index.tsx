"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getZegoApiUserRole, zegoApiFetch } from "@/lib/zego-api/client";

const RIDER_URL =
  process.env.NEXT_PUBLIC_RIDER_URL ?? "https://zego-rider.hounmetinjeremy.workers.dev";

const RIDER_SSO_TOKEN_QUERY = /* GraphQL */ `
  query RiderSsoToken {
    riderSsoToken {
      userId
      token
    }
  }
`;

interface RiderSsoTokenResponse {
  riderSsoToken: { userId: string; token: string };
}

// Reuses the existing enatega-multivendor-rider app as-is (deployed as its
// own web build, zego-rider), embedded in-page instead of requiring a
// separate APK — the ZeGo shell (5-tab bar) stays on screen, and nothing
// about that app's screens, orders logic, or maps is rebuilt or duplicated
// here. Signs the rider straight in with a hand-off token/userId instead of
// showing that app's own username/password login screen.
export default function RiderDashboardEmbed() {
  const t = useTranslations();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    const role = getZegoApiUserRole();
    if (role !== "rider") {
      setIsAllowed(false);
      router.replace("/profile");
      return;
    }
    setIsAllowed(true);
    zegoApiFetch<RiderSsoTokenResponse>(RIDER_SSO_TOKEN_QUERY)
      .then((data) => {
        const { token, userId } = data.riderSsoToken;
        setIframeSrc(
          `${RIDER_URL}/sso?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`,
        );
      })
      .catch(() => setIframeSrc(RIDER_URL));
  }, [router]);

  if (isAllowed === null || !iframeSrc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("loading_orders")}
      </div>
    );
  }

  if (!isAllowed) return null;

  return (
    <iframe
      src={iframeSrc}
      title="ZeGo Livreur"
      className="h-full w-full border-0"
      allow="geolocation"
    />
  );
}
