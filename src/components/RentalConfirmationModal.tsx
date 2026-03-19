"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
// Always show the generic powerbank image on the rent flow
import { isStationOnline, computeRealAvailability } from "@/components/StationManager";

function getBestBatteryPercentage(s: {
  battery_percentage?: number | null;
  slot_1_battery_percentage?: number | null;
  slot_2_battery_percentage?: number | null;
}): number | null {
  const candidates = [
    s.slot_1_battery_percentage,
    s.slot_2_battery_percentage,
    s.battery_percentage,
  ].filter((v): v is number => typeof v === "number" && v >= 0);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

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
  slot_1_battery_percentage?: number | null;
  slot_2_battery_percentage?: number | null;
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
  const [bestBatteryPct, setBestBatteryPct] = useState<number | null>(getBestBatteryPercentage(station));

  useEffect(() => {
    setAvailableUnits(computeRealAvailability(station));
    setStationOnline(isStationOnline(station));
    setBestBatteryPct(getBestBatteryPercentage(station));
  }, [station.battery_voltage, station.battery_percentage, station.last_seen, station.slot_1_battery_percentage, station.slot_2_battery_percentage]);

  // Beim Öffnen und bei Fokus: aktuelle Batterie-Daten + last_seen der Station laden
  useEffect(() => {
    if (phase !== "confirm") return;
    const fetchAvailableUnits = async () => {
      try {
        let { data, error: fetchError } = await supabase
          .from("stations")
          .select("powerbank_id, battery_voltage, battery_percentage, last_seen, updated_at, slot_1_battery_percentage, slot_2_battery_percentage")
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
          data = legacy.data ? { ...legacy.data, powerbank_id: null, slot_1_battery_percentage: null, slot_2_battery_percentage: null } : null;
          fetchError = legacy.error;
        }
        if (!fetchError && data != null) {
          const online = isStationOnline(data);
          setStationOnline(online);
          setAvailableUnits(computeRealAvailability(data));
          setBestBatteryPct(getBestBatteryPercentage(data));
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
          data = legacy.data ? { ...legacy.data, powerbank_id: null } as typeof data : null;
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

  // Shared palette derived from isDarkMode
  const bg = isDarkMode ? "#09090b" : "#fafafa";
  const cardBg = isDarkMode ? "#18181b" : "#ffffff";
  const borderColor = isDarkMode ? "#27272a" : "#e4e4e7";
  const textPrimary = isDarkMode ? "#fafafa" : "#09090b";
  const textSecondary = isDarkMode ? "#a1a1aa" : "#71717a";
  const textTertiary = isDarkMode ? "#52525b" : "#a1a1aa";

  // ===== AUTH LOADING =====
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center" style={{ background: bg }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: borderColor, borderTopColor: textSecondary }} />
      </div>
    );
  }

  // ===== PICKUP SCREEN =====
  if (phase === "pickup") {
    const photoSrc = "/Powerbank.png";

    return (
      <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: bg }}>
        <style>{`
          @keyframes pickup-scan {
            0% { top: 16px; }
            50% { top: calc(100% - 20px); }
            100% { top: 16px; }
          }
        `}</style>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Product image with scanning line */}
          <div className="relative w-48 h-48 mb-12">
            {/* Faint border frame */}
            <div className="absolute inset-0 rounded-2xl" style={{ border: `1px solid ${borderColor}` }} />
            {/* Scanning line — a single thin emerald bar moving vertically */}
            <div
              className="absolute left-3 right-3 h-px bg-emerald-500"
              style={{ animation: "pickup-scan 3s ease-in-out infinite", opacity: 0.6 }}
            />
            <img
              src={photoSrc}
              alt="Powerbank"
              className="absolute inset-0 w-full h-full object-contain p-6"
              onError={(e) => { (e.target as HTMLImageElement).src = "/Powerbank.png"; }}
            />
          </div>

          <p className="text-[11px] font-medium tracking-[0.2em] uppercase mb-3" style={{ color: textTertiary }}>
            {station.name}
          </p>

          <h2 className="text-[28px] font-bold tracking-tight text-center leading-none mb-3" style={{ color: textPrimary }}>
            Powerbank entnehmen
          </h2>

          <p className="text-[15px] text-center leading-relaxed max-w-[260px]" style={{ color: textSecondary }}>
            Die Station gibt Ihre Powerbank aus. Bitte jetzt entnehmen.
          </p>

          {/* Subtle waiting indicator — a thin line */}
          <div className="w-16 mt-8 mb-10">
            <div className="h-[2px] rounded-full overflow-hidden" style={{ background: borderColor }}>
              <div className="h-full w-1/3 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          {pickupTimeout && (
            <button
              onClick={stableOnPickupComplete}
              className="w-full max-w-xs h-14 rounded-[14px] bg-emerald-600 text-white text-[15px] font-semibold tracking-wide mb-4 active:opacity-90 transition-opacity"
            >
              Fertig
            </button>
          )}

          <button
            onClick={() => { window.location.href = "/hilfe"; }}
            className="text-[13px] font-medium underline decoration-1 underline-offset-4 transition-opacity active:opacity-70"
            style={{ color: textTertiary }}
          >
            Problem melden
          </button>
        </div>
      </div>
    );
  }

  // ===== CONFIRMATION SCREEN =====
  const batteryPct = bestBatteryPct !== null ? Math.round(bestBatteryPct) : null;
  const batteryColor =
    batteryPct !== null
      ? batteryPct >= 60 ? "#10b981" : batteryPct >= 30 ? "#eab308" : "#ef4444"
      : "#52525b";

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: bg }}>
      {/* Top bar — close + status */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg transition-opacity active:opacity-60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className={`w-[6px] h-[6px] rounded-full ${stationOnline ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-[12px] font-medium" style={{ color: textTertiary }}>
            {stationOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Product image — static, confident, on a subtle card */}
        <div className="px-5 pt-2 pb-4">
          <div
            className="w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ background: isDarkMode ? "#111113" : "#f4f4f5", border: `1px solid ${borderColor}` }}
          >
            <img
              src="/Powerbank.png"
              alt={station.name}
              className="w-3/5 h-3/5 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes("/Powerbank.png")) target.src = "/Powerbank.png";
              }}
            />
          </div>
        </div>

        {/* Station name — big and bold */}
        <div className="px-5 mb-5">
          <h1 className="text-[32px] font-bold tracking-tight leading-[1.1]" style={{ color: textPrimary }}>
            {station.name}
          </h1>
          {station.address && (
            <p className="text-[13px] mt-1.5" style={{ color: textTertiary }}>
              {station.address}
            </p>
          )}
        </div>

        {/* Info grid — pricing + availability as big numbers */}
        <div className="px-5 mb-5">
          <div className="grid grid-cols-3 gap-3">
            {/* Start price */}
            <div className="rounded-xl p-3" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
              <p className="text-[22px] font-bold tracking-tight leading-none mb-1" style={{ color: textPrimary }}>
                {startPrice.toFixed(2)}€
              </p>
              <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: textTertiary }}>
                Start
              </p>
            </div>
            {/* Per minute */}
            <div className="rounded-xl p-3" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
              <p className="text-[22px] font-bold tracking-tight leading-none mb-1" style={{ color: textPrimary }}>
                {pricePerMinute.toFixed(2)}€
              </p>
              <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: textTertiary }}>
                / Min
              </p>
            </div>
            {/* Available */}
            <div className="rounded-xl p-3" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
              <p className="text-[22px] font-bold tracking-tight leading-none mb-1" style={{ color: textPrimary }}>
                {stationOnline
                  ? availableUnits
                  : (station.available_units ?? 0)}
              </p>
              <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: textTertiary }}>
                {stationOnline ? "Verfügbar" : (station.available_units ?? 0) !== 1 ? "Powerbanks" : "Powerbank"}
              </p>
            </div>
          </div>
        </div>

        {/* Battery bar — thin, functional */}
        {batteryPct !== null && (
          <div className="px-5 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium" style={{ color: textSecondary }}>Akku</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: textSecondary }}>{batteryPct}%</span>
            </div>
            <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: borderColor }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${batteryPct}%`, background: batteryColor }}
              />
            </div>
          </div>
        )}

        {/* Offline warning — plain text, not a card */}
        {!stationOnline && (
          <div className="px-5 mb-4">
            <p className="text-[13px] font-medium text-red-500">
              Station ist offline — Ausleihe derzeit nicht möglich.
            </p>
          </div>
        )}

        {/* Auth status — minimal */}
        <div className="px-5 mb-4">
          {isAuthenticated ? (
            <p className="text-[12px] truncate" style={{ color: textTertiary }}>{email}</p>
          ) : (
            <p className="text-[13px] font-medium" style={{ color: isDarkMode ? "#fbbf24" : "#d97706" }}>
              Anmeldung erforderlich
            </p>
          )}
        </div>

        {/* Error — just red text */}
        {error && (
          <div className="px-5 mb-4">
            <p className="text-[13px] font-medium text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom actions — pinned */}
      <div className="flex-shrink-0 px-5 pt-2 pb-6" style={{ borderTop: `1px solid ${borderColor}` }}>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || (!stationOnline && availableUnits <= 0)}
          className="w-full h-14 rounded-[14px] text-[15px] font-semibold tracking-wide text-white transition-opacity active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: !stationOnline ? (isDarkMode ? "#27272a" : "#a1a1aa") : "#10b981" }}
        >
          {loading
            ? "Wird bestätigt..."
            : !stationOnline
              ? "Station offline"
              : isAuthenticated
                ? "Ausleihe bestätigen"
                : "Anmelden & Ausleihen"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 mt-1 text-[13px] font-medium transition-opacity active:opacity-60"
          style={{ color: textTertiary }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
