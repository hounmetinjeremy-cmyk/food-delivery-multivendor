"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getZegoApiUserRole, zegoApiFetch } from "@/lib/zego-api/client";

const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://zego-admin.hounmetinjeremy.workers.dev";

const ADMIN_SSO_TOKEN_QUERY = /* GraphQL */ `
  query AdminSsoToken {
    adminSsoToken
  }
`;

// Reuses the existing admin app as-is, embedded in-page instead of opened as
// an external link — the ZeGo shell (5-tab bar) stays on screen and the
// browser never navigates away, but nothing about the admin dashboard
// itself is rebuilt or duplicated here. Signs the vendor straight into the
// embedded admin app with a short-lived hand-off token instead of showing
// its own separate email/password login screen.
export default function VendorDashboardEmbed() {
  const t = useTranslations();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    const role = getZegoApiUserRole();
    if (role !== "vendor" && role !== "admin") {
      setIsAllowed(false);
      router.replace("/profile");
      return;
    }
    setIsAllowed(true);
    zegoApiFetch<{ adminSsoToken: string }>(ADMIN_SSO_TOKEN_QUERY)
      .then((data) => {
        setIframeSrc(`${ADMIN_URL}/sso?token=${encodeURIComponent(data.adminSsoToken)}`);
      })
      .catch(() => setIframeSrc(ADMIN_URL));
  }, [router]);

  if (isAllowed === null || !iframeSrc) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t("loading_orders")}
      </div>
    );
  }

  if (!isAllowed) return null;

  return (
    <div className="w-full">
      <iframe
        src={iframeSrc}
        title="ZeGo Admin"
        className="h-[75vh] w-full rounded-lg border border-gray-200 dark:border-gray-700"
        allow="geolocation"
      />
    </div>
  );
}
