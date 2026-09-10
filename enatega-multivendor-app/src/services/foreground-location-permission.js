// Native (iOS/Android) passthrough — see foreground-location-permission.web.js
// for why this local indirection exists. Native behavior is unchanged.
export {
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  useForegroundPermissions
} from 'expo-location'
