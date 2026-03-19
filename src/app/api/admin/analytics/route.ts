import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanup = Date.now();

function checkRateLimit(id: string): boolean {
  const now = Date.now();
  if (now - lastCleanup > 300_000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
    lastCleanup = now;
  }
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
      return NextResponse.json({ message: "Too many requests" }, { status: 429 });
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

    // Verify user is owner
    const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ message: "Authentication failed" }, { status: 401 });
    }

    const { data: roleData } = await supabaseServer
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!roleData || roleData.role !== "owner") {
      return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 });
    }

    // Parse time range
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Fetch all page views in the time range
    const { data: pageViews, error: pvError } = await supabaseServer
      .from("page_views")
      .select("*")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true });

    if (pvError) {
      console.error("Analytics fetch error:", pvError.message);
      return NextResponse.json({ message: "Failed to load analytics" }, { status: 500 });
    }

    const views = pageViews || [];

    // === Aggregate data ===

    // Total page views
    const totalPageViews = views.length;

    // Unique sessions
    const uniqueSessions = new Set(views.map((v: any) => v.session_id)).size;

    // Unique users (logged in)
    const loggedInViews = views.filter((v: any) => v.user_id);
    const uniqueUsers = new Set(loggedInViews.map((v: any) => v.user_id)).size;

    // Average duration
    const viewsWithDuration = views.filter((v: any) => v.duration_seconds > 0);
    const avgDuration =
      viewsWithDuration.length > 0
        ? Math.round(viewsWithDuration.reduce((sum: number, v: any) => sum + v.duration_seconds, 0) / viewsWithDuration.length)
        : 0;

    // Bounce rate (sessions with only 1 page view)
    const sessionPageCounts = new Map<string, number>();
    for (const v of views) {
      sessionPageCounts.set(v.session_id, (sessionPageCounts.get(v.session_id) || 0) + 1);
    }
    const bounceSessions = [...sessionPageCounts.values()].filter((c) => c === 1).length;
    const bounceRate = uniqueSessions > 0 ? Math.round((bounceSessions / uniqueSessions) * 100) : 0;

    // Views per day (for chart)
    const viewsByDay = new Map<string, number>();
    const sessionsByDay = new Map<string, Set<string>>();
    for (const v of views) {
      const day = new Date(v.created_at).toISOString().split("T")[0];
      viewsByDay.set(day, (viewsByDay.get(day) || 0) + 1);
      if (!sessionsByDay.has(day)) sessionsByDay.set(day, new Set());
      sessionsByDay.get(day)!.add(v.session_id);
    }

    // Fill in missing days
    const dailyData: Array<{ date: string; views: number; visitors: number }> = [];
    const current = new Date(since);
    const today = new Date();
    while (current <= today) {
      const dayStr = current.toISOString().split("T")[0];
      dailyData.push({
        date: dayStr,
        views: viewsByDay.get(dayStr) || 0,
        visitors: sessionsByDay.get(dayStr)?.size || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    // Top pages
    const pageCounts = new Map<string, number>();
    const pageDurations = new Map<string, { total: number; count: number }>();
    for (const v of views) {
      pageCounts.set(v.path, (pageCounts.get(v.path) || 0) + 1);
      if (v.duration_seconds > 0) {
        const existing = pageDurations.get(v.path) || { total: 0, count: 0 };
        existing.total += v.duration_seconds;
        existing.count += 1;
        pageDurations.set(v.path, existing);
      }
    }
    const topPages = [...pageCounts.entries()]
      .map(([path, count]) => {
        const dur = pageDurations.get(path);
        return {
          path,
          views: count,
          avgDuration: dur ? Math.round(dur.total / dur.count) : 0,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Referrers
    const refCounts = new Map<string, number>();
    for (const v of views) {
      if (v.referrer) {
        try {
          const hostname = new URL(v.referrer).hostname || v.referrer;
          refCounts.set(hostname, (refCounts.get(hostname) || 0) + 1);
        } catch {
          refCounts.set(v.referrer, (refCounts.get(v.referrer) || 0) + 1);
        }
      }
    }
    const topReferrers = [...refCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Devices
    const deviceCounts = new Map<string, number>();
    for (const v of views) {
      const type = v.device_type || "unbekannt";
      deviceCounts.set(type, (deviceCounts.get(type) || 0) + 1);
    }
    const devices = [...deviceCounts.entries()]
      .map(([type, count]) => ({ type, count, percentage: Math.round((count / totalPageViews) * 100) }))
      .sort((a, b) => b.count - a.count);

    // Browsers
    const browserCounts = new Map<string, number>();
    for (const v of views) {
      const b = v.browser || "Unbekannt";
      browserCounts.set(b, (browserCounts.get(b) || 0) + 1);
    }
    const browsers = [...browserCounts.entries()]
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / totalPageViews) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Operating Systems
    const osCounts = new Map<string, number>();
    for (const v of views) {
      const o = v.os || "Unbekannt";
      osCounts.set(o, (osCounts.get(o) || 0) + 1);
    }
    const operatingSystems = [...osCounts.entries()]
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / totalPageViews) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Countries
    const countryCounts = new Map<string, number>();
    for (const v of views) {
      const c = v.country || "Unbekannt";
      countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    }
    const countries = [...countryCounts.entries()]
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / totalPageViews) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Hourly distribution (for heatmap-style chart)
    const hourlyViews = new Array(24).fill(0);
    for (const v of views) {
      const hour = new Date(v.created_at).getHours();
      hourlyViews[hour]++;
    }
    const hourlyData = hourlyViews.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      views: count,
    }));

    return NextResponse.json({
      summary: {
        totalPageViews,
        uniqueSessions,
        uniqueUsers,
        avgDuration,
        bounceRate,
        days,
      },
      dailyData,
      topPages,
      topReferrers,
      devices,
      browsers,
      operatingSystems,
      countries,
      hourlyData,
    });
  } catch (err) {
    console.error("Unexpected error in admin/analytics");
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
