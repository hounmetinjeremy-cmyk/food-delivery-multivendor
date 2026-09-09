"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import RiderSignupModal from "@/lib/ui/useable-components/rider-signup-modal";
import VendorSignupModal from "@/lib/ui/useable-components/vendor-signup-modal";
import { getZegoApiUserRole } from "@/lib/zego-api/client";

// Slim top bar for the full-screen profile spaces (vendor/rider dashboard) —
// lets a user jump between their Client/Vendeur/Livreur spaces without the
// full ProfileHeader/ProfileTabs chrome, which was doubling up with the
// embedded dashboard's own navigation.
export default function ProfileModeSwitcher() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
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
    } else {
      setIsRiderModalVisible(true);
    }
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
