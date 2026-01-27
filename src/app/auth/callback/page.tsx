"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth callback timeout')), 10000);
        });

        const sessionPromise = supabase.auth.getSession();
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (!isMounted) return;
        
        if (!data?.session) {
          router.replace("/");
          return;
        }
        
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error('Error getting user:', userError);
          router.replace("/");
          return;
        }
        
        // Safely extract full_name from metadata
        const metadata = userData.user.user_metadata as Record<string, unknown> | null;
        const full = metadata?.full_name;
        const fullName = typeof full === 'string' ? full.trim() : '';
        
        // Check if there's a return URL from before login (validate it)
        const returnUrl = localStorage.getItem('auth_return_url');
        let safeReturnUrl: string | null = null;
        
        if (returnUrl) {
          // Validate return URL to prevent open redirect
          try {
            const url = new URL(returnUrl, window.location.origin);
            // Only allow same-origin URLs
            if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
              safeReturnUrl = url.pathname + url.search;
            }
          } catch {
            // Invalid URL, ignore
          }
          localStorage.removeItem('auth_return_url');
        }
        
        // If user doesn't have a name, go to onboarding first
        if (!fullName || fullName.length === 0) {
          router.replace("/onboarding");
          return;
        }
        
        // If there's a safe return URL, go there
        if (safeReturnUrl) {
          router.replace(safeReturnUrl);
          return;
        }
        
        // Otherwise, go to default app page
        router.replace("/app");
      } catch (error) {
        console.error('Error in auth callback:', error);
        if (isMounted) {
          router.replace("/");
        }
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, [router]);

  return <p className="p-6">Login wird abgeschlossen …</p>;
}
