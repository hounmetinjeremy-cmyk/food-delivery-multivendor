import * as Location from 'expo-location'
// Routed through a local wrapper (not "expo-location" directly) so Metro's
// platform resolution can swap in a web-safe permission check — see
// src/services/foreground-location-permission.web.js for why. Native
// behavior and this hook's own logic are unchanged.
import {
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync
} from '../../services/foreground-location-permission'
import { getLocationFromStorage } from './useWatchLocation'

export default function useLocation() {
  const getLocationPermission = async() => {
    const {
      status,
      canAskAgain
    } = await getForegroundPermissionsAsync()
    return { status, canAskAgain }
  }

  const askLocationPermission = async() => {
    let finalStatus = null
    let finalCanAskAgain = null
    const {
      status: currentStatus,
      canAskAgain: currentCanAskAgain
    } = await getForegroundPermissionsAsync()
    finalStatus = currentStatus === 'granted' ? 'granted' : 'denied'
    finalCanAskAgain = currentCanAskAgain
    if (currentStatus === 'granted') {
      return { status: finalStatus, canAskAgain: finalCanAskAgain }
    }
    if (currentCanAskAgain) {
      const {
        status,
        canAskAgain
      } = await requestForegroundPermissionsAsync()
      finalStatus = status === 'granted' ? 'granted' : 'denied'
      finalCanAskAgain = canAskAgain
      if (status === 'granted') {
        return { status: finalStatus, canAskAgain: finalCanAskAgain }
      }
    }
    return { status: finalStatus, canAskAgain: finalCanAskAgain }
  }

  const getCurrentLocation = async({ preferStored = true } = {}) => {
    const location = preferStored ? await getLocationFromStorage() : null
    if (location) return { coords: location }
    const { status } = await askLocationPermission()

    if (status === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({
          enableHighAccuracy: true
        })
        return { ...location, error: false }
      } catch (e) {
        console.log('location error', e)
        return { error: true, message: e.message }
      }
    }
    return { error: true, message: 'Location permission was not granted' }
  }

  return { getCurrentLocation, getLocationPermission }
}
