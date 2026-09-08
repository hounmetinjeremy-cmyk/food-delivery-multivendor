import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_USER_AGENT = "ZeGo-Delivery/1.0 (support@zego.app)";

const errorResponse = (message: string, status: number) =>
  NextResponse.json(
    { success: false, error: { code: "REVERSE_GEOCODE_FAILED", message }, data: null },
    { status },
  );

// Uses OpenStreetMap's free Nominatim reverse-geocoding service instead of
// Google's (which requires a billing-enabled account) — no API key needed.
export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("latitude"));
  const longitude = Number(request.nextUrl.searchParams.get("longitude"));

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return errorResponse("Valid coordinates are required.", 400);
  }

  const target = new URL("https://nominatim.openstreetmap.org/reverse");
  target.searchParams.set("lat", String(latitude));
  target.searchParams.set("lon", String(longitude));
  target.searchParams.set("format", "jsonv2");
  target.searchParams.set("addressdetails", "1");
  target.searchParams.set(
    "accept-language",
    request.nextUrl.searchParams.get("language") || "en",
  );

  try {
    const response = await fetch(target, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok || payload.error) {
      return errorResponse(
        typeof payload.error === "string" ? payload.error : "Unable to fetch address.",
        502,
      );
    }

    const address = payload.address || {};
    return NextResponse.json({
      success: true,
      error: null,
      data: {
        status: "OK",
        errorMessage: null,
        formattedAddress: payload.display_name || null,
        city:
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          null,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Reverse geocoding failed.",
      502,
    );
  }
}
