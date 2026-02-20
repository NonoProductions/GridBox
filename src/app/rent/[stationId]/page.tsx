"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePageTheme } from "@/lib/usePageTheme";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import { Station } from "@/components/StationManager";
import { notifyRentalSuccess } from "@/lib/notifications";

export const dynamic = 'force-dynamic';

function RentPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationId = params.stationId as string;
  
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDarkMode = usePageTheme(searchParams);

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
          setError("Ungültige Station-ID");
          setLoading(false);
          return;
        }

        const isShortCode = /^[A-Z0-9]{4}$/i.test(sanitizedStationId);
        let query = supabase
          .from('stations')
          .select('*')
          .eq('is_active', true);

        if (isShortCode) {
          query = query.ilike('short_code', sanitizedStationId);
        } else {
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(sanitizedStationId)) {
            setError("Ungültige Station-ID");
            setLoading(false);
            return;
          }
          query = query.eq('id', sanitizedStationId);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError(`Station „${stationId}" nicht gefunden`);
          } else {
            setError("Station konnte nicht geladen werden.");
          }
          setLoading(false);
          return;
        }

        setStation(data);

        // Sofort aktuelle Batterie-Daten nachladen (wie im Dashboard), damit Anzeige stimmt
        if (data?.id) {
          let { data: fresh, error: freshError } = await supabase
            .from('stations')
            .select('powerbank_id, battery_voltage, battery_percentage')
            .eq('id', data.id)
            .single();
          const missingPowerbankColumn =
            !!freshError &&
            `${freshError.code ?? ''} ${freshError.message ?? ''} ${freshError.details ?? ''}`.toLowerCase().includes('powerbank_id');
          if (missingPowerbankColumn) {
            const legacy = await supabase
              .from('stations')
              .select('battery_voltage, battery_percentage')
              .eq('id', data.id)
              .single();
            fresh = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
          }
          if (fresh) {
            setStation((prev) => prev ? {
              ...prev,
              powerbank_id: fresh.powerbank_id,
              battery_voltage: fresh.battery_voltage,
              battery_percentage: fresh.battery_percentage,
            } : null);
          }
        }
      } catch {
        setError('Station konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId]);

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${
        isDarkMode ? "bg-[#0f1419]" : "bg-slate-50"
      }`}>
        <div className="size-12 rounded-full border-[3px] border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className={`text-base font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          Station wird geladen…
        </p>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 p-6 ${
        isDarkMode ? "bg-[#0f1419]" : "bg-slate-50"
      }`}>
        <div className={`w-full max-w-sm rounded-2xl p-6 text-center shadow-lg ${
          isDarkMode ? "bg-slate-800/80 text-white" : "bg-white text-slate-900"
        }`}>
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-1">Station nicht gefunden</h1>
          <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {error}
          </p>
          <button
            onClick={() => router.push(`/?theme=${isDarkMode ? "dark" : "light"}`)}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-[#0f1419]" : "bg-slate-50"}`}>
      <RentalConfirmationModal
        station={station}
        onClose={() => router.push('/')}
        onConfirm={async () => {
          // 1. Aktuellen User holen
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            throw new Error('Bitte melden Sie sich an, um eine Powerbank auszuleihen.');
          }

          // 2. available_units anhand der Batterie-Daten synchronisieren,
          //    damit der RPC-Check (available_units > 0) korrekt funktioniert
          let { data: batteryCheck, error: batteryCheckError } = await supabase
            .from('stations')
            .select('powerbank_id, battery_voltage, battery_percentage, available_units')
            .eq('id', station.id)
            .single();

          const missingPowerbankColumnInCheck =
            !!batteryCheckError &&
            `${batteryCheckError.code ?? ''} ${batteryCheckError.message ?? ''} ${batteryCheckError.details ?? ''}`.toLowerCase().includes('powerbank_id');

          if (missingPowerbankColumnInCheck) {
            const legacy = await supabase
              .from('stations')
              .select('battery_voltage, battery_percentage, available_units')
              .eq('id', station.id)
              .single();
            batteryCheck = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
          }

          if (batteryCheck) {
            const hasPowerbankId = typeof batteryCheck.powerbank_id === 'string' && batteryCheck.powerbank_id.trim().length > 0;
            const hasLegacyBattery = batteryCheck.battery_voltage != null && batteryCheck.battery_percentage != null;
            const shouldBeAvailable = hasPowerbankId || hasLegacyBattery ? 1 : 0;
            if ((batteryCheck.available_units ?? 0) < shouldBeAvailable) {
              await supabase
                .from('stations')
                .update({ available_units: shouldBeAvailable })
                .eq('id', station.id);
            }
          }

          // 3. Geolocation holen
          const getPosition = () =>
            new Promise<GeolocationPosition>((resolve, reject) => {
              if (!navigator.geolocation) {
                reject(new Error('Geolocation wird von deinem Gerät/Browser nicht unterstützt.'));
                return;
              }
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
              });
            });

          let userLat: number;
          let userLng: number;

          try {
            const position = await getPosition();
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
          } catch {
            throw new Error('Standort konnte nicht ermittelt werden. Bitte Standortzugriff erlauben und erneut versuchen.');
          }

          // 4. Ausleihe über RPC erstellen
          const callCreateRental = async () => {
            const withGeo = await supabase.rpc('create_rental', {
              p_user_id: user.id,
              p_station_id: station.id,
              p_user_lat: userLat,
              p_user_lng: userLng,
            });

            if (!withGeo.error) {
              return withGeo;
            }

            const raw = `${withGeo.error.code ?? ''} ${withGeo.error.message ?? ''} ${withGeo.error.details ?? ''}`;
            const missingGeoOverload =
              withGeo.error.code === 'PGRST202' ||
              raw.includes('does not exist') ||
              raw.includes('create_rental(uuid,uuid,double precision,double precision)') ||
              raw.includes('create_rental(p_user_id, p_station_id, p_user_lat, p_user_lng)');

            if (!missingGeoOverload) {
              return withGeo;
            }

            return supabase.rpc('create_rental', {
              p_user_id: user.id,
              p_station_id: station.id,
            });
          };

          let { data: rentalData, error: rentalError } = await callCreateRental();

          // Retry bei möglicher Race Condition:
          // Batterie ist schon erkannt, available_units aber noch nicht synchron.
          if (rentalError?.message?.includes('NO_UNITS_AVAILABLE')) {
            let { data: freshStation, error: freshStationError } = await supabase
              .from('stations')
              .select('powerbank_id, battery_voltage, battery_percentage, available_units')
              .eq('id', station.id)
              .maybeSingle();

            const missingPowerbankColumnInRetry =
              !!freshStationError &&
              `${freshStationError.code ?? ''} ${freshStationError.message ?? ''} ${freshStationError.details ?? ''}`.toLowerCase().includes('powerbank_id');

            if (missingPowerbankColumnInRetry) {
              const legacy = await supabase
                .from('stations')
                .select('battery_voltage, battery_percentage, available_units')
                .eq('id', station.id)
                .maybeSingle();
              freshStation = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
            }

            const hasPowerbankNow =
              (typeof freshStation?.powerbank_id === 'string' && freshStation.powerbank_id.trim().length > 0) ||
              (freshStation?.battery_voltage != null && freshStation?.battery_percentage != null);

            if (hasPowerbankNow) {
              await supabase
                .from('stations')
                .update({ available_units: 1 })
                .eq('id', station.id);

              ({ data: rentalData, error: rentalError } = await callCreateRental());
            }
          }

          if (rentalError) {
            const msg = (rentalError.message ?? '') + (rentalError.details ? ` ${rentalError.details}` : '') + (rentalError.hint ? ` (${rentalError.hint})` : '');
            console.error('create_rental Fehler:', { message: rentalError.message, details: rentalError.details, code: rentalError.code, full: rentalError });
            if (msg.includes('Unauthorized')) throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
            if (msg.includes('Wallet nicht gefunden')) throw new Error('Kein Wallet gefunden. Bitte kontaktieren Sie den Support.');
            if (msg.includes('MIN_BALANCE')) throw new Error('Du benötigst mindestens 5,00 € Guthaben, um eine Powerbank auszuleihen.');
            if (msg.includes('OUT_OF_RANGE')) throw new Error('Du bist zu weit von der Station entfernt (max. 100 m). Bitte näher an die Station gehen.');
            if (msg.includes('STATION_NOT_FOUND')) throw new Error('Station wurde nicht gefunden.');
            if (msg.includes('STATION_INACTIVE')) throw new Error('Diese Station ist derzeit nicht aktiv.');
            if (msg.includes('NO_UNITS_AVAILABLE')) throw new Error('Leider sind an dieser Station aktuell keine Powerbanks verfügbar.');
            if (msg.includes('HAS_ACTIVE_RENTAL')) throw new Error('Du hast bereits eine aktive Powerbank-Ausleihe. Bitte gib diese zuerst zurück.');
            if (msg.includes('Keine verfügbare Powerbank')) throw new Error('Leider sind an dieser Station aktuell keine Powerbanks verfügbar.');
            if (msg.includes('bereits eine aktive Powerbank-Ausleihe')) throw new Error('Du hast bereits eine aktive Powerbank-Ausleihe. Bitte gib diese zuerst zurück.');
            if (msg.includes('does not exist') || msg.includes('42703')) throw new Error('Datenbank-Konfigurationsfehler. Bitte den Support kontaktieren.');
            throw new Error(rentalError.message || 'Fehler beim Erstellen der Ausleihe. Bitte versuchen Sie es erneut.');
          }

          if (!rentalData || !rentalData.success) {
            console.error('create_rental unerwartete Antwort:', rentalData);
            throw new Error('Ausleihe konnte nicht erstellt werden.');
          }

          // 5. Push-Benachrichtigung (Fehler hier nicht weiterleiten)
          await notifyRentalSuccess(station.name, '/').catch(() => {});
        }}
        onPickupComplete={() => {
          router.push(`/?theme=${isDarkMode ? "dark" : "light"}`);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default function RentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f1419]">
        <div className="size-12 rounded-full border-[3px] border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-base font-medium text-slate-300">Station wird geladen…</p>
      </div>
    }>
      <RentPageContent />
    </Suspense>
  );
}
