"use client";

import { Wallet } from "@/lib/ui/single-vendor/ProfileExtras";
import RiderWallet from "@/lib/ui/screen-components/protected/profile/rider-wallet";
import { getZegoApiUserRole } from "@/lib/zego-api/client";

export default function Page() {
  return getZegoApiUserRole() === "rider" ? <RiderWallet /> : <Wallet />;
}
