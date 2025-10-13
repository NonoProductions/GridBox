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
      router.replace(full && String(full).trim().length > 0 ? "/app" : "/onboarding");
    })();
  }, [router]);

  return <p className="p-6">Login wird abgeschlossen …</p>;
}
