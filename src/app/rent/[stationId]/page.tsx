"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Theme aus URL-Parameter oder System
  useEffect(() => {
    const themeParam = searchParams.get("theme");
    if (themeParam === "light") {
      setIsDarkMode(false);
    } else if (themeParam === "dark") {
      setIsDarkMode(true);
    } else {
      // Prüfe System-Theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, [searchParams]);

  // Lade Station-Daten
  useEffect(() => {
    const fetchStation = async () => {
      if (!stationId) {
        setError("Keine Station-ID angegeben");
        setLoading(false);
        return;
      }

      try {
        // Debug: Log die empfangene Station-ID
        console.log('🔍 Station-ID empfangen:', stationId);
        
        // Sanitize and validate stationId
        const sanitizedStationId = stationId.trim();
        if (!sanitizedStationId || sanitizedStationId.length > 100) {
          setError("Ungültige Station-ID");
          setLoading(false);
          return;
        }
        
        // Prüfe ob es ein 4-stelliger Short-Code ist (alphanumeric only)
        const isShortCode = /^[A-Z0-9]{4}$/i.test(sanitizedStationId);
        console.log('📝 Ist Short-Code?', isShortCode);
        
        let query = supabase
          .from('stations')
          .select('*')
          .eq('is_active', true);
        
        // Suche nach Short-Code oder UUID (with validation)
        if (isShortCode) {
          console.log('🔎 Suche nach Short-Code:', sanitizedStationId);
          // Use exact match for short codes (case-insensitive)
          query = query.ilike('short_code', sanitizedStationId);
        } else {
          // Validate UUID format to prevent injection
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(sanitizedStationId)) {
            setError("Ungültige Station-ID Format");
            setLoading(false);
            return;
          }
          console.log('🔎 Suche nach UUID:', sanitizedStationId);
          query = query.eq('id', sanitizedStationId);
        }
        
        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          console.error('❌ Fehler beim Laden der Station:', fetchError);
          console.error('❌ Fehler-Details:', {
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint,
            code: fetchError.code
          });
          
          // Bessere Fehlermeldung basierend auf dem Fehlertyp
          if (fetchError.code === 'PGRST116') {
            setError(`Station mit ${isShortCode ? 'Code' : 'ID'} "${stationId}" nicht gefunden oder nicht aktiv`);
          } else {
            setError(`Station konnte nicht geladen werden: ${fetchError.message}`);
          }
          setLoading(false);
          return;
        }

        console.log('✅ Station gefunden:', data);
        setStation(data);
      } catch (err) {
        console.error('❌ Unerwarteter Fehler:', err);
        setError('Ein unerwarteter Fehler ist aufgetreten');
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
          <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Station wird geladen...
          </p>
        </div>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl ${
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        }`}>
          <div className="text-center">
            <div className="mb-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                width="64" 
                height="64" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                className="mx-auto text-red-500"
              >
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Station nicht gefunden</h1>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {error || 'Die angegebene Station existiert nicht oder ist nicht aktiv.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
            >
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <RentalConfirmationModal
        station={station}
        onClose={() => router.push('/')}
        onConfirm={async (userEmail?: string, userName?: string) => {
          console.log('✅ Ausleihe bestätigt:', { 
            stationId: station.id, 
            stationName: station.name,
            userEmail, 
            userName 
          });
          
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

            // Erstelle die Ausleihe über die Datenbankfunktion (with validated inputs)
            const { data: rentalData, error: rentalError } = await supabase.rpc('create_rental', {
              p_user_id: user.id,
              p_station_id: station.id
            });

            if (rentalError) {
              console.error('Error creating rental:', rentalError);
              // Don't leak specific database errors
              throw new Error('Fehler beim Erstellen der Ausleihe. Bitte versuchen Sie es erneut.');
            }

            if (!rentalData || !rentalData.success) {
              throw new Error('Ausleihe konnte nicht erstellt werden.');
            }

            console.log('✅ Ausleihe erfolgreich erstellt:', rentalData);
            
            // Push-Benachrichtigung senden
            await notifyRentalSuccess(station.name, '/');
            
            // Erfolgsmeldung
            alert(`Powerbank erfolgreich an Station "${station.name}" ausgeliehen!${!userName ? '' : `\n\nBestätigung wurde an ${userEmail} gesendet.`}`);
            
            // Zur Startseite navigieren
            router.push('/');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-white">Lädt...</p>
        </div>
      </div>
    }>
      <RentPageContent />
    </Suspense>
  );
}

