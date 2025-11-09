"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ThemeToggle from "@/components/ThemeToggle";

const HIDE_ON = new Set(["/", "/auth/callback", "/onboarding", "/profile", "/wallet", "/verlauf", "/hilfe", "/reservierung","/dashboard", "/app", "/login"]);

export default function AppHeader() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!pathname || HIDE_ON.has(pathname)) return null;

  return (
    <header className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900">
      <Link href="/" className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">GridBox</Link>
      <div className="ml-auto flex items-center gap-3">
        {!isAuthenticated && isAuthenticated !== null && (
          <Link 
            href="/login" 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Anmelden
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}


