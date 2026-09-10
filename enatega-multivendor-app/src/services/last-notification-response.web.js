// Web shim for expo-notifications' useLastNotificationResponse — its web
// implementation calls straight into a native module method
// (getLastNotificationResponseAsync) that isn't implemented on web at all,
// throwing during render and taking down the whole screen (there is no web
// equivalent of "the OS cold-started the app because of a tapped push
// notification" to report anyway). Always reporting "no response" is exactly
// the resting/no-op state the real hook itself starts from.
export function useLastNotificationResponse() {
  return null
}
