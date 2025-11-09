"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoginCard from "@/components/LoginCard";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  // Get return URL from query params
  const returnUrl = searchParams.get('returnUrl') || '/app';

  // Save returnUrl to localStorage so auth callback can use it
  useEffect(() => {
    if (returnUrl && returnUrl !== '/app') {
      localStorage.setItem('auth_return_url', returnUrl);
    }
  }, [returnUrl]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if Supabase is properly configured
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error("⚠️ Supabase not configured - please add environment variables to Vercel");
          console.error("Missing variables:");
          console.error("- NEXT_PUBLIC_SUPABASE_URL");
          console.error("- NEXT_PUBLIC_SUPABASE_ANON_KEY");
          setSupabaseConfigured(false);
          setIsLoading(false);
          return;
        }
        
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.warn("⏱️ Session check timeout - continuing anyway");
          setIsLoading(false);
        }, 5000); // 5 seconds timeout
        
        const { data, error } = await supabase.auth.getSession();
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error("Session check error:", error);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          // Benutzer ist eingeloggt, leite zur gewünschten Seite weiter
          router.replace(returnUrl);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Session check error:", error);
        setIsLoading(false);
      }
    };

    checkSession();

    // Auth State Listener - bei Login automatisch zur gewünschten Seite weiterleiten
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace(returnUrl);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, returnUrl]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <div className="text-slate-600 dark:text-slate-400 font-medium">Lädt...</div>
        </div>
      </div>
    );
  }

  // Show configuration error if Supabase is not configured
  if (!supabaseConfigured) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-red-50 via-slate-50 to-red-50 dark:from-gray-900 dark:via-black dark:to-gray-900 overflow-auto py-8">
        <div className="max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-800">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Konfigurationsfehler</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Supabase-Umgebungsvariablen sind nicht konfiguriert. Bitte füge die folgenden Variablen in Vercel hinzu:
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm font-mono text-left mb-4">
              <div>NEXT_PUBLIC_SUPABASE_URL</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Öffne die Browser-Konsole (F12) für detaillierte Fehlermeldungen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 dark:from-gray-900 dark:via-black dark:to-gray-900 overflow-auto py-8">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={() => {
            const theme = searchParams.get("theme");
            router.push(`/${theme ? `?theme=${theme}` : ''}`);
          }}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>
      
      {/* Login content */}
      <div className="relative z-10">
        <LoginCard />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <div className="text-slate-600 dark:text-slate-400 font-medium">Lädt...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
