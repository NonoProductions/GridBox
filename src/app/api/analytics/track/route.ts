import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting: 60 requests/minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RL_MAX_ENTRIES = 1000;
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
  if (r.count >= 60) return false;
  r.count++;
  return true;
}

// Parse user agent into browser and OS
function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = "Unbekannt";
  let os = "Unbekannt";

  // Browser detection
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Chrome/") && ua.includes("Safari/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  // OS detection
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

// Determine device type from screen width
function getDeviceType(width: number | undefined): string {
  if (!width) return "unbekannt";
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

// Sanitize string input
function sanitize(val: unknown, maxLen = 500): string | null {
  if (typeof val !== "string") return null;
  return val.slice(0, maxLen).replace(/[<>]/g, "");
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await request.json();
    const {
      session_id,
      path,
      referrer,
      screen_width,
      screen_height,
      language,
      duration_seconds,
      type,
    } = body;

    // Validate required fields
    const sessionId = sanitize(session_id, 100);
    const pagePath = sanitize(path, 500);

    if (!sessionId || !pagePath) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Duration update (when user leaves page)
    if (type === "duration") {
      const dur = typeof duration_seconds === "number" ? Math.min(Math.max(0, Math.round(duration_seconds)), 86400) : 0;
      if (dur > 0) {
        await supabaseServer.rpc("update_page_view_duration", {
          p_session_id: sessionId,
          p_path: pagePath,
          p_duration: dur,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Parse UTM params from referrer or path
    let utmSource: string | null = null;
    let utmMedium: string | null = null;
    let utmCampaign: string | null = null;

    try {
      const refUrl = referrer ? new URL(referrer) : null;
      if (refUrl) {
        utmSource = refUrl.searchParams.get("utm_source");
        utmMedium = refUrl.searchParams.get("utm_medium");
        utmCampaign = refUrl.searchParams.get("utm_campaign");
      }
    } catch {
      // Invalid referrer URL - ignore
    }

    const ua = request.headers.get("user-agent") || "";
    const { browser, os } = parseUserAgent(ua);
    const deviceType = getDeviceType(typeof screen_width === "number" ? screen_width : undefined);

    // Try to get user_id from auth header (optional)
    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token && /^[A-Za-z0-9._-]+$/.test(token)) {
        try {
          const { data } = await supabaseServer.auth.getUser(token);
          userId = data?.user?.id || null;
        } catch {
          // Invalid token - continue without user_id
        }
      }
    }

    // Get country from headers (set by Vercel/Cloudflare)
    const country =
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      null;

    const { error } = await supabaseServer.from("page_views").insert({
      session_id: sessionId,
      user_id: userId,
      path: pagePath,
      referrer: sanitize(referrer, 2000),
      utm_source: sanitize(utmSource, 200),
      utm_medium: sanitize(utmMedium, 200),
      utm_campaign: sanitize(utmCampaign, 200),
      device_type: deviceType,
      browser,
      os,
      screen_width: typeof screen_width === "number" ? Math.min(screen_width, 10000) : null,
      screen_height: typeof screen_height === "number" ? Math.min(screen_height, 10000) : null,
      language: sanitize(language, 10),
      country,
      duration_seconds: 0,
    });

    if (error) {
      console.error("Analytics track error:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
