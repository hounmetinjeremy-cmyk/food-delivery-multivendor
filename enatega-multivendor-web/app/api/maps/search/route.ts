import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_USER_AGENT = "ZeGo-Delivery/1.0 (support@zego.app)";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Free replacement for Google Places Autocomplete, backed by OpenStreetMap's
// Nominatim search — no API key or billing account required. Proxied
// server-side per Nominatim's usage policy (identifying User-Agent, no
// direct heavy client-side use).
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ success: true, data: [] });
  }

  const target = new URL("https://nominatim.openstreetmap.org/search");
  target.searchParams.set("q", query);
  target.searchParams.set("format", "jsonv2");
  target.searchParams.set("addressdetails", "0");
  target.searchParams.set("limit", "6");

  try {
    const response = await fetch(target, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const results = (await response.json()) as NominatimResult[];

    const data = results.map((r) => {
      const [mainText, ...rest] = r.display_name.split(",");
      return {
        place_id: String(r.place_id),
        description: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon),
        structured_formatting: {
          main_text: mainText.trim(),
          secondary_text: rest.join(",").trim(),
        },
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Search failed.",
        data: [],
      },
      { status: 502 },
    );
  }
}
