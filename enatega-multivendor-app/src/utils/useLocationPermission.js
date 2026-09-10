import { useCallback, useState } from 'react'
import * as Location from 'expo-location'
// Same reasoning, for the same reason: expo-location's web permission check
// is unreliable in an Android WebView cross-origin iframe — see
// src/services/foreground-location-permission.web.js.
import { requestForegroundPermissionsAsync } from '../services/foreground-location-permission'

const useLocationPermission = () => {
  const [isLoading, setIsLoading] = useState(false)

  const requestPermission = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await requestForegroundPermissionsAsync()
      return {
        canAskAgain: result.canAskAgain ?? true,
        granted: result.status === Location.PermissionStatus.GRANTED,
        status: result.status
      }
    } catch (error) {
      return {
        canAskAgain: false,
        error: error?.message,
        granted: false,
        status: 'error'
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, requestPermission }
}

export default useLocationPermission

