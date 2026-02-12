"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoginCard from "@/components/LoginCard";
import { usePageTheme } from "@/lib/usePageTheme";
import { logger } from "@/lib/logger";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  // returnUrl aus echter URL (useSearchParams kann beim ersten Paint noch leer sein)
  const returnUrl =
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnUrl") || "/app"
      : "/app") ||
    searchParams.get("returnUrl") ||
    "/app";
  const isFromRental = returnUrl.startsWith("/rent/");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Timer: 10 Min Reserve für Powerbank (nur bei Ausleihe)
  useEffect(() => {
    if (!isFromRental || typeof window === 'undefined') return;
    const KEY = 'rental_reservation_end';
    let endMs = parseInt(sessionStorage.getItem(KEY) || '0', 10);
    if (!endMs || endMs <= Date.now()) {
      endMs = Date.now() + 10 * 60 * 1000;
      sessionStorage.setItem(KEY, String(endMs));
    }
    const tick = () => {
      setTimeLeft(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isFromRental]);

  const theme = searchParams.get("theme");
  // Von Ausleihseite: Standardmäßig Dark Mode (sieht besser aus); später folgt die Seite den Einstellungen (localStorage).
  const isDarkMode = usePageTheme(searchParams, { defaultDark: isFromRental });

  useEffect(() => {
    if (returnUrl && returnUrl !== '/app') {
      try {
        const url = new URL(returnUrl, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
          localStorage.setItem('auth_return_url', url.pathname + url.search);
        }
      } catch {
        // Invalid URL, ignore
      }
    }
  }, [returnUrl]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          logger.error("Supabase not configured");
          setSupabaseConfigured(false);
          setIsLoading(false);
          return;
        }
        
        const timeoutId = setTimeout(() => {
          logger.warn("Session check timeout");
          setIsLoading(false);
        }, 5000);
        
        const { data, error } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error("Session check error:", String(error));
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          sessionStorage.removeItem('rental_reservation_end');
          router.replace(returnUrl);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        logger.error("Session check error:", String(error));
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        sessionStorage.removeItem('rental_reservation_end');
        router.replace(returnUrl);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, returnUrl]);

  if (isLoading) {
    return (
      <div 
        className={`fixed inset-0 flex items-center justify-center ${isDarkMode ? "bg-[#282828]" : "bg-white"}`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div 
        className={`fixed inset-0 flex items-center justify-center p-4 ${isDarkMode ? "bg-[#282828]" : "bg-white"}`}
      >
        <div className={`max-w-md p-8 rounded-2xl ${
          isDarkMode ? 'bg-white/5 text-white border border-white/10' : 'bg-white shadow-xl text-slate-900'
        }`}>
          <h2 className="text-xl font-semibold mb-2">Konfigurationsfehler</h2>
          <p className={`mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Supabase-Umgebungsvariablen sind nicht konfiguriert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed inset-0 flex items-start justify-center overflow-auto py-8 pt-16 ${isDarkMode ? "bg-[#282828] text-white" : "bg-white text-slate-900"}`}
    >
      {/* Back button */}
      <div className="absolute top-5 left-5 z-20">
        <button
          type="button"
          onClick={() => router.push(isFromRental ? returnUrl : `/${theme ? `?theme=${theme}` : ''}`)}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full transition-colors bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>
      
      {/* Login content */}
      <div className="relative z-10 w-full max-w-md px-5 flex flex-col items-center gap-6">
        {/* Step-Indikator 1 und 2 + Timer (nur bei Ausleihe) */}
        {isFromRental && (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-emerald-600 text-white">
                1
              </div>
              <div className={`w-8 h-0.5 mx-2 ${isDarkMode ? 'bg-white/20' : 'bg-slate-200'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isDarkMode ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-500'
              }`}>
                2
              </div>
            </div>
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                timeLeft === 0
                  ? (isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700')
                  : (isDarkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-800')
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {timeLeft === 0 ? (
                  <span>Reservierung abgelaufen</span>
                ) : (
                  <span>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')} Powerbank reserviert</span>
                )}
              </div>
            )}
          </div>
        )}
        
        <LoginCard isDarkMode={isDarkMode} isFromRental={isFromRental} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-[#282828]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
