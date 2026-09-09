"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getZegoApiUserRole } from "@/lib/zego-api/client";

const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://zego-admin.hounmetinjeremy.workers.dev";

// Reuses the existing admin app as-is, embedded in-page instead of opened as
// an external link — the ZeGo shell (5-tab bar) stays on screen and the
// browser never navigates away, but nothing about the admin dashboard
// itself is rebuilt or duplicated here.
export default function VendorDashboardEmbed() {
  const t = useTranslations();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const role = getZegoApiUserRole();
    if (role === "vendor" || role === "admin") {
      setIsAllowed(true);
    } else {
      setIsAllowed(false);
      router.replace("/profile");
    }
  }, [router]);

  if (isAllowed === null) {
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
        src={ADMIN_URL}
        title="ZeGo Admin"
        className="h-[75vh] w-full rounded-lg border border-gray-200 dark:border-gray-700"
        allow="geolocation"
      />
    </div>
  );
}
