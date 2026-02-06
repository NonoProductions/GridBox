"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePageTheme } from "@/lib/usePageTheme";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import { Station } from "@/components/StationManager";
import { notifyRentalSuccess, notifyRentalError } from "@/lib/notifications";

// Force dynamic rendering
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

  // Lade Station-Daten
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
        onConfirm={async (userEmail?: string, userName?: string) => {
          try {
            // Hole aktuellen User
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
              throw new Error('Bitte melden Sie sich an, um eine Powerbank auszuleihen.');
            }

            // Validate station ID format
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidPattern.test(station.id)) {
              throw new Error('Ungültige Station-ID.');
            }
            
            // Prüfe ob User bereits eine aktive Ausleihe hat
            const { data: activeRental, error: checkError } = await supabase
              .from('rentals')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (checkError) {
              console.error('Error checking active rentals:', checkError);
              throw new Error('Fehler beim Prüfen der Ausleihen.');
            }

            if (activeRental) {
              throw new Error('Sie haben bereits eine aktive Powerbank-Ausleihe. Bitte geben Sie diese zuerst zurück.');
            }

            // Validate station is still active before creating rental
            const { data: stationCheck, error: stationCheckError } = await supabase
              .from('stations')
              .select('id, is_active')
              .eq('id', station.id)
              .single();

            if (stationCheckError || !stationCheck) {
              throw new Error('Station nicht gefunden.');
            }

            if (!stationCheck.is_active) {
              throw new Error('Station ist derzeit nicht aktiv.');
            }

            // Hole aktuelle Wallet-Balance für Mindest-Guthaben-Check (5 €)
            const { data: walletData, error: walletError } = await supabase
              .from('wallets')
              .select('balance')
              .eq('user_id', user.id)
              .single();

            if (walletError || !walletData) {
              throw new Error('Wallet konnte nicht geladen werden.');
            }

            const currentBalance = parseFloat(walletData.balance);
            if (isNaN(currentBalance) || currentBalance < 5) {
              throw new Error('Du benötigst mindestens 5,00 € Guthaben, um eine Powerbank auszuleihen.');
            }

            // Hole aktuelle Benutzer-Position (für 100m-Radius-Check)
            const getPosition = () =>
              new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation wird von deinem Gerät/Browser nicht unterstützt.'));
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => resolve(pos),
                  (err) => reject(err),
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
              });

            let userLat: number;
            let userLng: number;

            try {
              const position = await getPosition();
              userLat = position.coords.latitude;
              userLng = position.coords.longitude;
            } catch (geoError) {
              console.error('Geolocation Error:', geoError);
              throw new Error('Standort konnte nicht ermittelt werden. Bitte Standortzugriff erlauben und erneut versuchen.');
            }

            // Erstelle die Ausleihe über die Datenbankfunktion (mit Geo- und Guthaben-Check im Backend)
            const { data: rentalData, error: rentalError } = await supabase.rpc('create_rental', {
              p_user_id: user.id,
              p_station_id: station.id,
              p_user_lat: userLat,
              p_user_lng: userLng,
            });

            if (rentalError) {
              console.error('Error creating rental:', rentalError);
              const msg = rentalError.message || '';

              // Freundliche Fehlermeldungen basierend auf den Exceptions aus der DB-Funktion
              if (msg.includes('MIN_BALANCE')) {
                throw new Error('Du benötigst mindestens 5,00 € Guthaben, um eine Powerbank auszuleihen.');
              }
              if (msg.includes('OUT_OF_RANGE')) {
                throw new Error('Du bist zu weit von der Station entfernt (max. 100m). Bitte näher an die Station gehen.');
              }
              if (msg.includes('STATION_NOT_FOUND')) {
                throw new Error('Station wurde nicht gefunden.');
              }
              if (msg.includes('STATION_INACTIVE')) {
                throw new Error('Diese Station ist derzeit nicht aktiv.');
              }
              if (msg.includes('NO_UNITS_AVAILABLE')) {
                throw new Error('Leider sind an dieser Station aktuell keine Powerbanks verfügbar.');
              }
              if (msg.includes('HAS_ACTIVE_RENTAL')) {
                throw new Error('Du hast bereits eine aktive Powerbank-Ausleihe. Bitte gib diese zuerst zurück.');
              }

              throw new Error('Fehler beim Erstellen der Ausleihe. Bitte versuchen Sie es erneut.');
            }

            if (!rentalData || !rentalData.success) {
              throw new Error('Ausleihe konnte nicht erstellt werden.');
            }

            // Push-Benachrichtigung senden
            await notifyRentalSuccess(station.name, '/');
            
            // Erfolgsmeldung
            alert(`Powerbank erfolgreich an Station "${station.name}" ausgeliehen!${!userName ? '' : `\n\nBestätigung wurde an ${userEmail} gesendet.`}`);
            
            // Zur Startseite navigieren
            router.push(`/?theme=${isDarkMode ? "dark" : "light"}`);
          } catch (error) {
            console.error('Fehler bei der Ausleihe:', error);
            const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Ausleihe. Bitte versuchen Sie es erneut.';
            await notifyRentalError(errorMessage);
            alert(errorMessage);
          }
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

