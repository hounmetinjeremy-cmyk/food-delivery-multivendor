import type { AppMode } from "@/lib/mode";

interface IReverseGeocodeResponse {
  success: boolean;
  error: { code: string; message: string } | null;
  data: {
    status: string;
    errorMessage: string | null;
    formattedAddress: string | null;
    city: string | null;
  } | null;
}

export interface IPlaceSearchResult {
  place_id: string;
  description: string;
  lat: number;
  lon: number;
  structured_formatting: { main_text: string; secondary_text: string };
}

export async function searchPlaces(query: string): Promise<IPlaceSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/maps/search?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  const payload = (await response.json()) as {
    success: boolean;
    data: IPlaceSearchResult[];
  };
  if (!response.ok || !payload.success) return [];
  return payload.data;
}

export async function reverseGeocode({
  mode,
  latitude,
  longitude,
}: {
  mode: AppMode;
  latitude: number;
  longitude: number;
}) {
  const params = new URLSearchParams({
    mode,
    latitude: String(latitude),
    longitude: String(longitude),
    language: "en",
  });
  const response = await fetch(`/api/maps/reverse-geocode?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  const payload = (await response.json()) as IReverseGeocodeResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message || "Unable to fetch address.");
  }

  return payload.data;
}
