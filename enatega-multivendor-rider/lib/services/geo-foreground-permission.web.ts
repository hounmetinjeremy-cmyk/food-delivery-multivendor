// Web shim for expo-location's getForegroundPermissionsAsync /
// requestForegroundPermissionsAsync — only the "Location access for
// deliveries" primer screen uses these two. expo-location's own web
// implementation checks navigator.permissions.query({name:'geolocation'})
// first; Android WebView (especially for a cross-origin iframe, which is
// exactly how the rider space is embedded here) is known to report that
// query as "prompt" indefinitely even after the native permission was
// actually granted via the WebView's own geolocation callback — so the
// app's own logic never sees "granted" and the primer never dismisses.
// Asking the browser for a real fix directly (skipping the Permissions API
// query) reads the true, current state instead.
type ForegroundPermissionResult = {
  status: 'granted' | 'denied' | 'undetermined'
  granted: boolean
  canAskAgain: boolean
  expires: 0
}

function checkViaGetCurrentPosition(): Promise<ForegroundPermissionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ status: 'undetermined', granted: false, canAskAgain: true, expires: 0 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ status: 'granted', granted: true, canAskAgain: true, expires: 0 }),
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED
        resolve({
          status: denied ? 'denied' : 'undetermined',
          granted: false,
          canAskAgain: true,
          expires: 0
        })
      },
      { timeout: 15000, maximumAge: 60000 }
    )
  })
}

export async function getForegroundPermissionsAsync(): Promise<ForegroundPermissionResult> {
  return checkViaGetCurrentPosition()
}

export async function requestForegroundPermissionsAsync(): Promise<ForegroundPermissionResult> {
  return checkViaGetCurrentPosition()
}
