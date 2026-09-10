// Web shim for expo-location's getForegroundPermissionsAsync /
// requestForegroundPermissionsAsync / useForegroundPermissions. expo-location's
// own web implementation checks navigator.permissions.query({name:'geolocation'})
// first — Android WebView (especially for a cross-origin iframe, exactly how
// this app is embedded in the main ZeGo site) is known to report that query as
// "prompt" indefinitely even after the native permission was actually granted
// via the WebView's own geolocation callback, so this app's own "granted?"
// check never succeeds and the location screens never get past asking. Asking
// the browser for a real fix directly (skipping the Permissions API query)
// reads the true, current grant state instead. (Same fix already applied for
// the same reason in the rider app.)
import { createPermissionHook } from 'expo-modules-core'

function checkViaGetCurrentPosition() {
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

export async function getForegroundPermissionsAsync() {
  return checkViaGetCurrentPosition()
}

export async function requestForegroundPermissionsAsync() {
  return checkViaGetCurrentPosition()
}

export const useForegroundPermissions = createPermissionHook({
  getMethod: getForegroundPermissionsAsync,
  requestMethod: requestForegroundPermissionsAsync
})
