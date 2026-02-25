"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAbsoluteStationPhotoUrl } from "@/lib/photoUtils";
import { isStationOnline, computeRealAvailability } from "@/components/StationManager";

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
  battery_voltage?: number | null;
  battery_percentage?: number | null;
  powerbank_id?: string | null;
  last_seen?: string | null;
  updated_at?: string | null;
}

interface RentalConfirmationModalProps {
  station: Station;
  onClose: () => void;
  onConfirm: (userEmail?: string, userName?: string) => Promise<void> | void;
  onPickupComplete: () => void;
  isDarkMode: boolean;
}

export default function RentalConfirmationModal({
  station,
  onClose,
  onConfirm,
  onPickupComplete,
  isDarkMode,
}: RentalConfirmationModalProps) {
  const [phase, setPhase] = useState<"confirm" | "pickup">("confirm");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pickupTimeout, setPickupTimeout] = useState(false);

  // Verfügbarkeit unter Berücksichtigung des Verbindungsstatus berechnen
  const [availableUnits, setAvailableUnits] = useState<number>(computeRealAvailability(station));
  const [stationOnline, setStationOnline] = useState<boolean>(isStationOnline(station));

  useEffect(() => {
    setAvailableUnits(computeRealAvailability(station));
    setStationOnline(isStationOnline(station));
  }, [station.battery_voltage, station.battery_percentage, station.last_seen]);

  // Beim Öffnen und bei Fokus: aktuelle Batterie-Daten + last_seen der Station laden
  useEffect(() => {
    if (phase !== "confirm") return;
    const fetchAvailableUnits = async () => {
      try {
        let { data, error: fetchError } = await supabase
          .from("stations")
          .select("powerbank_id, battery_voltage, battery_percentage, last_seen, updated_at")
          .eq("id", station.id)
          .maybeSingle();
        const missingPowerbankColumn =
          !!fetchError &&
          `${fetchError.code ?? ''} ${fetchError.message ?? ''} ${fetchError.details ?? ''}`.toLowerCase().includes('powerbank_id');
        if (missingPowerbankColumn) {
          const legacy = await supabase
            .from("stations")
            .select("battery_voltage, battery_percentage, last_seen, updated_at")
            .eq("id", station.id)
            .maybeSingle();
          data = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
          fetchError = legacy.error;
        }
        if (!fetchError && data != null) {
          const online = isStationOnline(data);
          setStationOnline(online);
          setAvailableUnits(computeRealAvailability(data));
        }
      } catch {
        // Fallback: Wert von der übergebenen Station behalten
      }
    };
    fetchAvailableUnits();
    // Alle 15 Sekunden aktualisieren, um Verbindungsstatus zu prüfen
    const interval = setInterval(fetchAvailableUnits, 15000);
    const onFocus = () => fetchAvailableUnits();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [station.id, phase]);

  // Preis-Konfiguration
  const startPrice = 0.10;
  const pricePerMinute = 0.05;

  // Prüfe ob Nutzer angemeldet ist
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        if (session?.user) {
          setEmail(session.user.email || "");
          setName(session.user.user_metadata?.full_name || "");
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

  // Pickup-Phase: Station alle 3 Sekunden prüfen, ob Powerbank entnommen wurde
  const stableOnPickupComplete = useCallback(onPickupComplete, [onPickupComplete]);

  useEffect(() => {
    if (phase !== "pickup") return;

    const poll = setInterval(async () => {
      try {
        let { data, error } = await supabase
          .from("stations")
          .select("powerbank_id, battery_voltage, battery_percentage")
          .eq("id", station.id)
          .maybeSingle();

        const missingPowerbankColumn =
          !!error &&
          `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase().includes('powerbank_id');
        if (missingPowerbankColumn) {
          const legacy = await supabase
            .from("stations")
            .select("battery_voltage, battery_percentage")
            .eq("id", station.id)
            .maybeSingle();
          data = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
        }

        if (data) {
          const hasPowerbank =
            (typeof data.powerbank_id === "string" && data.powerbank_id.trim().length > 0) ||
            (data.battery_voltage != null && data.battery_percentage != null);
          if (!hasPowerbank) {
            clearInterval(poll);
            stableOnPickupComplete();
          }
        }
      } catch {
        // Bei Netzwerkfehler weiter pollen
      }
    }, 2000);

    // Nach 60 Sekunden "Fertig"-Button anzeigen als Fallback
    const timeout = setTimeout(() => setPickupTimeout(true), 60000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [phase, station.id, stableOnPickupComplete]);

  const handleConfirm = async () => {
    // Nicht angemeldet: zur Login-Seite
    if (!isAuthenticated) {
      try {
        const currentUrl = window.location.pathname + window.location.search;
        const url = new URL(currentUrl, window.location.origin);
        if (url.origin === window.location.origin) {
          window.location.href = `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`;
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(email, name);
      setPhase("pickup");
    } catch (err) {
      console.error("Fehler bei der Bestätigung:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
      );
    } finally {
      setLoading(false);
    }
  };

  // ===== AUTH LOADING =====
  if (authLoading) {
    return (
      <div
        className={`fixed inset-0 z-[2000] flex items-center justify-center ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // ===== PICKUP SCREEN =====
  if (phase === "pickup") {
    const photoSrc =
      station.photo_url || station.photos?.[0]
        ? getAbsoluteStationPhotoUrl(station.photo_url || station.photos?.[0])
        : "/Powerbank.png";

    return (
      <div
        className="fixed inset-0 z-[2000]"
        style={{ backgroundColor: isDarkMode ? "#282828" : "white" }}
      >
        <div className="flex flex-col h-full items-center justify-center px-6">
          {/* Animiertes Powerbank-Bild */}
          <div className="relative mb-8">
            <div className="w-36 h-36 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <img
                src={photoSrc}
                alt="Powerbank"
                className="w-24 h-24 object-contain animate-pulse"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/Powerbank.png";
                }}
              />
            </div>
            {/* Pulsierender Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
          </div>

          <h2
            className={`text-2xl font-bold mb-3 text-center ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Nehmen Sie Ihre Powerbank
          </h2>
          <p
            className={`text-base text-center mb-2 ${
              isDarkMode ? "text-gray-400" : "text-slate-500"
            }`}
          >
            Die Station gibt Ihre Powerbank aus.
            <br />
            Bitte entnehmen Sie sie jetzt.
          </p>
          <p
            className={`text-sm text-center mb-8 ${
              isDarkMode ? "text-gray-500" : "text-slate-400"
            }`}
          >
            {station.name}
          </p>

          {/* Ladeanimation */}
          <div className="flex gap-2 mb-10">
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>

          {/* Fertig-Button erscheint nach 60s als Fallback */}
          {pickupTimeout && (
            <button
              onClick={stableOnPickupComplete}
              className="w-full max-w-xs mb-4 flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-12 shadow-lg active:scale-95 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-base font-semibold">Fertig</span>
            </button>
          )}

          {/* Problem melden → /hilfe */}
          <button
            onClick={() => {
              window.location.href = "/hilfe";
            }}
            className={`w-full max-w-xs flex items-center justify-center gap-3 rounded-xl px-6 h-12 border transition-all ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                : "bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-base font-medium">Problem melden</span>
          </button>
        </div>
      </div>
    );
  }

  // ===== CONFIRMATION SCREEN =====
  return (
    <div
      className="fixed inset-0 z-[2000]"
      style={{ backgroundColor: isDarkMode ? "#282828" : "white" }}
    >
      <div className="flex flex-col h-full relative">
        {/* Powerbank Bild - ganz oben mit allen Infos */}
        <div className="px-5 pt-6 pb-4">
          <div
            className={`rounded-2xl overflow-hidden shadow-lg ${
              isDarkMode ? "bg-gray-800/50" : "bg-white"
            }`}
          >
            {/* Station- oder Powerbank-Bild */}
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 flex items-center justify-center">
              <img
                src={
                  station.photo_url || station.photos?.[0]
                    ? getAbsoluteStationPhotoUrl(
                        station.photo_url || station.photos?.[0]
                      )
                    : "/Powerbank.png"
                }
                alt={station.name}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes("/Powerbank.png")) {
                    target.src = "/Powerbank.png";
                  }
                }}
              />
            </div>

            {/* Info-Bereich */}
            <div
              className={`p-4 space-y-3 ${
                isDarkMode ? "bg-gray-800/30" : "bg-gray-50"
              }`}
            >
              <h3
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {station.name}
              </h3>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="5 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`flex-shrink-0 ${stationOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  <path d="M13 11h3l-4 6v-4H9l4-6v4z" />
                </svg>
                <span
                  className={`text-base ml-2 ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  <span className="font-semibold">{availableUnits}</span>{" "}
                  verfügbar
                </span>
              </div>
              {/* Verbindungsstatus anzeigen */}
              {!stationOnline && (
                <div className={`flex items-center gap-2 mt-1 px-2 py-1 rounded-lg ${
                  isDarkMode ? 'bg-red-900/30' : 'bg-red-50'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    Station offline – keine Verbindung
                  </span>
                </div>
              )}
              {stationOnline && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Station verbunden
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span
                  className={`text-base ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  <span className="font-semibold">
                    {startPrice.toFixed(2)}€
                  </span>{" "}
                  zum Start, anschließend{" "}
                  <span className="font-semibold">
                    {pricePerMinute.toFixed(2)}€
                  </span>
                  /Min
                </span>
              </div>
              {station.address && (
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {station.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {isAuthenticated ? (
            <div
              className={`rounded-lg p-4 mb-4 ${
                isDarkMode ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 text-emerald-500"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className="text-sm font-medium mb-1">
                    Sie sind angemeldet
                  </p>
                  <p className="text-xs opacity-70">{email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-lg p-4 mb-4 border-2 border-dashed ${
                isDarkMode
                  ? "bg-emerald-900/20 border-emerald-700/50"
                  : "bg-emerald-50 border-emerald-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 text-emerald-600"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div>
                  <p className="text-sm font-medium mb-1">
                    Anmeldung erforderlich
                  </p>
                  <p className="text-xs opacity-70">
                    Bitte melden Sie sich an, um eine Powerbank auszuleihen
                  </p>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                isDarkMode
                  ? "bg-red-900/30 text-red-400"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-6 space-y-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || availableUnits <= 0}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-12 shadow-lg active:scale-95 border border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span className="text-base font-semibold tracking-wide">
                  Wird bestätigt...
                </span>
              </>
            ) : isAuthenticated ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 11h3l-4 6v-4H9l4-6v4z" />
                </svg>
                <span className="text-base font-semibold tracking-wide">
                  Ausleihe bestätigen
                </span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span className="text-base font-semibold tracking-wide">
                  Anmelden & Ausleihen
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-3 rounded-xl px-6 h-12 border transition-all ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                : "bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200"
            }`}
          >
            <span className="text-base font-medium">Abbrechen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
