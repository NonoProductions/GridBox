"use client";

import { useEffect, useLayoutEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/useTheme";

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark: isDarkMode, toggleTheme } = useTheme();

  // Theme aus URL oder localStorage VOR dem ersten Paint setzen, damit Profil sofort hell/dunkel stimmt
  useLayoutEffect(() => {
    const theme = searchParams.get("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", theme);
      window.dispatchEvent(new Event("themechange"));
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = saved ? saved === "dark" : prefersDark;
      document.documentElement.classList.toggle("dark", dark);
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", dark ? "dark" : "light");
      window.dispatchEvent(new Event("themechange"));
    }
  }, [searchParams]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }
      const user = data.user;
      setName((user.user_metadata as Record<string, unknown>)?.full_name as string || "");
      setEmail(user.email || "");
    })();
  }, [router]);

  async function handleSave() {
    setError(null);
    setSuccess(null);
    
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Bitte gib einen gültigen Namen ein.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName }
      });
      if (updateError) throw updateError;
      setSuccess("Profil erfolgreich aktualisiert!");
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`)}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg transition-colors mt-[15px] mb-[15px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      
      {/* Content */}
      <div className="px-5 pt-20 pb-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]">
            Profil
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]">
            Verwalte deine persönlichen Informationen
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl">
            {success}
          </div>
        )}

        {/* Profile Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-white/90">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:ring-emerald-500/40 dark:focus:ring-emerald-900/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-white/90">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-xl border px-4 py-3 cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50"
            />
            <p className="text-xs mt-1 text-slate-500 dark:text-white/60">
              E-Mail-Adresse kann nicht geändert werden
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 text-white py-3 font-medium shadow hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Speichere…" : "Änderungen speichern"}
          </button>
        </div>

        {/* Theme Toggle Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Darstellung
          </h3>
          
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full rounded-xl border px-4 py-3 transition-colors bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/15"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10">
                  {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-gray-300">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
                    {isDarkMode ? 'Dunkles Design aktiviert' : 'Helles Design aktiviert'}
                  </div>
                </div>
              </div>
              <div className={`relative inline-flex h-7 w-16 items-center rounded-full transition-colors duration-300 ease-in-out ${
                isDarkMode 
                  ? 'bg-emerald-600' 
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}>
                <span
                  className={`absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${
                    isDarkMode ? 'translate-x-[2.125rem]' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </button>
        </div>

        {/* Logout Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Account
          </h3>
          
          <button
            type="button"
            onClick={async () => {
              try {
                await supabase.auth.signOut();
                router.push(`/?theme=${isDarkMode ? "dark" : "light"}`);
              } catch (error) {
                console.error("Error signing out:", error);
              }
            }}
            className="w-full rounded-xl border px-4 py-3 transition-colors bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Abmelden</div>
                <div className="text-sm opacity-80">
                  Aus der App ausloggen
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
