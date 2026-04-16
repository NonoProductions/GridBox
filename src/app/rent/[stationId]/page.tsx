"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import { Station, computeRealAvailability, isStationOnline } from "@/components/StationManager";
import { notifyRentalSuccess } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { usePageTheme } from "@/lib/usePageTheme";

export const dynamic = "force-dynamic";

const PAGE_BG_DARK = "radial-gradient(circle at top, rgba(16,185,129,0.08), transparent 42%), #081017";
const PAGE_BG_LIGHT = "radial-gradient(circle at top, rgba(16,185,129,0.08), transparent 44%), #f4faf7";

function RentPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationId = params.stationId as string;

  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDarkMode = usePageTheme(searchParams);
  const homeHref = `/?theme=${isDarkMode ? "dark" : "light"}`;

  const pageBg = isDarkMode ? PAGE_BG_DARK : PAGE_BG_LIGHT;
  const skel = isDarkMode ? "bg-white/[0.06]" : "bg-slate-100";
  const borderColor = isDarkMode ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.08)";

  useEffect(() => {
    const fetchStation = async () => {
      if (!stationId) {
        setError("Keine Station-ID angegeben");
        setLoading(false);
        return;
      }

      try {
        const sanitizedStationId = stationId.trim();
        if (!sanitizedStationId || sanitizedStationId.length > 100) {
          setError("Ungueltige Station-ID");
          setLoading(false);
          return;
        }

        const isShortCode = /^[A-Z0-9]{4}$/i.test(sanitizedStationId);
        let query = supabase
          .from("stations")
          .select("id, name, description, lat, lng, available_units, total_units, address, is_active, short_code, created_at, updated_at, photos, battery_voltage, battery_percentage, powerbank_id, slot_1_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage, slot_2_powerbank_id, slot_2_battery_voltage, slot_2_battery_percentage, charge_enabled, opening_hours, last_seen")
          .eq("is_active", true);

        if (isShortCode) {
          query = query.ilike("short_code", sanitizedStationId);
        } else {
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(sanitizedStationId)) {
            setError("Ungueltige Station-ID");
            setLoading(false);
            return;
          }
          query = query.eq("id", sanitizedStationId);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            setError(`Station "${stationId}" nicht gefunden`);
          } else {
            setError("Station konnte nicht geladen werden.");
          }
          setLoading(false);
          return;
        }

        setStation(data);
      } catch {
        setError("Station konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId]);

  /* ── Loading skeleton (full page) ── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: pageBg }}>
        <div className="flex min-h-screen flex-col px-6 mx-auto max-w-md">
          <div className="pt-5">
            <div className={`h-10 w-10 rounded-xl animate-pulse ${skel}`} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <div className={`w-44 h-44 rounded-[28px] animate-pulse ${skel}`} />
            <div className={`mt-5 h-7 w-48 rounded-lg animate-pulse ${skel}`} />
            <div className="mt-3 flex gap-2">
              <div className={`h-7 w-20 rounded-full animate-pulse ${skel}`} />
              <div className={`h-7 w-16 rounded-full animate-pulse ${skel}`} />
              <div className={`h-7 w-14 rounded-full animate-pulse ${skel}`} />
            </div>
            <div className={`mt-4 h-5 w-52 rounded-lg animate-pulse ${skel}`} />
          </div>
          <div className="pb-8 space-y-3">
            <div className={`h-16 w-full rounded-2xl animate-pulse ${skel}`} />
            <div className={`h-[52px] w-full rounded-2xl animate-pulse ${skel}`} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state (full page) ── */
  if (error || !station) {
    return (
      <div className="min-h-screen" style={{ background: pageBg }}>
        <div className="flex min-h-screen flex-col px-6 mx-auto max-w-md">
          <div className="h-10 pt-5" aria-hidden="true" />

          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl ${isDarkMode ? "bg-red-950/40" : "bg-red-50"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-center" style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }}>
              Station nicht gefunden
            </h1>
            <p className="mt-2 text-sm text-center max-w-[280px]" style={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}>
              {error}
            </p>
          </div>

          <div className="pb-8">
            <button
              onClick={() => router.push(homeHref)}
              className="h-[52px] w-full rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            >
              Zur Karte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RentalConfirmationModal
      station={station}
      onClose={() => router.push(homeHref)}
      onConfirm={async () => {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Bitte melden Sie sich an, um eine Powerbank auszuleihen.");
        }

        let { data: batteryCheck, error: batteryCheckError } = await supabase
          .from("stations")
          .select("powerbank_id, battery_voltage, battery_percentage, available_units, last_seen, updated_at")
          .eq("id", station.id)
          .single();

        const missingPowerbankColumnInCheck =
          !!batteryCheckError &&
          `${batteryCheckError.code ?? ""} ${batteryCheckError.message ?? ""} ${batteryCheckError.details ?? ""}`
            .toLowerCase()
            .includes("powerbank_id");

        if (missingPowerbankColumnInCheck) {
          const legacy = await supabase
            .from("stations")
            .select("battery_voltage, battery_percentage, available_units, last_seen, updated_at")
            .eq("id", station.id)
            .single();
          batteryCheck = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
        }

        if (batteryCheck && !isStationOnline(batteryCheck)) {
          throw new Error("Diese Station ist derzeit nicht verbunden. Bitte versuche es spaeter erneut oder waehle eine andere Station.");
        }

        if (batteryCheck) {
          const realAvailable = computeRealAvailability(batteryCheck);
          if ((batteryCheck.available_units ?? 0) < realAvailable) {
            await supabase
              .from("stations")
              .update({ available_units: realAvailable })
              .eq("id", station.id);
          }
        }

        const getPosition = () =>
          new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("Geolocation wird von deinem Geraet oder Browser nicht unterstuetzt."));
              return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 5000,
            });
          });

        let userLat: number;
        let userLng: number;

        try {
          const position = await getPosition();
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
        } catch {
          throw new Error("Standort konnte nicht ermittelt werden. Bitte Standortzugriff erlauben und erneut versuchen.");
        }

        const callCreateRental = async () => {
          const withGeo = await supabase.rpc("create_rental", {
            p_user_id: user.id,
            p_station_id: station.id,
            p_user_lat: userLat,
            p_user_lng: userLng,
          });

          if (!withGeo.error) {
            return withGeo;
          }

          const raw = `${withGeo.error.code ?? ""} ${withGeo.error.message ?? ""} ${withGeo.error.details ?? ""}`;
          const missingGeoOverload =
            withGeo.error.code === "PGRST202" ||
            raw.includes("does not exist") ||
            raw.includes("create_rental(uuid,uuid,double precision,double precision)") ||
            raw.includes("create_rental(p_user_id, p_station_id, p_user_lat, p_user_lng)");

          if (!missingGeoOverload) {
            return withGeo;
          }

          return supabase.rpc("create_rental", {
            p_user_id: user.id,
            p_station_id: station.id,
          });
        };

        let { data: rentalData, error: rentalError } = await callCreateRental();

        if (rentalError?.message?.includes("NO_UNITS_AVAILABLE")) {
          let { data: freshStation, error: freshStationError } = await supabase
            .from("stations")
            .select("powerbank_id, battery_voltage, battery_percentage, available_units, last_seen, updated_at")
            .eq("id", station.id)
            .maybeSingle();

          const missingPowerbankColumnInRetry =
            !!freshStationError &&
            `${freshStationError.code ?? ""} ${freshStationError.message ?? ""} ${freshStationError.details ?? ""}`
              .toLowerCase()
              .includes("powerbank_id");

          if (missingPowerbankColumnInRetry) {
            const legacy = await supabase
              .from("stations")
              .select("battery_voltage, battery_percentage, available_units, last_seen, updated_at")
              .eq("id", station.id)
              .maybeSingle();
            freshStation = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
          }

          if (freshStation && isStationOnline(freshStation) && computeRealAvailability(freshStation) > 0) {
            await supabase
              .from("stations")
              .update({ available_units: 1 })
              .eq("id", station.id);

            ({ data: rentalData, error: rentalError } = await callCreateRental());
          }
        }

        if (rentalError) {
          const msg =
            (rentalError.message ?? "") +
            (rentalError.details ? ` ${rentalError.details}` : "") +
            (rentalError.hint ? ` (${rentalError.hint})` : "");

          console.error("create_rental Fehler:", {
            message: rentalError.message,
            details: rentalError.details,
            code: rentalError.code,
            full: rentalError,
          });

          if (msg.includes("Unauthorized")) throw new Error("Sitzung abgelaufen. Bitte erneut anmelden.");
          if (msg.includes("Wallet nicht gefunden")) throw new Error("Kein Wallet gefunden. Bitte kontaktieren Sie den Support.");
          if (msg.includes("MIN_BALANCE")) throw new Error("Du benoetigst mindestens 5,00 EUR Guthaben, um eine Powerbank auszuleihen.");
          if (msg.includes("OUT_OF_RANGE")) throw new Error("Du bist zu weit von der Station entfernt (max. 100 m). Bitte naeher an die Station gehen.");
          if (msg.includes("STATION_NOT_FOUND")) throw new Error("Station wurde nicht gefunden.");
          if (msg.includes("STATION_INACTIVE")) throw new Error("Diese Station ist derzeit nicht aktiv.");
          if (msg.includes("NO_UNITS_AVAILABLE")) throw new Error("Leider sind an dieser Station aktuell keine Powerbanks verfuegbar.");
          if (msg.includes("HAS_ACTIVE_RENTAL")) throw new Error("Du hast bereits eine aktive Powerbank-Ausleihe. Bitte gib diese zuerst zurueck.");
          if (msg.includes("Keine verfuegbare Powerbank")) throw new Error("Leider sind an dieser Station aktuell keine Powerbanks verfuegbar.");
          if (msg.includes("bereits eine aktive Powerbank-Ausleihe")) throw new Error("Du hast bereits eine aktive Powerbank-Ausleihe. Bitte gib diese zuerst zurueck.");
          if (msg.includes("does not exist") || msg.includes("42703")) throw new Error("Datenbank-Konfigurationsfehler. Bitte den Support kontaktieren.");

          throw new Error(rentalError.message || "Fehler beim Erstellen der Ausleihe. Bitte versuchen Sie es erneut.");
        }

        if (!rentalData || !rentalData.success) {
          console.error("create_rental unerwartete Antwort:", rentalData);
          throw new Error("Ausleihe konnte nicht erstellt werden.");
        }

        await notifyRentalSuccess(station.name, "/").catch(() => {});
      }}
      onPickupComplete={() => {
        router.push(homeHref);
      }}
      isDarkMode={isDarkMode}
    />
  );
}

export default function RentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4faf7] dark:bg-[#081017]">
          <div className="flex min-h-screen flex-col px-6 mx-auto max-w-md">
            <div className="pt-5">
              <div className="h-10 w-10 rounded-xl animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center -mt-6">
              <div className="w-44 h-44 rounded-[28px] animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
              <div className="mt-5 h-7 w-48 rounded-lg animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
              <div className="mt-3 flex gap-2">
                <div className="h-7 w-20 rounded-full animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
                <div className="h-7 w-16 rounded-full animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
                <div className="h-7 w-14 rounded-full animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
              </div>
              <div className="mt-4 h-5 w-52 rounded-lg animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
            </div>
            <div className="pb-8 space-y-3">
              <div className="h-16 w-full rounded-2xl animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
              <div className="h-[52px] w-full rounded-2xl animate-pulse bg-slate-100 dark:bg-white/[0.06]" />
            </div>
          </div>
        </div>
      }
    >
      <RentPageContent />
    </Suspense>
  );
}
