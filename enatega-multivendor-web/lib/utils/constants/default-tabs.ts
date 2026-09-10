// lib/utils/constants/profileDefaultTabs.ts
"use client";
import { useTranslations } from "next-intl";
import { ITabItem } from "@/lib/utils/interfaces";
import { useAppMode } from "@/lib/mode";
import { getZegoApiUserRole } from "@/lib/zego-api/client";
import { APK_DOWNLOAD_URL } from "@/lib/utils/constants/apk";

export const useProfileDefaultTabs = (): ITabItem[] => {
  const t = useTranslations();
  const { isSingleVendor } = useAppMode();
  const role = getZegoApiUserRole();
  const base = [
    { label: t("profileDefaultTabs.tab1"), path: "/profile" },
    { label: t("profileDefaultTabs.tab2"), path: "/profile/addresses" },
    { label: t("profileDefaultTabs.tab3"), path: "/profile/order-history" },
    { label: t("profileDefaultTabs.tab4"), path: "/profile/settings" },
    { label: t("profileDefaultTabs.tab5"), path: "/profile/getHelp" },
    { label: t("profileDefaultTabs.tab6"), path: "/profile/customerTicket" },
    // The original fork's own customer app (enatega-multivendor-app), reused
    // as-is and embedded here — a separate, optional space, not a
    // replacement for the live Accueil tab's own discovery/checkout flow.
    { label: "Nouvelle interface (bêta)", path: "/profile/client-app" },
    // One click each: register (or open the dashboard if already registered)
    // — no marketing page and no leaving the app. "#become-rider" and
    // "#vendor-dashboard" are sentinel paths handled by ProfileTabs, which
    // opens a quick signup modal or the in-app dashboard instead of routing
    // to an external URL.
    { label: "Devenir vendeur / Tableau de bord", path: "#vendor-dashboard" },
    { label: "Devenir livreur", path: "#become-rider" },
    ...(role === "rider"
      ? [{ label: "Tableau de bord livreur", path: "/profile/rider-dashboard" }]
      : []),
    {
      label: "Télécharger l'application (APK)",
      path: APK_DOWNLOAD_URL,
    },
  ];
  return isSingleVendor ? [
    ...base.slice(0, 3),
    { label: "Favorites", path: "/profile/favorites" },
    { label: "Vouchers", path: "/profile/vouchers" },
    { label: "Wallet", path: "/profile/wallet" },
    { label: "Membership", path: "/profile/membership" },
    { label: "Referral", path: "/profile/referral" },
    ...base.slice(3),
  ] : base;
};
