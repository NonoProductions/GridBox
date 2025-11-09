"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Station {
  id: string;
  name: string;
  address: string;
  availablePowerbanks: number;
  totalPowerbanks: number;
  distance?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface ReservationData {
  station: Station | null;
  date: string;
  time: string;
}

function ReservierungContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1); // 1: Station, 2: Datum/Zeit, 3: Bestätigung
  const [reservationData, setReservationData] = useState<ReservationData>({
    station: null,
    date: "",
    time: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

  // Sample stations data
  const stations: Station[] = [
    {
      id: "1",
      name: "Hauptbahnhof",
      address: "Bahnhofplatz 1, 8001 Zürich",
      availablePowerbanks: 8,
      totalPowerbanks: 12,
      distance: "0.5 km",
      coordinates: { lat: 47.3769, lng: 8.5417 }
    },
    {
      id: "2",
      name: "Universität Zürich",
      address: "Rämistrasse 71, 8006 Zürich",
      availablePowerbanks: 5,
      totalPowerbanks: 8,
      distance: "1.2 km",
      coordinates: { lat: 47.3744, lng: 8.5486 }
    },
    {
      id: "3",
      name: "Shopping Center Glatt",
      address: "Glattzentrum, 8152 Opfikon",
      availablePowerbanks: 12,
      totalPowerbanks: 15,
      distance: "3.1 km",
      coordinates: { lat: 47.4319, lng: 8.5656 }
    },
    {
      id: "4",
      name: "Flughafen Zürich",
      address: "Flughafen Zürich, 8058 Zürich",
      availablePowerbanks: 3,
      totalPowerbanks: 10,
      distance: "8.7 km",
      coordinates: { lat: 47.4647, lng: 8.5492 }
    },
    {
      id: "5",
      name: "Bahnhof Stadelhofen",
      address: "Stadelhoferplatz, 8001 Zürich",
      availablePowerbanks: 6,
      totalPowerbanks: 8,
      distance: "0.8 km",
      coordinates: { lat: 47.3667, lng: 8.5500 }
    }
  ];

  // Pricing model: 5 cents per minute + 10 cents activation fee
  const pricePerMinute = 0.05; // 5 cents
  const activationFee = 0.10; // 10 cents

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get minimum time (current time + 1 hour)
  const getMinTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
  };

  const handleStationSelect = (station: Station) => {
    // Animation: Markiere die ausgewählte Station
    setSelectedStationId(station.id);
    
    // Warte kurz für die Animation, dann gehe zum nächsten Schritt
    setTimeout(() => {
      setReservationData(prev => ({ ...prev, station }));
      setCurrentStep(2);
      setSelectedStationId(null);
    }, 400);
  };

  const handleDateTimeSelect = () => {
    if (reservationData.date && reservationData.time) {
      setCurrentStep(3);
    }
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reservationData.station || !reservationData.date || !reservationData.time) return;

    setLoading(true);
    
    // Store station name for use in setTimeout callback
    const stationName = reservationData.station.name;
    const reservationDate = reservationData.date;
    const reservationTime = reservationData.time;
    
    // Simulate API call
    setTimeout(() => {
      setSuccess(`Reservierung erfolgreich! Powerbank an Station ${stationName} ist für ${reservationDate} um ${reservationTime} reserviert. Kosten: ${activationFee.toFixed(2)}€ Aktivierung + ${pricePerMinute.toFixed(2)}€ pro Minute.`);
      setLoading(false);
      
      // Hide success message after 5 seconds and redirect
      setTimeout(() => {
        setSuccess(null);
        router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`);
      }, 5000);
    }, 2000);
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date || !time) return "";
    const dateObj = new Date(date);
    const day = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${day} um ${time} Uhr`;
  };

  return (
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else {
              router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`);
            }
          }}
          aria-label="Zurück"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm ${
            isDarkMode 
              ? 'bg-white/20 text-white hover:bg-white/30' 
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 pt-4">
        {/* Success message */}
        {success && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode 
              ? 'border-green-800 bg-green-900/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {success}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep
                  ? 'bg-emerald-600 text-white'
                  : isDarkMode
                    ? 'bg-white/20 text-white/60'
                    : 'bg-slate-200 text-slate-500'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  step < currentStep ? 'bg-emerald-600' : isDarkMode ? 'bg-white/20' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            {currentStep === 1 && "Station auswählen"}
            {currentStep === 2 && "Datum & Zeit wählen"}
            {currentStep === 3 && "Reservierung bestätigen"}
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            {currentStep === 1 && "Wähle eine Station in deiner Nähe"}
            {currentStep === 2 && "Wann möchtest du die Powerbank abholen?"}
            {currentStep === 3 && "Überprüfe deine Reservierung"}
          </p>
        </div>

        {/* Step 1: Station Selection */}
        {currentStep === 1 && (
          <div className={`rounded-xl border p-4 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Verfügbare Stationen
            </h3>
            
            <div className="space-y-3">
              {stations.map((station) => (
                <div
                  key={station.id}
                  onClick={() => handleStationSelect(station)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer transform ${
                    selectedStationId === station.id
                      ? 'scale-95 ring-4 ring-emerald-500/50 border-emerald-500 bg-emerald-500/10'
                      : isDarkMode
                        ? 'border-white/20 bg-white/5 hover:bg-white/10 hover:scale-[1.02] hover:shadow-lg'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                  style={{
                    animation: selectedStationId === station.id ? 'pulse-select 0.4s ease-in-out' : undefined
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`grid place-items-center h-10 w-10 rounded-full bg-emerald-100 transition-all duration-300 ${
                          selectedStationId === station.id ? 'scale-110 bg-emerald-200' : ''
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-600 transition-all duration-300 ${
                            selectedStationId === station.id ? 'scale-110' : ''
                          }`}>
                            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div>
                          <div className={`font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            {station.name}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            {station.address}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-slate-500'
                            }`}>
                              {station.availablePowerbanks} von {station.totalPowerbanks} verfügbar
                            </span>
                          </div>
                          {station.distance && (
                            <div className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-slate-500'
                            }`}>
                              {station.distance}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-emerald-600 text-sm font-medium">
                          Verfügbar
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {currentStep === 2 && reservationData.station && (
          <div className={`rounded-xl border p-4 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Wann möchtest du die Powerbank abholen?
            </h3>
            
            {/* Selected Station */}
            <div className={`p-3 rounded-xl mb-4 ${
              isDarkMode ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                    <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {reservationData.station.name}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    {reservationData.station.address}
                  </div>
                </div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-white/90' : 'text-slate-700'
              }`}>
                Datum
              </label>
              <input
                type="date"
                min={getTodayDate()}
                value={reservationData.date}
                onChange={(e) => setReservationData(prev => ({ ...prev, date: e.target.value }))}
                className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 ${
                  isDarkMode 
                    ? 'bg-white/10 border-white/20 text-white focus:ring-emerald-900/40' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-emerald-500/40'
                }`}
              />
            </div>

            {/* Time Selection */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-white/90' : 'text-slate-700'
              }`}>
                Uhrzeit
              </label>
              <input
                type="time"
                min={reservationData.date === getTodayDate() ? getMinTime() : "00:00"}
                value={reservationData.time}
                onChange={(e) => setReservationData(prev => ({ ...prev, time: e.target.value }))}
                className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 ${
                  isDarkMode 
                    ? 'bg-white/10 border-white/20 text-white focus:ring-emerald-900/40' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-emerald-500/40'
                }`}
              />
            </div>

            {/* Pricing Info */}
            <div className={`p-4 rounded-xl mb-4 ${
              isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-full bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Pay-per-Use
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    {activationFee.toFixed(2)}€ Aktivierung + {pricePerMinute.toFixed(2)}€ pro Minute
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={handleDateTimeSelect}
              disabled={!reservationData.date || !reservationData.time}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium shadow hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              Weiter zur Bestätigung
            </button>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && reservationData.station && (
          <form onSubmit={handleReservation} className={`rounded-xl border p-4 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Reservierung bestätigen
            </h3>
            
            {/* Reservation Summary */}
            <div className={`p-4 rounded-xl mb-4 ${
              isDarkMode ? 'bg-white/5' : 'bg-white'
            }`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Station
                  </span>
                  <span className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {reservationData.station.name}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Datum & Zeit
                  </span>
                  <span className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {formatDateTime(reservationData.date, reservationData.time)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Aktivierungsgebühr
                  </span>
                  <span className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    €{activationFee.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Preis pro Minute
                  </span>
                  <span className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    €{pricePerMinute.toFixed(2)}
                  </span>
                </div>
                
                <div className="border-t border-slate-200 dark:border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      Zahlung
                    </span>
                    <span className="text-emerald-600 font-bold text-lg">
                      Pay-per-Use
                    </span>
                  </div>
                  <div className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Einmalige Aktivierung + Minutenpreis
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium shadow hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Reserviere...</span>
                </div>
              ) : (
                'Reservierung bestätigen'
              )}
            </button>
          </form>
        )}

        {/* Info Section */}
        {currentStep === 1 && (
          <div className={`rounded-xl border p-4 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-3 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              So funktioniert&apos;s
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  1
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Station auswählen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Wähle eine Station in deiner Nähe
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  2
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Datum & Zeit wählen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Wann möchtest du die Powerbank abholen?
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  3
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Reservierung bestätigen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Bestätige deine Reservierung - 10¢ Aktivierung + 5¢/Min
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReservierungPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <ReservierungContent />
    </Suspense>
  );
}
