// Native (iOS/Android) passthrough — order-details imports the map from this
// local module instead of "react-native-maps" directly so Metro's platform
// resolution can swap in a Leaflet-based implementation for the web export
// (react-native-maps has no web target). Native behavior is unchanged.
export { default, Marker, PROVIDER_DEFAULT } from "react-native-maps";
export type { LatLng, MapStyleElement } from "react-native-maps";
