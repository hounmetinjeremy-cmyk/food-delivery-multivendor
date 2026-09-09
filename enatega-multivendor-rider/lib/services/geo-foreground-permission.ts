// Native (iOS/Android) passthrough — see geo-foreground-permission.web.ts for
// why this local indirection exists. Native behavior is unchanged.
export { getForegroundPermissionsAsync, requestForegroundPermissionsAsync } from 'expo-location'
