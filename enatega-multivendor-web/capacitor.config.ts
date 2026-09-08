import type { CapacitorConfig } from "@capacitor/cli";

// The single ZeGo APK is a thin native shell around the live site — same
// 5-tab structure, same Profil hub, same Cloudflare-backed data. There is
// no separate bundled app content: the WebView loads the deployed site
// directly, so a site update ships instantly to every install with no
// separate app rebuild/redistribution.
const config: CapacitorConfig = {
  appId: "app.zego.delivery",
  appName: "ZeGo",
  webDir: "capacitor-shell",
  server: {
    url: "https://food-delivery-multivendor.hounmetinjeremy.workers.dev",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Only Google sign-in is wired up (login-with-google/index.tsx) — the
    // other providers stay disabled so their native SDKs aren't bundled.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
