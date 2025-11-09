"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import { Station } from "@/components/StationManager";

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
        // Prüfe ob es ein 4-stelliger Short-Code ist
        const isShortCode = /^[A-Z0-9]{4}$/i.test(stationId);
        
        let query = supabase
          .from('stations')
          .select('*')
          .eq('is_active', true);
        
        // Suche nach Short-Code oder UUID
        if (isShortCode) {
          query = query.ilike('short_code', stationId);
        } else {
          query = query.eq('id', stationId);
        }
        
        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          console.error('Fehler beim Laden der Station:', fetchError);
          setError('Station nicht gefunden oder nicht aktiv');
          setLoading(false);
          return;
        }

        setStation(data);
      } catch (err) {
        console.error('Fehler:', err);
        setError('Ein Fehler ist aufgetreten');
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
          
          // TODO: Hier die tatsächliche Ausleih-Logik implementieren
          // z.B. Ausleihe in der Datenbank speichern, Powerbank reservieren, etc.
          
          // Erfolgsmeldung
          alert(`Powerbank erfolgreich an Station "${station.name}" ausgeliehen!${!userName ? '' : `\n\nBestätigung wurde an ${userEmail} gesendet.`}`);
          
          // Zur Startseite navigieren
          router.push('/');
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

