"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAbsoluteStationPhotoUrl } from "@/lib/photoUtils";

interface Station {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  available_units?: number;
  total_units?: number;
  description?: string;
  photo_url?: string;
  photos?: string[];
}

interface RentalConfirmationModalProps {
  station: Station;
  onClose: () => void;
  onConfirm: (userEmail?: string, userName?: string) => void;
  isDarkMode: boolean;
}

export default function RentalConfirmationModal({
  station,
  onClose,
  onConfirm,
  isDarkMode,
}: RentalConfirmationModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Preis-Konfiguration - gleich wie im Station-Panel
  const startPrice = 0.10; // 10 Cent zum Start
  const pricePerMinute = 0.05; // 5 Cent pro Minute

  // Prüfe ob Nutzer angemeldet ist
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        
        if (session?.user) {
          const userEmail = session.user.email || "";
          const userName = session.user.user_metadata?.full_name || "";
          setEmail(userEmail);
          setName(userName);
        }
      } catch (err) {
        console.error("Fehler beim Prüfen der Authentifizierung:", err);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleConfirm = async () => {
    // Nicht angemeldet: direkt zur Login-Seite (returnUrl = Ausleihe-Seite, danach sofort fertig)
    if (!isAuthenticated) {
      try {
        const currentUrl = window.location.pathname + window.location.search;
        const url = new URL(currentUrl, window.location.origin);
        if (url.origin === window.location.origin) {
          window.location.href = `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`;
        } else {
          window.location.href = '/login';
        }
      } catch {
        window.location.href = '/login';
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Hole aktuellen User
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Bitte melden Sie sich an, um eine Powerbank auszuleihen.");
        setLoading(false);
        return;
      }

      // Prüfe ob User bereits eine aktive Ausleihe hat
      const { data: activeRental, error: checkError } = await supabase
        .from('rentals')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (checkError) {
        setError("Fehler beim Prüfen der Ausleihen.");
        setLoading(false);
        return;
      }

      if (activeRental) {
        setError("Sie haben bereits eine aktive Powerbank-Ausleihe. Bitte geben Sie diese zuerst zurück.");
        setLoading(false);
        return;
      }

      // Prüfe Verfügbarkeit (berücksichtige gesperrte Slots)
      const { data: availableSlots, error: slotsError } = await supabase
        .from('slots')
        .select('id')
        .eq('station_id', station.id)
        .eq('state', 'free')
        .limit(1);

      if (slotsError) {
        setError("Fehler beim Prüfen der Verfügbarkeit.");
        setLoading(false);
        return;
      }

      if (!availableSlots || availableSlots.length === 0) {
        setError("Leider sind momentan keine Powerbanks verfügbar.");
        setLoading(false);
        return;
      }

      await onConfirm(email, name);
      
    } catch (err) {
      console.error("Fehler bei der Bestätigung:", err);
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={`fixed inset-0 z-[2000] flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Ein Fenster: volles Modal (Bild, Station, bei Bedarf „Anmelden & Ausleihen“ oder „Ausleihe bestätigen“)
  return (
    <div
      className="fixed inset-0 z-[2000]"
      style={{
        backgroundColor: isDarkMode ? "#282828" : "white",
      }}
    >
      <div className="flex flex-col h-full relative">
        {/* Powerbank Bild - ganz oben mit allen Infos */}
        <div className="px-5 pt-6 pb-4">
          <div className={`rounded-2xl overflow-hidden shadow-lg ${
            isDarkMode ? "bg-gray-800/50" : "bg-white"
          }`}>
            {/* Station- oder Powerbank-Bild */}
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 flex items-center justify-center">
              <img
                src={(station.photo_url || station.photos?.[0]) ? getAbsoluteStationPhotoUrl(station.photo_url || station.photos?.[0]) : "/Powerbank.png"}
                alt={station.name}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const isFallback = target.src.includes("/Powerbank.png");
                  if (!isFallback) {
                    target.src = "/Powerbank.png";
                  } else {
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.textContent = "";
                      const placeholderDiv = document.createElement("div");
                      placeholderDiv.className = "flex flex-col items-center justify-center h-full text-center p-6";
                      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                      svg.setAttribute("viewBox", "0 0 24 24");
                      svg.setAttribute("width", "64");
                      svg.setAttribute("height", "64");
                      svg.setAttribute("fill", "none");
                      svg.setAttribute("stroke", "currentColor");
                      svg.setAttribute("stroke-width", "2");
                      svg.setAttribute("stroke-linecap", "round");
                      svg.setAttribute("stroke-linejoin", "round");
                      svg.className.baseVal = "text-emerald-600 dark:text-emerald-400 mb-3";
                      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                      path.setAttribute("d", "M13 11h3l-4 6v-4H9l4-6v4z");
                      svg.appendChild(path);
                      const textEl = document.createElement("p");
                      textEl.className = "text-sm opacity-60";
                      textEl.textContent = "Powerbank Bild";
                      placeholderDiv.appendChild(svg);
                      placeholderDiv.appendChild(textEl);
                      parent.appendChild(placeholderDiv);
                    }
                  }
                }}
              />
            </div>

            {/* Info-Bereich mit Stationsname, Verfügbarkeit und Kosten */}
            <div className={`p-4 space-y-3 ${isDarkMode ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <h3 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                {station.name}
              </h3>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="5 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                  <path d="M13 11h3l-4 6v-4H9l4-6v4z" />
                </svg>
                <span className={`text-base ml-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  <span className="font-semibold">{station.available_units || 0}</span> verfügbar
                </span>
              </div>
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span className={`text-base ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  <span className="font-semibold">{startPrice.toFixed(2)}€</span> zum Start, anschließend <span className="font-semibold">{pricePerMinute.toFixed(2)}€</span>/Min
                </span>
              </div>
              {station.address && (
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {station.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {isAuthenticated ? (
            <div className={`rounded-lg p-4 mb-4 ${isDarkMode ? "bg-gray-700/30" : "bg-gray-50"}`}>
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-500">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className="text-sm font-medium mb-1">Sie sind angemeldet</p>
                  <p className="text-xs opacity-70">{email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-lg p-4 mb-4 border-2 border-dashed ${isDarkMode ? "bg-emerald-900/20 border-emerald-700/50" : "bg-emerald-50 border-emerald-300"}`}>
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div>
                  <p className="text-sm font-medium mb-1">Anmeldung erforderlich</p>
                  <p className="text-xs opacity-70">Bitte melden Sie sich an, um eine Powerbank auszuleihen</p>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className={`mb-4 p-3 rounded-lg ${
              isDarkMode ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-700"
            }`}>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-6 space-y-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (station.available_units ?? 0) <= 0}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-12 shadow-lg active:scale-95 border border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span className="text-base font-semibold tracking-wide">Wird bestätigt...</span>
              </>
            ) : isAuthenticated ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 11h3l-4 6v-4H9l4-6v4z" />
                </svg>
                <span className="text-base font-semibold tracking-wide">Ausleihe bestätigen</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span className="text-base font-semibold tracking-wide">Anmelden & Ausleihen</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-3 rounded-xl px-6 h-12 border transition-all ${
              isDarkMode ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : "bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200"
            }`}
          >
            <span className="text-base font-medium">Abbrechen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
