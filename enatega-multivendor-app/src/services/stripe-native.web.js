// Web shim for stripe-native.js — @stripe/stripe-react-native is a native-only
// SDK (it has no web build at all, unlike react-native-maps which at least
// ships a broken web stub) and is only ever reached from the single-vendor
// "Membership" card-payment screen, which is disabled by default in
// production (see src/mode/constants.js — EXPO_PUBLIC_VENDOR_MODE defaults
// multivendor apps to MULTI, and single-vendor stays off unless explicitly
// toggled). So instead of pulling in the full Stripe.js Elements web SDK for
// a screen that isn't reachable here, this keeps the same three exports with
// safe no-op behavior, matching the real SDK's return/prop shapes so the
// unchanged business logic in useMembership.js and CardModal.js doesn't
// crash if that screen is ever reached on web.
import React from 'react'
import { Text, View } from 'react-native'

export function StripeProvider({ children }) {
  return children
}

export function useStripe() {
  return {
    createPaymentMethod: async() => ({
      paymentMethod: null,
      error: {
        code: 'Unavailable',
        message: 'Card payments are not available on web. Please use the mobile app.',
        localizedMessage: 'Card payments are not available on web. Please use the mobile app.'
      }
    })
  }
}

export function CardField({ style }) {
  return (
    <View style={[{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#efefef' }, style]}>
      <Text>Card payments are not available on web. Please use the mobile app.</Text>
    </View>
  )
}
