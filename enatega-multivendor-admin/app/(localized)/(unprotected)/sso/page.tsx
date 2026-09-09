"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthTokens } from "@/lib/utils/methods/auth";
import { useUserContext } from "@/lib/hooks/useUser";

// Entry point for the "instant vendor" flow: a customer who just self-
// registered as a vendor from the main site (already signed in with
// Google there) lands here with a short-lived zego-api token in the URL
// instead of the admin app's own email/password sign-in. Seeds that token
// into this app's own storage, lets the existing session-bootstrap logic
// (UserContext's refreshUserSession, which already calls ownerSession and
// persists a real admin session) take over, then continues to the
// dashboard — no separate admin login screen shown.
function SsoLanding() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUserSession } = useUserContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Lien de connexion invalide.");
      return;
    }
    setAuthTokens({ token });
    refreshUserSession(null).then((user) => {
      if (user) {
        router.replace("/admin/store/dashboard");
      } else {
        setError("Connexion impossible. Merci de réessayer depuis le site.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {error ?? "Connexion en cours…"}
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={null}>
      <SsoLanding />
    </Suspense>
  );
}
