"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { computeRealAvailability, isStationOnline } from "@/components/StationManager";

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

function formatEuro(value: number) {
  return euroFormatter.format(value);
}

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
  short_code?: string;
  opening_hours?: string;
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

  const [availableUnits, setAvailableUnits] = useState<number>(computeRealAvailability(station));
  const [stationOnline, setStationOnline] = useState<boolean>(isStationOnline(station));
  const [bestBatteryPct, setBestBatteryPct] = useState<number | null>(getBestBatteryPercentage(station));

  useEffect(() => {
    setAvailableUnits(computeRealAvailability(station));
    setStationOnline(isStationOnline(station));
    setBestBatteryPct(getBestBatteryPercentage(station));
  }, [station]);

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
          `${fetchError.code ?? ""} ${fetchError.message ?? ""} ${fetchError.details ?? ""}`
            .toLowerCase()
            .includes("powerbank_id");

        if (missingPowerbankColumn) {
          const legacy = await supabase
            .from("stations")
            .select("battery_voltage, battery_percentage, last_seen, updated_at")
            .eq("id", station.id)
            .maybeSingle();

          data = legacy.data
            ? {
                ...legacy.data,
                powerbank_id: null,
                slot_1_battery_percentage: null,
                slot_2_battery_percentage: null,
              }
            : null;
          fetchError = legacy.error;
        }

        if (!fetchError && data != null) {
          setStationOnline(isStationOnline(data));
          setAvailableUnits(computeRealAvailability(data));
          setBestBatteryPct(getBestBatteryPercentage(data));
        }
      } catch {
        // Fallback: vorhandene Werte behalten.
      }
    };

    fetchAvailableUnits();

    const interval = setInterval(fetchAvailableUnits, 15000);
    const onFocus = () => fetchAvailableUnits();

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [station.id, phase]);

  const startPrice = 0.10;
  const pricePerMinute = 0.05;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setIsAuthenticated(!!session);

        if (session?.user) {
          setEmail(session.user.email || "");
          setName(session.user.user_metadata?.full_name || "");
        }
      } catch (err) {
        console.error("Fehler beim Pruefen der Authentifizierung:", err);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  const stableOnPickupComplete = useCallback(onPickupComplete, [onPickupComplete]);

  useEffect(() => {
    if (phase !== "pickup") return;

    const poll = setInterval(async () => {
      try {
        let { data, error: pollError } = await supabase
          .from("stations")
          .select("powerbank_id, battery_voltage, battery_percentage")
          .eq("id", station.id)
          .maybeSingle();

        const missingPowerbankColumn =
          !!pollError &&
          `${pollError.code ?? ""} ${pollError.message ?? ""} ${pollError.details ?? ""}`
            .toLowerCase()
            .includes("powerbank_id");

        if (missingPowerbankColumn) {
          const legacy = await supabase
            .from("stations")
            .select("battery_voltage, battery_percentage")
            .eq("id", station.id)
            .maybeSingle();

          data = legacy.data ? ({ ...legacy.data, powerbank_id: null } as typeof data) : null;
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
        // Bei Netzwerkfehler weiter pollen.
      }
    }, 2000);

    const timeout = setTimeout(() => setPickupTimeout(true), 60000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [phase, station.id, stableOnPickupComplete]);

  const handleConfirm = async () => {
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
      console.error("Fehler bei der Bestaetigung:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Colours ── */
  const bg = isDarkMode ? "#081017" : "#f4faf7";
  const cardBg = isDarkMode ? "#111920" : "#ffffff";
  const borderColor = isDarkMode ? "rgba(148, 163, 184, 0.14)" : "rgba(15, 23, 42, 0.08)";
  const textPrimary = isDarkMode ? "#f8fafc" : "#0f172a";
  const textSecondary = isDarkMode ? "#cbd5e1" : "#475569";
  const textMuted = isDarkMode ? "#94a3b8" : "#64748b";
  const skeletonBg = isDarkMode ? "rgba(255,255,255,0.06)" : "#f1f5f9";
  const pageBg = isDarkMode
    ? `radial-gradient(circle at top, rgba(16,185,129,0.08), transparent 42%), ${bg}`
    : `radial-gradient(circle at top, rgba(16,185,129,0.08), transparent 44%), ${bg}`;

  /* ── Computed ── */
  const statusBatteryPct = bestBatteryPct !== null ? Math.round(bestBatteryPct) : null;
  const totalUnits = station.total_units ?? Math.max(availableUnits, station.available_units ?? 0, 1);
  const readyToRent = stationOnline && availableUnits > 0;

  const statusTitle = error
    ? "Fehler bei der Ausleihe"
    : stationOnline
      ? "Gerade nichts frei"
      : "Station nicht erreichbar";

  const statusMessage = error
    ? error
    : stationOnline
      ? "Im Moment ist keine geladene Powerbank verfuegbar. Bitte versuche es gleich noch einmal."
      : "Sobald die Station wieder erreichbar ist, kannst du hier direkt ausleihen.";

  const statusTone = error
    ? {
        bg: isDarkMode ? "rgba(127,29,29,0.2)" : "rgba(254,242,242,0.96)",
        border: isDarkMode ? "rgba(248,113,113,0.3)" : "rgba(239,68,68,0.18)",
        text: "#ef4444",
      }
    : stationOnline
      ? {
          bg: isDarkMode ? "rgba(120,53,15,0.2)" : "rgba(255,251,235,0.98)",
          border: isDarkMode ? "rgba(245,158,11,0.24)" : "rgba(245,158,11,0.18)",
          text: isDarkMode ? "#fde68a" : "#b45309",
        }
      : {
          bg: isDarkMode ? "rgba(127,29,29,0.2)" : "rgba(254,242,242,0.96)",
          border: isDarkMode ? "rgba(248,113,113,0.3)" : "rgba(239,68,68,0.18)",
          text: "#ef4444",
        };

  const primaryButtonLabel = loading
    ? "Wird gestartet\u2026"
    : !readyToRent
      ? stationOnline
        ? "Momentan nicht verfuegbar"
        : "Station nicht erreichbar"
      : isAuthenticated
        ? "Ausleihe starten"
        : "Anmelden und starten";

  /* ═══════════════════════════════════════
     AUTH LOADING – Full-page skeleton
     ═══════════════════════════════════════ */
  if (authLoading) {
    return (
      <div className="h-[100dvh] overflow-hidden" style={{ background: pageBg }}>
        <div className="mx-auto flex h-full max-w-md flex-col px-4 sm:px-6">
          <div className="pt-3">
            <div className="h-10 w-10 rounded-xl animate-pulse" style={{ background: skeletonBg }} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="h-32 w-32 rounded-[24px] animate-pulse sm:h-40 sm:w-40" style={{ background: skeletonBg }} />
            <div className="mt-3 h-6 w-44 rounded-lg animate-pulse" style={{ background: skeletonBg }} />
            <div className="mt-2 flex gap-2">
              <div className="h-7 w-20 rounded-full animate-pulse" style={{ background: skeletonBg }} />
              <div className="h-7 w-16 rounded-full animate-pulse" style={{ background: skeletonBg }} />
              <div className="h-7 w-14 rounded-full animate-pulse" style={{ background: skeletonBg }} />
            </div>
            <div className="mt-3 h-4 w-44 rounded-lg animate-pulse" style={{ background: skeletonBg }} />
          </div>
          <div className="space-y-2 pb-4">
            <div className="h-14 w-full rounded-2xl animate-pulse" style={{ background: skeletonBg }} />
            <div className="h-12 w-full rounded-2xl animate-pulse" style={{ background: skeletonBg }} />
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     PICKUP PHASE – Full page
     ═══════════════════════════════════════ */
  if (phase === "pickup") {
    return (
      <div className="h-[100dvh] overflow-hidden" style={{ background: pageBg }}>
        <div className="mx-auto flex h-full max-w-md flex-col px-4 sm:px-6">
          {/* Status badge */}
          <div className="flex justify-center pt-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                background: isDarkMode ? "rgba(16,185,129,0.12)" : "rgba(236,253,245,0.95)",
                color: "#10b981",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Ausgabe laeuft
            </span>
          </div>

          {/* Center */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="h-32 w-32 sm:h-40 sm:w-40">
              <Image
                src="/Powerbank.png"
                alt="Powerbank"
                width={144}
                height={144}
                className="h-full w-full object-contain"
                priority
              />
            </div>

            <h2 className="mt-3 text-xl font-bold text-center tracking-tight sm:mt-4 sm:text-2xl" style={{ color: textPrimary }}>
              Powerbank entnehmen
            </h2>
            <p className="mt-2 max-w-[280px] text-center text-sm leading-5" style={{ color: textSecondary }}>
              Die Station ist freigegeben. Bitte jetzt die Powerbank herausnehmen.
            </p>
          </div>

          {/* Bottom */}
          <div className="space-y-2 pb-4">
            <div className="rounded-2xl border px-3 py-2.5" style={{ background: cardBg, borderColor }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7 9 18l-5-5" />
                  </svg>
                </div>
                <p className="text-sm leading-5" style={{ color: textSecondary }}>
                  Sobald die Powerbank entnommen wurde, geht es automatisch weiter.
                </p>
              </div>
            </div>

            {pickupTimeout && (
              <button
                onClick={stableOnPickupComplete}
                className="h-12 w-full rounded-2xl text-sm font-semibold text-white transition-transform active:scale-[0.99]"
                style={{ background: "#10b981" }}
              >
                Ich habe die Powerbank entnommen
              </button>
            )}

            <button
              onClick={() => {
                window.location.href = "/hilfe";
              }}
              className="h-10 w-full rounded-2xl border text-sm font-medium transition-colors active:opacity-80"
              style={{ borderColor, color: textMuted }}
            >
              Problem melden
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     CONFIRM PHASE – Full page
     ═══════════════════════════════════════ */
  return (
    <div className="h-[100dvh] overflow-hidden" style={{ background: pageBg }}>
      <div className="mx-auto flex h-full max-w-md flex-col px-4 sm:px-6">
        <div className="h-6 pt-2" aria-hidden="true" />

        {/* Center content */}
        <div className="flex flex-1 flex-col items-center justify-center">
          {/* Station image */}
          <div className="flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
            <Image
              src="/Powerbank.png"
              alt={station.name}
              width={240}
              height={240}
              className="h-full w-full object-contain"
              priority
            />
          </div>

          {/* Station name */}
          <h1 className="mt-4 text-center text-[2rem] font-bold leading-tight sm:mt-5 sm:text-[2.1rem]" style={{ color: textPrimary }}>
            {station.name}
          </h1>

          {/* Status badges */}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 sm:text-sm"
              style={{
                background: stationOnline
                  ? (isDarkMode ? "rgba(16,185,129,0.12)" : "rgba(236,253,245,0.95)")
                  : (isDarkMode ? "rgba(239,68,68,0.12)" : "rgba(254,242,242,0.95)"),
                color: stationOnline ? "#10b981" : "#ef4444",
              }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${stationOnline ? "bg-emerald-500" : "bg-red-500"}`} />
              {stationOnline ? "Geoeffnet" : "Geschlossen"}
            </span>

            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium sm:px-3.5 sm:text-sm"
              style={{
                background: isDarkMode ? "rgba(15,23,42,0.4)" : "rgba(241,245,249,0.9)",
                color: textSecondary,
                border: `1px solid ${borderColor}`,
              }}
            >
              {availableUnits}/{totalUnits} frei
            </span>

            {statusBatteryPct !== null && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:px-3.5 sm:text-sm"
                style={{
                  background: isDarkMode ? "rgba(15,23,42,0.4)" : "rgba(241,245,249,0.9)",
                  color: textSecondary,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
                  <line x1="22" y1="11" x2="22" y2="13" />
                </svg>
                {statusBatteryPct}%
              </span>
            )}
          </div>

          {/* Price */}
          <p className="mt-3 text-center text-sm sm:mt-4 sm:text-base" style={{ color: textSecondary }}>
            {formatEuro(startPrice)} zum Start · {formatEuro(pricePerMinute)} pro Minute
          </p>
        </div>

        {/* Bottom section */}
        <div className="space-y-2 pb-4">
          {/* Account card */}
          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{ background: cardBg, borderColor }}
          >
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: isDarkMode ? "rgba(16,185,129,0.14)" : "rgba(209,250,229,0.92)",
                    color: "#10b981",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21a8 8 0 1 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: textPrimary }}>
                    {name || "Angemeldet"}
                  </p>
                  {email && (
                    <p className="truncate text-xs" style={{ color: textMuted }}>
                      {email}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: isDarkMode ? "rgba(245,158,11,0.12)" : "rgba(254,243,199,0.9)",
                      color: isDarkMode ? "#fde68a" : "#b45309",
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21a8 8 0 1 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      Nicht angemeldet
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      Zum Ausleihen anmelden
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConfirm}
                  className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-transform active:scale-[0.97]"
                  style={{
                    background: isDarkMode ? "rgba(16,185,129,0.14)" : "rgba(209,250,229,0.8)",
                    color: "#10b981",
                  }}
                >
                  Anmelden
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{ background: statusTone.bg, borderColor: statusTone.border }}
            >
              <p className="text-sm" style={{ color: statusTone.text }}>
                {error}
              </p>
            </div>
          )}

          {/* Not ready */}
          {!error && !readyToRent && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{ background: statusTone.bg, borderColor: statusTone.border }}
            >
              <p className="text-sm font-semibold" style={{ color: statusTone.text }}>
                {statusTitle}
              </p>
              <p className="mt-1 text-sm leading-5" style={{ color: textSecondary }}>
                {statusMessage}
              </p>
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !readyToRent}
            className="h-12 w-full rounded-2xl text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: readyToRent ? "#10b981" : (isDarkMode ? "#334155" : "#94a3b8"),
            }}
          >
            {primaryButtonLabel}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-2xl text-sm font-medium transition-colors active:opacity-80"
            style={{ color: textMuted }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
