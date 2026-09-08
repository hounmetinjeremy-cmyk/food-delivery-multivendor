export interface GoogleTokenInfo {
  sub: string
  email?: string
  email_verified?: string
  name?: string
  picture?: string
  aud: string
}

export async function verifyGoogleIdToken(
  idToken: string,
  allowedClientIds: string
): Promise<GoogleTokenInfo> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  )
  if (!response.ok) {
    throw new Error('Invalid Google token')
  }
  const payload = (await response.json()) as GoogleTokenInfo
  const allowed = allowedClientIds.split(',').map((id) => id.trim())
  if (!allowed.includes(payload.aud)) {
    throw new Error('Invalid Google token audience')
  }
  if (!payload.email || payload.email_verified !== 'true') {
    throw new Error('Google account has no verified email')
  }
  return payload
}
