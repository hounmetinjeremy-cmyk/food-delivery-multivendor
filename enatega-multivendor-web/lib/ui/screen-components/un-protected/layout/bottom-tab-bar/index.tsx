"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faMotorcycle,
  faCommentDots,
  faWallet,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: faHouse, match: (p: string) => p === "/" },
  { href: "/rider", label: "Livreur", icon: faMotorcycle, match: (p: string) => p.startsWith("/rider") },
  { href: "/profile/customerTicket", label: "Messagerie", icon: faCommentDots, match: (p: string) => p.startsWith("/profile/customerTicket") },
  { href: "/profile/wallet", label: "Portefeuille", icon: faWallet, match: (p: string) => p.startsWith("/profile/wallet") },
  {
    href: "/profile",
    label: "Profil",
    icon: faUser,
    match: (p: string) =>
      p.startsWith("/profile") &&
      !p.startsWith("/profile/wallet") &&
      !p.startsWith("/profile/customerTicket"),
  },
];

export default function BottomTabBar() {
  const pathname = usePathname() || "/";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[64px] items-stretch border-t border-gray-200 bg-white md:hidden dark:border-gray-800 dark:bg-gray-950"
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${
              isActive
                ? "text-primary-color"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <FontAwesomeIcon icon={tab.icon} className="h-5 w-5" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
