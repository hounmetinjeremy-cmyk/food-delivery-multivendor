// Web shim for location-alert.ts — react-native-web's Alert.alert is a
// deliberate no-op (`static alert() {}`), so on web the native version of
// this file would silently show nothing at all when location access is
// denied, leaving the "Continue" primer stuck with no visible next step.
// There's also no native Settings screen to deep-link to from a web page,
// so this just tells the person what to do instead of offering a button
// that couldn't work anyway.
export function showLocationAccessAlert(): void {
  if (typeof window === 'undefined') return
  window.alert(
    "Location permissions are required to use this app. Please enable location access for this app in your phone's Settings, then reopen the app."
  )
}

export function showPermissionCheckAlert(title: string, message: string): void {
  if (typeof window === 'undefined') return
  window.alert(`${title}\n\n${message}`)
}
