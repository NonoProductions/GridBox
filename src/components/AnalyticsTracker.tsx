"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Generate or retrieve a session ID
function getSessionId(): string {
  const key = "gridbox_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function trackPageView(path: string) {
  try {
    const sessionId = getSessionId();
    const token = await getAuthToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    await fetch("/api/analytics/track", {
      method: "POST",
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        path,
        referrer: document.referrer || null,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        language: navigator.language,
      }),
      // Use keepalive to ensure the request completes even if the page unloads
      keepalive: true,
    });
  } catch {
    // Analytics should never break the app
  }
}

async function trackDuration(path: string, durationSeconds: number) {
  if (durationSeconds < 1) return;
  try {
    const sessionId = getSessionId();
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "duration",
        session_id: sessionId,
        path,
        duration_seconds: Math.round(durationSeconds),
      }),
      keepalive: true,
    });
  } catch {
    // Silently fail
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const pageEnteredAt = useRef<number>(Date.now());
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    // Don't track admin/API paths
    if (pathname.startsWith("/api/")) return;

    // Avoid double-tracking the same path
    if (pathname === lastTrackedPath.current) return;

    // Send duration for previous page
    if (lastTrackedPath.current) {
      const duration = (Date.now() - pageEnteredAt.current) / 1000;
      trackDuration(lastTrackedPath.current, duration);
    }

    // Track new page view
    lastTrackedPath.current = pathname;
    pageEnteredAt.current = Date.now();
    trackPageView(pathname);
  }, [pathname]);

  // Track duration when user leaves
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && lastTrackedPath.current) {
        const duration = (Date.now() - pageEnteredAt.current) / 1000;
        trackDuration(lastTrackedPath.current, duration);
      }
    };

    const handleBeforeUnload = () => {
      if (lastTrackedPath.current) {
        const duration = (Date.now() - pageEnteredAt.current) / 1000;
        trackDuration(lastTrackedPath.current, duration);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return null;
}
