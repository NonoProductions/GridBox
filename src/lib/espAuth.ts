import { NextResponse } from "next/server";
import { createSupabaseServer } from "./supabaseServer";

// Rate limiting: in-memory store per station key
const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute (ESP32 polls every ~5s + battery updates)

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

export interface AuthenticatedStation {
  id: string;
  short_code: string | null;
  name: string | null;
}

/**
 * Authenticate an ESP32 request via the X-Station-Key header.
 * Returns the station record on success, or a NextResponse error.
 */
export async function authenticateStation(
  request: Request
): Promise<AuthenticatedStation | NextResponse> {
  const stationKey =
    request.headers.get("x-station-key") ||
    request.headers.get("X-Station-Key");

  if (!stationKey || stationKey.length < 16) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Basic format validation (hex string)
  if (!/^[a-f0-9]+$/i.test(stationKey)) {
    return NextResponse.json(
      { error: "Invalid key format" },
      { status: 401 }
    );
  }

  // Rate limit per station key
  if (!checkRateLimit(stationKey)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const supabase = createSupabaseServer();

    const { data, error } = await supabase
      .from("stations")
      .select("id, short_code, name")
      .eq("device_api_key", stationKey)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    return data as AuthenticatedStation;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Type guard: check if authenticateStation returned an error response.
 */
export function isAuthError(
  result: AuthenticatedStation | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
