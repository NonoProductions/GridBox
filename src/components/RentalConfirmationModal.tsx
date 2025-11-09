"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Station {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  available_units?: number;
  total_units?: number;
  description?: string;
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

  // Preis-Konfiguration
  const pricePerHour = 2.5; // 2,50€ pro Stunde

  // Prüfe ob Nutzer angemeldet ist
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        
        if (session?.user) {
          // Hole Nutzerdaten wenn angemeldet
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
    setLoading(true);
    setError(null);

    try {
      // Validierung für nicht angemeldete Nutzer
      if (!isAuthenticated) {
        if (!email || !name) {
          setError("Bitte geben Sie Ihren Namen und E-Mail-Adresse ein.");
          setLoading(false);
          return;
        }

        // E-Mail-Validierung
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          setError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
          setLoading(false);
          return;
        }

        if (name.trim().length < 2) {
          setError("Bitte geben Sie einen gültigen Namen ein.");
          setLoading(false);
          return;
        }
      }

      // Prüfe Verfügbarkeit
      if ((station.available_units ?? 0) <= 0) {
        setError("Leider sind momentan keine Powerbanks verfügbar.");
        setLoading(false);
        return;
      }

      // Callback mit Nutzerdaten
      await onConfirm(email, name);
      
    } catch (err) {
      console.error("Fehler bei der Bestätigung:", err);
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      setLoading(false);
    }
  };

  // Verhindere Scrollen wenn Modal offen ist
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(`${scrollY}` || '0'));
    };
  }, []);

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className={`${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-2xl max-w-md w-full shadow-2xl border ${isDarkMode ? 'border-emerald-500/20' : 'border-gray-200'} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: isDarkMode 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 100px rgba(16, 185, 129, 0.15)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Header */}
        <div className={`${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} px-6 py-4`}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">
                Powerbank ausleihen
              </h2>
              <p className="text-emerald-50 text-sm">
                Bestätigen Sie Ihre Ausleihe
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors ml-2"
              aria-label="Schließen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Station Info */}
          <div className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4 mb-6`}>
            <div className="flex items-start gap-3">
              <div className={`${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'} rounded-lg p-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={isDarkMode ? '#10b981' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
                  {station.name}
                </h3>
                {station.address && (
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {station.address}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (station.available_units ?? 0) > 0 
                      ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                  }`}>
                    {station.available_units ?? 0} / {station.total_units ?? 0} verfügbar
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preis-Info */}
          <div className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4 mb-6`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Preis pro Stunde
              </span>
              <span className={`text-2xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {pricePerHour.toFixed(2)}€
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Die Abrechnung erfolgt stundenweise. Sie können die Powerbank an jeder GridBox Station zurückgeben.
            </p>
          </div>

          {/* Auth Status & Form */}
          {isAuthenticated ? (
            <div className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-blue-50'} rounded-xl p-4 mb-6`}>
              <div className="flex items-start gap-3">
                <div className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'} mb-1`}>
                    Sie sind angemeldet
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-blue-600'}`}>
                    {email}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="name" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ihr vollständiger Name"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all`}
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all`}
                  required
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Abbrechen
            </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || (station.available_units ?? 0) <= 0}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                  loading || (station.available_units ?? 0) <= 0
                  ? isDarkMode 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Wird bestätigt...</span>
                </div>
              ) : (
                'Ausleihe bestätigen'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

