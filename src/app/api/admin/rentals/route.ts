import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In-memory rate limiting with periodic cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RL_MAX_ENTRIES = 500;
let lastCleanup = Date.now();
function checkRateLimit(id: string): boolean {
  const now = Date.now();
  if (now - lastCleanup > 300_000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
    lastCleanup = now;
  }
  if (rateLimitMap.size >= RL_MAX_ENTRIES && !rateLimitMap.has(id)) return false;
  const r = rateLimitMap.get(id);
  if (!r || now > r.resetTime) {
    rateLimitMap.set(id, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (r.count >= 30) return false;
  r.count++;
  return true;
}

function extractToken(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || !/^[A-Za-z0-9._-]+$/.test(token)) return null;
  // Validate JWT structure: must have 3 dot-separated parts
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  return token;
}

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ message: "Service configuration error" }, { status: 500 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ message: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
    }

    const token = extractToken(
      request.headers.get("authorization") || request.headers.get("Authorization")
    );
    if (!token) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify user and role
    const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ message: "Authentication failed" }, { status: 401 });
    }

    const { data: roleData, error: roleError } = await supabaseServer
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (roleError || !roleData || roleData.role !== "owner") {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });
    }

    // Fetch only stations owned by the authenticated user
    const { data: stations, error: stationsError } = await supabaseServer
      .from("stations")
      .select("id")
      .eq("owner_id", userData.user.id);

    if (stationsError) {
      return NextResponse.json({ message: "Failed to load stations" }, { status: 500 });
    }

    const stationIds = (stations || []).map((s: { id: string }) => s.id).filter(Boolean);

    if (stationIds.length === 0) {
      return NextResponse.json({ rentals: [], total: 0 });
    }

    // Parse query params for server-side pagination
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(10, parseInt(searchParams.get("limit") || "200", 10)));

    // Fetch rentals with service role (bypasses RLS)
    const { data: rentals, error: rentalsError, count } = await supabaseServer
      .from("rentals")
      .select("id, station_id, user_id, amount_cents, start_price, price_per_minute, duration_minutes, started_at, ended_at, status, powerbank_id, created_at", { count: "exact" })
      .in("station_id", stationIds)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (rentalsError) {
      console.error("Rentals query error:", rentalsError.message);
      return NextResponse.json({ message: "Failed to load rentals" }, { status: 500 });
    }

    // Map amount_cents to total_price (in euros) for frontend compatibility
    const mapped = (rentals || []).map((r: any) => ({
      id: r.id,
      station_id: r.station_id,
      user_id: r.user_id,
      total_price: r.amount_cents != null ? r.amount_cents / 100 : null,
      started_at: r.started_at,
      ended_at: r.ended_at,
      status: r.status,
      powerbank_id: r.powerbank_id ?? null,
      created_at: r.created_at,
    }));

    return NextResponse.json({
      rentals: mapped,
      total: count ?? mapped.length,
    });
  } catch (err) {
    console.error("Unexpected error in admin/rentals");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
