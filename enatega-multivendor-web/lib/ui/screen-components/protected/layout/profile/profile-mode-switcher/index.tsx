"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import RiderSignupModal from "@/lib/ui/useable-components/rider-signup-modal";
import VendorSignupModal from "@/lib/ui/useable-components/vendor-signup-modal";
import { getZegoApiUserRole } from "@/lib/zego-api/client";
import { openApkDownload } from "@/lib/utils/methods/helpers";
import useToast from "@/lib/hooks/useToast";

// Slim top bar for the full-screen profile spaces (vendor/rider dashboard) —
// lets a user jump between their Client/Vendeur/Livreur spaces without the
// full ProfileHeader/ProfileTabs chrome, which was doubling up with the
// embedded dashboard's own navigation.
export default function ProfileModeSwitcher() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { showToast } = useToast();
  const [isRiderModalVisible, setIsRiderModalVisible] = useState(false);
  const [isVendorModalVisible, setIsVendorModalVisible] = useState(false);

  const role = getZegoApiUserRole();

  const goToVendor = () => {
    if (role === "vendor" || role === "admin") {
      router.push("/profile/dashboard");
    } else {
      setIsVendorModalVisible(true);
    }
  };

  const goToRider = () => {
    if (role === "rider") {
      router.push("/profile/rider-dashboard");
      return;
    }
    // Live GPS tracking needs the native app — the plain website sends
    // riders-to-be to install/open it instead of registering here.
    if (!Capacitor.isNativePlatform()) {
      showToast({
        type: "info",
        title: "Application requise",
        message:
          "Le mode livreur nécessite l'application mobile ZeGo (GPS et suivi en temps réel). Téléchargement en cours...",
        duration: 5000,
      });
      openApkDownload();
      return;
    }
    setIsRiderModalVisible(true);
  };

  const modes = [
    { key: "client", label: "Client", active: pathname === "/profile", onClick: () => router.push("/profile") },
    { key: "vendor", label: "Vendeur", active: pathname.startsWith("/profile/dashboard"), onClick: goToVendor },
    { key: "rider", label: "Livreur", active: pathname.startsWith("/profile/rider-dashboard"), onClick: goToRider },
  ];

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      {modes.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={mode.onClick}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode.active
              ? "bg-primary-color text-white"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {mode.label}
        </button>
      ))}

      <RiderSignupModal
        visible={isRiderModalVisible}
        onHide={() => setIsRiderModalVisible(false)}
      />
      <VendorSignupModal
        visible={isVendorModalVisible}
        onHide={() => setIsVendorModalVisible(false)}
      />
    </div>
  );
}
