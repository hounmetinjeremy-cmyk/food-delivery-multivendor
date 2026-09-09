// Web shim for secure-storage.ts (expo-secure-store has no web target, and
// the native file deliberately refuses to fall back to plain storage in
// production — by design, since a real device's SecureStore should always
// be available there). On web, localStorage is the normal, expected place
// for a JWT — the same approach the ZeGo web app already uses for its own
// session token — so this mirrors that instead of throwing.
export const getSecureItem = async (
  key: string,
  legacyKey = key,
): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey);
};

export const setSecureItem = async (
  key: string,
  value: string,
): Promise<void> => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

export const removeSecureItem = async (
  key: string,
  legacyKey = key,
): Promise<void> => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  window.localStorage.removeItem(legacyKey);
};
