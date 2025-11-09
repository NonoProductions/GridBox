"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Session ist nach Magic-Link hier vorhanden
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/");
        return;
      }
      
      const { data: userData } = await supabase.auth.getUser();
      const full = (userData.user?.user_metadata as Record<string, unknown>)?.full_name;
      
      // Check if there's a return URL from before login
      const returnUrl = localStorage.getItem('auth_return_url');
      
      // If user doesn't have a name, go to onboarding first
      if (!full || String(full).trim().length === 0) {
        router.replace("/onboarding");
        return;
      }
      
      // If there's a return URL, go there and clear it
      if (returnUrl) {
        localStorage.removeItem('auth_return_url');
        router.replace(returnUrl);
        return;
      }
      
      // Otherwise, go to default app page
      router.replace("/app");
    })();
  }, [router]);

  return <p className="p-6">Login wird abgeschlossen …</p>;
}
