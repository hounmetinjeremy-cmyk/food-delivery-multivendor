import { useContext, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Href, useLocalSearchParams, useRouter } from "expo-router";

import { AuthContext } from "@/lib/context/global/auth.context";
import { useUserContext } from "@/lib/context/global/user.context";
import { useRiderMode } from "@/lib/context/global/rider-mode.context";
import { setSecureItem } from "@/lib/services/secure-storage";
import { ROUTES } from "@/lib/utils/constants";

// New entry point, not a modified screen: lets a rider already signed in on
// the ZeGo web app land here already authenticated (via a token minted by
// zego-api's riderSsoToken query) instead of typing a username/password a
// second time. Mirrors exactly what useLogin.ts's onLoginCompleted already
// does on a normal login — same calls, same order, same storage keys.
export default function SsoLanding() {
  const { token, userId } = useLocalSearchParams<{ token?: string; userId?: string }>();
  const router = useRouter();
  const { setTokenAsync } = useContext(AuthContext);
  const { setUserId } = useUserContext();
  const { riderIdKey } = useRiderMode();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !userId) {
      setError("Lien de connexion invalide.");
      return;
    }

    (async () => {
      try {
        await setTokenAsync(token);
        setUserId(userId);
        await setSecureItem(riderIdKey, userId);
        router.replace(ROUTES.home as Href);
      } catch {
        setError("Connexion impossible. Merci de réessayer depuis le site.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text>{error ?? "Connexion en cours…"}</Text>
    </View>
  );
}
