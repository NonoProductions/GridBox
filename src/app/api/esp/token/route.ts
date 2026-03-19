import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { SignJWT } from "jose";

/**
 * POST /api/esp/token
 * Generates a short-lived Supabase-compatible JWT for Realtime WebSocket.
 * The ESP32 uses this token ONLY for the WebSocket connection URL.
 * Token expires after 10 minutes → ESP32 must refresh before expiry.
 *
 * Replaces: hardcoded SUPABASE_KEY in WebSocket URL on ESP32.
 */
export async function POST(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!jwtSecret || !supabaseUrl) {
    console.error("Missing required server configuration for token endpoint");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Extract project ref from Supabase URL (e.g., "igrsoizvjyniuefyzzro" from https://igrsoizvjyniuefyzzro.supabase.co)
  const refMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase/);
  if (!refMatch) {
    console.error("Cannot extract project ref from SUPABASE_URL");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }
  const projectRef = refMatch[1];

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 600; // 10 minutes

    // Create a Supabase-compatible JWT with anon role
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      iss: "supabase",
      ref: projectRef,
      role: "anon",
      iat: now,
      exp: now + expiresIn,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secret);

    return NextResponse.json({
      token,
      expires_at: now + expiresIn,
      supabase_host: `${projectRef}.supabase.co`,
    });
  } catch (err) {
    console.error("JWT signing error");
    return NextResponse.json(
      { error: "Token generation failed" },
      { status: 500 }
    );
  }
}
