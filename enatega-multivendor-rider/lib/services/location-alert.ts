// Native (iOS/Android) passthrough — see location-alert.web.ts for why this
// local indirection exists. Native behavior (including the real "Open
// settings" deep link) is unchanged.
import { Alert, Linking } from 'react-native'

export function showLocationAccessAlert(): void {
  Alert.alert(
    'Location access',
    'Location permissions are required to use this app. Kindly open settings to allow location access.',
    [
      {
        text: 'Open settings',
        onPress: async () => {
          await Linking.openSettings()
        }
      }
    ]
  )
}

export function showPermissionCheckAlert(title: string, message: string): void {
  Alert.alert(title, message)
}
