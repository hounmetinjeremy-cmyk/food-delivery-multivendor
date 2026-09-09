"use client"

import { CSSProperties, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IProfileTabsProps, ITabItem } from "@/lib/utils/interfaces";
import { TabItem } from "@/lib/ui/useable-components/profile-tabs";
import { useProfileDefaultTabs } from "@/lib/utils/constants";
import RiderSignupModal from "@/lib/ui/useable-components/rider-signup-modal";
import VendorSignupModal from "@/lib/ui/useable-components/vendor-signup-modal";
import { getZegoApiUserRole } from "@/lib/zego-api/client";

const BECOME_RIDER_PATH = "#become-rider";
const VENDOR_DASHBOARD_PATH = "#vendor-dashboard";

export default function ProfileTabs({ className, tabs }: IProfileTabsProps & { tabs?: ITabItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isRiderModalVisible, setIsRiderModalVisible] = useState(false);
  const [isVendorModalVisible, setIsVendorModalVisible] = useState(false);

  // Use the passed tabs or default to profileDefaultTabs
  const defaultTabs = useProfileDefaultTabs();
  const tabsToRender: ITabItem[] = tabs ?? defaultTabs; // ✅ safe fallback

  const goToTab = (path: string) => {
    if (path === BECOME_RIDER_PATH) {
      setIsRiderModalVisible(true);
      return;
    }
    if (path === VENDOR_DASHBOARD_PATH) {
      // Already a vendor (or admin)? Go straight to the in-app dashboard
      // instead of asking them to request access again.
      const role = getZegoApiUserRole();
      if (role === "vendor" || role === "admin") {
        router.push("/profile/dashboard");
      } else {
        setIsVendorModalVisible(true);
      }
      return;
    }
    if (path.startsWith("http")) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(path);
  };

  const scrollableStyles: CSSProperties = {
    msOverflowStyle: "none", // IE and Edge
    scrollbarWidth: "none", // Firefox
    WebkitOverflowScrolling: "touch", // Smooth scrolling
  };

  // Function to scroll active tab into center view
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeTabElement = container.querySelector('.active-tab');
      
      if (activeTabElement) {
        // Calculate positions
        const containerWidth = container.offsetWidth;
        const tabWidth = (activeTabElement as HTMLElement).offsetWidth;
        const tabLeft = (activeTabElement as HTMLElement).offsetLeft;
        
        // Calculate scroll position to center the tab
        const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2);
        
        // Smooth scroll to position
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [pathname]);

  return (
    <div className={`w-full md:w-auto max-w-7xl border-b border-gray-200 dark:border-gray-700 ${className || ""}`}>
      {/* Mobile View - Horizontally scrollable with centered active tab */}
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto md:hidden px-1 pb-1 snap-x" 
        style={{ ...scrollableStyles }}
      >
        {tabsToRender.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <TabItem
              key={tab.path}
              tab={tab}
              isActive={isActive}
              onClick={() => goToTab(tab.path)}
              className={`py-1 text-sm font-medium whitespace-nowrap flex-shrink-0 mx-3 snap-center dark:text-gray-300 ${
                isActive ? 'active-tab' : ''
              }`}
            />
          );
        })}
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex space-x-8 rtl:space-x-reverse">
        {tabsToRender.map((tab) => (
          <TabItem
            key={tab.path}
            tab={tab}
            isActive={pathname === tab.path}
            onClick={() => goToTab(tab.path)}
            className="py-1 px-1 text-lg font-medium dark:text-gray-300"
          />
        ))}
      </div>

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