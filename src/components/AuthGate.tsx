"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_ROUTES = new Set(["/", "/auth/callback", "/onboarding", "/login", "/hilfe"]);

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
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Prüfe Session nur einmal beim ersten Laden
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const checkAuth = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth check timeout')), 10000);
        });

        const sessionPromise = supabase.auth.getSession();
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (isMounted) {
          setIsAuthenticated(!!data?.session);
          setHasChecked(true);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // On error, assume not authenticated for security
        if (isMounted) {
          setIsAuthenticated(false);
          setHasChecked(true);
        }
      }
    };

    checkAuth();

    // Auth State Listener with error handling
    try {
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) {
          setIsAuthenticated(!!session);
          // Update hasChecked when auth state changes
          if (!hasChecked) {
            setHasChecked(true);
          }
        }
      });
      subscription = authSubscription;
    } catch (error) {
      console.error("Error setting up auth listener:", error);
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [hasChecked]);

  // Redirect nur wenn nötig und Session geprüft wurde (with race condition prevention)
  useEffect(() => {
    if (!pathname || !hasChecked || isAuthenticated === null || isRedirecting) return;
    if (isPublicRoute(pathname)) return;

    // Nur redirecten wenn definitiv nicht authentifiziert (setState asynchron, um react-hooks/set-state-in-effect zu vermeiden)
    if (!isAuthenticated) {
      queueMicrotask(() => setIsRedirecting(true));
      router.replace("/login");
    }
  }, [pathname, router, hasChecked, isAuthenticated, isRedirecting]);

  return null;
}
