"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_ROUTES = new Set(["/", "/auth/callback", "/onboarding", "/login"]);

// Check if route is public or starts with a public path
const isPublicRoute = (path: string): boolean => {
  if (PUBLIC_ROUTES.has(path)) return true;
  // Allow all /rent/* routes
  if (path.startsWith("/rent/")) return true;
  return false;
};

export default function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Prüfe Session nur einmal beim ersten Laden
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setIsAuthenticated(!!data.session);
          setHasChecked(true);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (isMounted) {
          setIsAuthenticated(false);
          setHasChecked(true);
        }
      }
    };

    checkAuth();

    // Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Redirect nur wenn nötig und Session geprüft wurde
  useEffect(() => {
    if (!pathname || !hasChecked || isAuthenticated === null) return;
    if (isPublicRoute(pathname)) return;

    // Nur redirecten wenn definitiv nicht authentifiziert
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [pathname, router, hasChecked, isAuthenticated]);

  return null;
}
