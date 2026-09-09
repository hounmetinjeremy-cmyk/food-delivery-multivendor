const ZEGO_API_URL =
  process.env.NEXT_PUBLIC_ZEGO_API_URL ??
  'https://zego-api.hounmetinjeremy.workers.dev/graphql'

const TOKEN_STORAGE_KEY = 'zegoApiToken'

export function getZegoApiToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setZegoApiToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearZegoApiToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function decodeTokenPayload(token: string): { sub?: string; role?: string } | null {
  const payloadSegment = token.split('.')[1]
  if (!payloadSegment) return null
  try {
    const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return JSON.parse(atob(padded + pad)) as { sub?: string; role?: string }
  } catch {
    return null
  }
}

/** Reads the `sub` claim out of the stored session token, for telling
 * "sent by me" apart in a conversation. The server independently verifies
 * the token's signature on every request, so this is UI-only. */
export function getZegoApiUserId(): string | null {
  const token = getZegoApiToken()
  if (!token) return null
  return decodeTokenPayload(token)?.sub ?? null
}

/** Reads the `role` claim out of the stored session token — used to decide
 * which Profile sections (vendor dashboard, rider dashboard) to show. This
 * updates the moment a fresh token is stored (e.g. right after becoming a
 * rider), unlike the primary login profile which only reflects the role at
 * the time of the original sign-in. UI-only: the server independently
 * checks the role on every request. */
export function getZegoApiUserRole(): string | null {
  const token = getZegoApiToken()
  if (!token) return null
  return decodeTokenPayload(token)?.role ?? null
}

export class ZegoApiError extends Error {}

export async function zegoApiFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = getZegoApiToken()
  const response = await fetch(ZEGO_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  })
  const json = (await response.json()) as {
    data?: T
    errors?: { message: string }[]
  }
  if (json.errors?.length) {
    throw new ZegoApiError(json.errors[0].message)
  }
  return json.data as T
}
