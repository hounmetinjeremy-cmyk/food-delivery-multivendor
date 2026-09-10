"use client";

import { useEffect, useState } from "react";
// Components
import AppTopbar from "@/lib/ui/screen-components/un-protected/layout/app-bar";

// Interface & Types
import { IProvider } from "@/lib/utils/interfaces";

// Google OAuth
import { useConfig } from "@/lib/context/configuration/configuration.context";
import { GoogleMapsProvider } from "@/lib/context/global/google-maps.context";
import AuthModal from "@/lib/ui/screen-components/un-protected/authentication";
import AppFooter from "../../screen-components/un-protected/layout/app-footer";
import BottomTabBar from "../../screen-components/un-protected/layout/bottom-tab-bar";
import StripeOrderRecovery from "../../screens/protected/order/stripe-order-recovery";

// Search Context
import { useSearchUI } from "@/lib/context/search/search.context";

// Hooks
import { useAuth } from "@/lib/context/auth/auth.context";
import { usePathname } from "next/navigation";
import { hasValidAuthToken } from "@/lib/utils/methods/auth";
import { isImmersiveEmbedRoute } from "@/lib/utils/methods/helpers";

const AppLayout = ({ children }: IProvider) => {
  const pathname = usePathname();
  const immersive = isImmersiveEmbedRoute(pathname ?? "");
  const [isScrolled, setIsScrolled] = useState(false);
  // Hooks
  const { isAuthModalVisible, setIsAuthModalVisible, setActivePanel } = useAuth();
  const { isSearchFocused } = useSearchUI();

  // Hook
  const { GOOGLE_MAPS_KEY, LIBRARIES } = useConfig();

  const handleModalToggle = () => {
    setIsAuthModalVisible((prev) => {
      if (prev) {
        setActivePanel(0);
      }
      return !prev;
    });
  };

  // Gate entry behind Google sign-in: if there's no valid session yet, open
  // the existing auth modal straight on its Google panel (panel 0) instead
  // of requiring the user to find and tap a login button first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasValidAuthToken()) {
      setActivePanel(0);
      setIsAuthModalVisible(true);
    }
    // Only ever run once on mount — the modal's own controls take over after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsScrolled(false);
    window.document.body.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 300 ? true : false);
    }

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    }
  }, [])

  const UI = immersive ? (
    <div className="flex h-dvh flex-col bg-dispatch-ground text-dispatch-ink dark:bg-gray-950 dark:text-white">
      <main className="min-h-0 flex-1 pb-[64px]">
        {children}
      </main>
      <BottomTabBar />
    </div>
  ) : (
    <div className="layout-main min-h-dvh bg-dispatch-ground text-dispatch-ink dark:bg-gray-950 dark:text-white">
      <div className={`
        layout-top-container transition-all duration-300 ease-out
        ${isScrolled ? '!fixed !top-0 left-0 shadow-dispatch' : ''}
      `}>
        <AppTopbar handleModalToggle={handleModalToggle} />
      </div>
      <div className={`layout-main-container ${isSearchFocused && 'blur-md overflow-hidden h-screen '}`}>
        <main className="layout-main min-h-screen w-full bg-dispatch-ground pb-[64px] dark:bg-gray-950 md:pb-0">
          <StripeOrderRecovery />
          {children}
        </main>
      </div>
      <div className="bg-dispatch-ink pb-[72px] md:pb-0">
        <AppFooter />
      </div>
      <AuthModal
        handleModalToggle={handleModalToggle}
        isAuthModalVisible={isAuthModalVisible}
      />
      <BottomTabBar />
    </div>
  );

  useEffect(() => { }, [GOOGLE_MAPS_KEY]);

  return GOOGLE_MAPS_KEY ?
    <GoogleMapsProvider apiKey={GOOGLE_MAPS_KEY} libraries={LIBRARIES}>
      <>{UI}</>
    </GoogleMapsProvider>
    : <>{UI}</>;
};

export default AppLayout;
