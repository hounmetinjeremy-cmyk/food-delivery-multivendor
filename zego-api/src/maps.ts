const NOMINATIM_USER_AGENT = 'ZeGo-Delivery/1.0 (support@zego.app)'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  })

// Backs both the web app's own /api/maps/* proxy AND the admin app's
// useLocation hook (which calls `${SERVER_URL}/maps/reverse-geocode`
// directly against this Worker) — one free, no-billing-account geocoding
// implementation shared by every frontend instead of duplicating it.
export async function handleReverseGeocode(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get('latitude'))
  const longitude = Number(url.searchParams.get('longitude'))

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return json(
      {
        success: false,
        error: { code: 'REVERSE_GEOCODE_FAILED', message: 'Valid coordinates are required.' },
        data: null
      },
      400
    )
  }

  const target = new URL('https://nominatim.openstreetmap.org/reverse')
  target.searchParams.set('lat', String(latitude))
  target.searchParams.set('lon', String(longitude))
  target.searchParams.set('format', 'jsonv2')
  target.searchParams.set('addressdetails', '1')
  target.searchParams.set('accept-language', url.searchParams.get('language') || 'en')

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    })
    const payload = (await response.json()) as {
      display_name?: string
      error?: string
      address?: Record<string, string>
    }

    if (!response.ok || payload.error) {
      return json(
        {
          success: false,
          error: { code: 'REVERSE_GEOCODE_FAILED', message: payload.error ?? 'Unable to fetch address.' },
          data: null
        },
        502
      )
    }

    const address = payload.address ?? {}
    return json({
      success: true,
      error: null,
      data: {
        status: 'OK',
        errorMessage: null,
        formattedAddress: payload.display_name ?? null,
        city: address.city || address.town || address.village || address.municipality || address.county || null
      }
    })
  } catch (error) {
    return json(
      {
        success: false,
        error: {
          code: 'REVERSE_GEOCODE_FAILED',
          message: error instanceof Error ? error.message : 'Reverse geocoding failed.'
        },
        data: null
      },
      502
    )
  }
}

export async function handlePlaceSearch(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim()
  if (!query) return json({ success: true, data: [] })

  const target = new URL('https://nominatim.openstreetmap.org/search')
  target.searchParams.set('q', query)
  target.searchParams.set('format', 'jsonv2')
  target.searchParams.set('addressdetails', '0')
  target.searchParams.set('limit', '6')

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    })
    const results = (await response.json()) as Array<{
      place_id: number
      display_name: string
      lat: string
      lon: string
    }>

    const data = results.map((r) => {
      const [mainText, ...rest] = r.display_name.split(',')
      return {
        place_id: String(r.place_id),
        description: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon),
        structured_formatting: {
          main_text: mainText.trim(),
          secondary_text: rest.join(',').trim()
        }
      }
    })

    return json({ success: true, data })
  } catch (error) {
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed.', data: [] },
      502
    )
  }
}
