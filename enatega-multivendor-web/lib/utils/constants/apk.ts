// GPS + live tracking can't run reliably in a plain browser tab, so becoming
// a rider is gated to the native APK (see profile-tabs and
// profile-mode-switcher). Shared here so the "download" tab entry and that
// gate always point at the same build.
export const APK_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APK_URL ??
  "https://github.com/hounmetinjeremy-cmyk/food-delivery-multivendor/releases/download/apk-latest/zego.apk";
