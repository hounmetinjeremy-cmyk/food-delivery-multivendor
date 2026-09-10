import { useContext, useEffect } from 'react'
import { Platform } from 'react-native'
import AuthContext from '../../context/Auth'

// Web-only entry point for a customer already signed in on the ZeGo web app:
// consumes a one-time hand-off token (minted by zego-api's customerSsoToken
// query) from the URL so they land here already authenticated instead of
// typing a password a second time inside the iframe. Native builds never see
// this URL shape, so this is a no-op there. Mirrors exactly what a normal
// login already does — same setTokenAsync call, same AuthContext — nothing
// about the login flow itself is changed.
export default function SsoBootstrap() {
  const { setTokenAsync } = useContext(AuthContext)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('ssoToken')
    if (!token) return

    params.delete('ssoToken')
    const nextSearch = params.toString()
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (nextSearch ? `?${nextSearch}` : '')
    )

    setTokenAsync(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
