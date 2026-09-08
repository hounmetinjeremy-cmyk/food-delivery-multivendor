// lib/utils/constants/profileDefaultTabs.ts
"use client";
import { useTranslations } from "next-intl";
import { ITabItem } from "@/lib/utils/interfaces";
import { useAppMode } from "@/lib/mode";

export const useProfileDefaultTabs = (): ITabItem[] => {
  const t = useTranslations();
  const { isSingleVendor } = useAppMode();
  const base = [
    { label: t("profileDefaultTabs.tab1"), path: "/profile" },
    { label: t("profileDefaultTabs.tab2"), path: "/profile/addresses" },
    { label: t("profileDefaultTabs.tab3"), path: "/profile/order-history" },
    { label: t("profileDefaultTabs.tab4"), path: "/profile/settings" },
    { label: t("profileDefaultTabs.tab5"), path: "/profile/getHelp" },
    { label: t("profileDefaultTabs.tab6"), path: "/profile/customerTicket" },
    // One click each: register (or open the dashboard if already registered)
    // — no marketing page in between. "#become-rider" is a sentinel path
    // handled by ProfileTabs to open a quick signup modal instead of routing.
    {
      label: "Devenir vendeur / Tableau de bord",
      path:
        process.env.NEXT_PUBLIC_ADMIN_URL ??
        "https://zego-admin.hounmetinjeremy.workers.dev",
    },
    { label: "Devenir livreur", path: "#become-rider" },
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
