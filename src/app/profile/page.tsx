"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-20 left-4 z-10" style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
        <button
          type="button"
          onClick={() => {
            router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`);
          }}
          aria-label="Zurück"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm ${
            isDarkMode 
              ? 'bg-white/20 text-white hover:bg-white/30' 
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      
      {/* Content */}
      <div className="p-6 space-y-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
        {/* Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Profil
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Verwalte deine persönlichen Informationen
          </p>
        </div>

        {error && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode 
              ? 'border-rose-800 bg-rose-900/20 text-rose-400' 
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}>
            {error}
          </div>
        )}
        {success && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode 
              ? 'border-green-800 bg-green-900/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {success}
          </div>
        )}

        {/* Profile Form */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Persönliche Daten
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-white/90' : 'text-slate-700'
            }`}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
              className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 ${
                isDarkMode 
                  ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-emerald-900/40' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus:ring-emerald-500/40'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-white/90' : 'text-slate-700'
            }`}>
              E-Mail-Adresse
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={`w-full rounded-xl border px-4 py-3 cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white/50' 
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            />
            <p className={`text-xs mt-1 ${
              isDarkMode ? 'text-white/60' : 'text-slate-500'
            }`}>
              E-Mail-Adresse kann nicht geändert werden
            </p>
          </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 text-white py-3 font-medium shadow hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Speichere…" : "Änderungen speichern"}
            </button>
          </form>
        </div>

        {/* Theme Toggle Section */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Darstellung
          </h3>
          
          <div className={`rounded-xl border px-4 py-3 ${
            isDarkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10">
                  {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
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
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    {isDarkMode ? 'Dunkles Design aktiviert' : 'Helles Design aktiviert'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newTheme = isDarkMode ? "light" : "dark";
                  router.push(`/profile?theme=${newTheme}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  isDarkMode ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Account
          </h3>
          
          <button
            type="button"
            onClick={async () => {
              try {
                await supabase.auth.signOut();
                router.push("/");
              } catch (error) {
                console.error("Error signing out:", error);
              }
            }}
            className={`w-full rounded-xl border px-4 py-3 transition-colors ${
              isDarkMode 
                ? 'bg-red-900/20 border-red-800 hover:bg-red-900/30 text-red-400' 
                : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Abmelden</div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-red-400' : 'text-red-500'
                }`}>
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
