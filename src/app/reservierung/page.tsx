"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  photo_url?: string;
}

interface ReservationData {
  station: Station | null;
  date: string;
  time: string;
}

function ReservierungContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [reservationData, setReservationData] = useState<ReservationData>({
    station: null,
    date: "",
    time: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [existingReservation, setExistingReservation] = useState<{
    id: string;
    station_id: string;
    station_name: string;
    station_address: string;
    reserved_at: string;
    status: string;
    station_lat?: number;
    station_lng?: number;
  } | null>(null);
  const [reservationLoading, setReservationLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const initializeTheme = () => {
      if (typeof window === "undefined") return;
      
      // Check URL parameter first (for navigation from other pages)
      const themeParam = searchParams.get("theme");
      if (themeParam === "light" || themeParam === "dark") {
        const shouldBeDark = themeParam === "dark";
        setIsDarkMode(shouldBeDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
        localStorage.setItem("theme", themeParam);
        return;
      }
      
      // Otherwise use localStorage or system preference
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldBeDark = saved ? saved === "dark" : prefersDark;
      
      setIsDarkMode(shouldBeDark);
      document.documentElement.classList.toggle("dark", shouldBeDark);
    };

    initializeTheme();

    // Listen for storage changes (e.g., from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme") {
        const newTheme = e.newValue;
        const shouldBeDark = newTheme === "dark";
        setIsDarkMode(shouldBeDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
      }
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("theme");
      // Only update if no manual preference is saved
      if (!saved) {
        setIsDarkMode(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [searchParams]);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation wird von diesem Browser nicht unterstützt');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        console.log('Benutzerstandort erhalten:', { lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('Geolocation Fehler:', error);
        // Kein Fallback, da Distanz optional ist
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 300000,
        timeout: 10000
      }
    );
  }, []);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Format distance for display
  const formatDistance = (distanceInMeters: number): string => {
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)} m`;
    } else {
      return `${(distanceInMeters / 1000).toFixed(1)} km`;
    }
  };

  // Load existing reservation
  useEffect(() => {
    const loadReservation = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        setReservationLoading(false);
        return;
      }

      // Lade aktive/pending Reservierung
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .select(`
          id,
          station_id,
          reserved_at,
          status,
          stations(id, name, address, lat, lng)
        `)
        .eq("user_id", u.id)
        .in("status", ["pending", "confirmed"])
        .order("reserved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resError && reservation && reservation.stations) {
        const station = Array.isArray(reservation.stations) ? reservation.stations[0] : reservation.stations;
        setExistingReservation({
          id: reservation.id,
          station_id: reservation.station_id,
          station_name: station.name,
          station_address: station.address || "",
          reserved_at: reservation.reserved_at,
          status: reservation.status,
          station_lat: station.lat,
          station_lng: station.lng
        });
      }

      setReservationLoading(false);
    };

    loadReservation();
  }, []);

  // Auth check & load stations
  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u ? { id: u.id } : null);
      setAuthChecked(true);

      if (!u) {
        setStationsLoading(false);
        return;
      }

      setStationsLoading(true);
      setStationsError(null);
      const { data, error } = await supabase
        .from("stations")
        .select("id, name, address, available_units, total_units, lat, lng, photo_url")
        .eq("is_active", true)
        .order("name");

      if (error) {
        setStationsError("Stationen konnten nicht geladen werden.");
        setStations([]);
      } else {
        let stationsWithDistance = (data || []).map((s: { id: string; name: string; address?: string; available_units?: number; total_units?: number; lat: number; lng: number; photo_url?: string }) => {
          const station = {
            id: s.id,
            name: s.name,
            address: s.address || "",
            availablePowerbanks: s.available_units ?? 0,
            totalPowerbanks: s.total_units ?? 0,
            coordinates: { lat: Number(s.lat), lng: Number(s.lng) },
            photo_url: s.photo_url
          };

          // Calculate distance if user location is available
          if (userLocation) {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              station.coordinates.lat,
              station.coordinates.lng
            );
            return {
              ...station,
              distance: formatDistance(distance),
              distanceInMeters: distance
            };
          }

          return station;
        });

        // Sort by distance if available, otherwise by name
        if (userLocation) {
          stationsWithDistance.sort((a, b) => {
            const distA = (a as Station & { distanceInMeters?: number }).distanceInMeters ?? Infinity;
            const distB = (b as Station & { distanceInMeters?: number }).distanceInMeters ?? Infinity;
            return distA - distB;
          });
        }

        setStations(stationsWithDistance);
      }
      setStationsLoading(false);
    };
    init();
  }, [userLocation]);

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
    if (!user) {
      setReservationError("Bitte melde dich an.");
      return;
    }

    setLoading(true);
    setReservationError(null);

    // Prüfe ob User bereits eine aktive Ausleihe hat
    const { data: activeRental, error: checkError } = await supabase
      .from('rentals')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (checkError) {
      setReservationError("Fehler beim Prüfen der Ausleihen.");
      setLoading(false);
      return;
    }

    if (activeRental) {
      setReservationError("Sie haben bereits eine aktive Powerbank-Ausleihe. Bitte geben Sie diese zuerst zurück.");
      setLoading(false);
      return;
    }

    const reservedAt = new Date(`${reservationData.date}T${reservationData.time}:00`).toISOString();
    const now = new Date();
    const reservationTime = new Date(reservedAt);
    
    // Prüfe ob Reservierungszeit in der Zukunft liegt
    if (reservationTime <= now) {
      setReservationError("Die Reservierungszeit muss in der Zukunft liegen.");
      setLoading(false);
      return;
    }

    // Prüfe ob mindestens 1 Stunde in der Zukunft
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (reservationTime < oneHourFromNow) {
      setReservationError("Reservierungen müssen mindestens 1 Stunde im Voraus gebucht werden.");
      setLoading(false);
      return;
    }

    // Erstelle die Reservierung
    // Die Datenbankfunktion wird automatisch einen Slot sperren, wenn wir 1 Stunde vor der Zeit sind
    const { data: reservationData_result, error } = await supabase
      .from("reservations")
      .insert({
        user_id: user.id,
        station_id: reservationData.station.id,
        reserved_at: reservedAt,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      setReservationError(error.message || "Reservierung fehlgeschlagen.");
      setLoading(false);
      return;
    }

    // Wenn die Reservierung in weniger als 1 Stunde ist, sperre sofort einen Slot
    const oneHourBeforeReservation = new Date(reservationTime.getTime() - 60 * 60 * 1000);
    if (oneHourBeforeReservation <= now) {
      // Finde einen freien Slot und sperre ihn
      const { data: availableSlot, error: slotError } = await supabase
        .from('slots')
        .select('id')
        .eq('station_id', reservationData.station.id)
        .eq('state', 'free')
        .limit(1)
        .single();

      if (!slotError && availableSlot) {
        // Sperre den Slot
        await supabase
          .from('slots')
          .update({ state: 'locked' })
          .eq('id', availableSlot.id);

        // Aktualisiere die Reservierung mit slot_id
        await supabase
          .from('reservations')
          .update({ slot_id: availableSlot.id })
          .eq('id', reservationData_result.id);
      }
    }

    const stationName = reservationData.station.name;
    const day = new Date(reservationData.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    
    // Lade die erstellte Reservierung neu, um sie anzuzeigen
    const { data: newReservation } = await supabase
      .from("reservations")
      .select(`
        id,
        station_id,
        reserved_at,
        status,
        stations(id, name, address, lat, lng)
      `)
      .eq("id", reservationData_result.id)
      .single();

    if (newReservation && newReservation.stations) {
      const station = Array.isArray(newReservation.stations) ? newReservation.stations[0] : newReservation.stations;
      setExistingReservation({
        id: newReservation.id,
        station_id: newReservation.station_id,
        station_name: station.name,
        station_address: station.address || "",
        reserved_at: newReservation.reserved_at,
        status: newReservation.status,
        station_lat: station.lat,
        station_lng: station.lng
      });
    }

    setLoading(false);
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date || !time) return "";
    const dateObj = new Date(date);
    const day = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${day} um ${time} Uhr`;
  };

  const formatReservationDateTime = (reservedAt: string) => {
    const date = new Date(reservedAt);
    const day = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${day} um ${time} Uhr`;
  };

  // Initialize Mapbox map for station location
  useEffect(() => {
    if (!existingReservation || !existingReservation.station_lat || !existingReservation.station_lng || !mapContainerRef.current) {
      return;
    }

    const initMap = async () => {
      try {
        // Dynamically import mapbox-gl
        const mapboxgl = (await import("mapbox-gl")).default;

        // Set Mapbox access token
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!accessToken) {
          console.error('Mapbox access token not found');
          return;
        }

        mapboxgl.accessToken = accessToken;

        // Import Mapbox GL CSS if not already loaded
        if (!document.querySelector('link[href*="mapbox-gl"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
          document.head.appendChild(link);
        }

        // Remove existing map if any
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Check container exists (TypeScript safety)
        if (!mapContainerRef.current) {
          console.error('Map container not found');
          return;
        }

        // Determine map style based on theme
        const lightStyle = process.env.NEXT_PUBLIC_MAPBOX_LIGHT_STYLE || 'mapbox://styles/mapbox/light-v11';
        const darkStyle = process.env.NEXT_PUBLIC_MAPBOX_DARK_STYLE || 'mapbox://styles/mapbox/dark-v11';
        const mapStyle = isDarkMode ? darkStyle : lightStyle;

        // Create map
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: mapStyle,
          center: [existingReservation.station_lng!, existingReservation.station_lat!],
          zoom: 15,
          attributionControl: false,
          pitch: 0,
          bearing: 0
        });

        // Disable rotation and pitch
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        // Wait for map to load
        map.on('load', () => {
          // Create station marker element
          const stationElement = document.createElement('div');
          stationElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path fill="#10b981" stroke="#10b981" d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
              <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="white" stroke="white"/>
            </svg>
          `;
          stationElement.style.width = '32px';
          stationElement.style.height = '32px';
          stationElement.style.cursor = 'pointer';

          // Add marker
          new mapboxgl.Marker({
            element: stationElement,
            anchor: 'bottom'
          })
            .setLngLat([existingReservation.station_lng!, existingReservation.station_lat!])
            .addTo(map);
        });

        mapRef.current = map;
      } catch (error) {
        console.error('Error initializing Mapbox map:', error);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [existingReservation]);

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current || !existingReservation) return;

    const updateMapStyle = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        const lightStyle = process.env.NEXT_PUBLIC_MAPBOX_LIGHT_STYLE || 'mapbox://styles/mapbox/light-v11';
        const darkStyle = process.env.NEXT_PUBLIC_MAPBOX_DARK_STYLE || 'mapbox://styles/mapbox/dark-v11';
        const newStyle = isDarkMode ? darkStyle : lightStyle;
        
        if (mapRef.current) {
          mapRef.current.setStyle(newStyle);
        }
      } catch (error) {
        console.error('Error updating map style:', error);
      }
    };

    updateMapStyle();
  }, [isDarkMode, existingReservation]);

  const handleCancelReservation = async () => {
    if (!existingReservation || !user) return;

    if (!confirm('Möchtest du diese Reservierung wirklich abbrechen?')) {
      return;
    }

    setCancelling(true);
    try {
      // Update reservation status to cancelled
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', existingReservation.id);

      if (updateError) {
        throw new Error(updateError.message || 'Fehler beim Abbrechen der Reservierung.');
      }

      // Reload reservations to clear the existing one
      setExistingReservation(null);
      
      // Show success message
      alert('Reservierung erfolgreich abgebrochen.');
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      alert(error instanceof Error ? error.message : 'Fehler beim Abbrechen der Reservierung.');
    } finally {
      setCancelling(false);
    }
  };

  // Wenn eine Reservierung existiert, zeige nur die Infos
  if (reservationLoading) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      </main>
    );
  }

  if (existingReservation) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
        {/* Back button */}
        <div className="absolute top-4 left-4 z-10">
          <button
            type="button"
            onClick={() => {
              const theme = isDarkMode ? "dark" : "light";
              router.push(`/app?theme=${theme}`);
            }}
            aria-label="Zurück"
            className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg transition-colors mt-[15px] mb-[15px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pt-20 pb-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]" style={{ fontSize: '26px' }}>
              Deine Reservierung
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]" style={{ fontSize: '13px' }}>
              Reservierungsdetails
            </p>
          </div>

          {/* Reservation Info Card */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="grid place-items-center h-14 w-14 rounded-xl bg-emerald-500 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-white text-xl">
                  Reservierung bestätigt
                </div>
                <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium mt-1">
                  Status: {existingReservation.status === 'pending' ? 'Ausstehend' : 'Bestätigt'}
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-white/50 dark:bg-gray-900/30 rounded-lg p-4">
              <div className="flex items-center justify-between py-2 border-b border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-sm font-medium text-slate-600 dark:text-gray-400 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                    <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                  </svg>
                  Station
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{existingReservation.station_name}</span>
              </div>
              
              {existingReservation.station_address && (
                <div className="flex items-center justify-between py-2 border-b border-emerald-200/50 dark:border-emerald-800/50">
                  <span className="text-sm font-medium text-slate-600 dark:text-gray-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Adresse
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white text-right max-w-[60%]">{existingReservation.station_address}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between py-2 border-b border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-sm font-medium text-slate-600 dark:text-gray-400 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Datum & Zeit
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-right">{formatReservationDateTime(existingReservation.reserved_at)}</span>
              </div>
              
              <div className="pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-gray-400">Aktivierungsgebühr</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">€{activationFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-gray-400">Preis pro Minute</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">€{pricePerMinute.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          {existingReservation.station_lat && existingReservation.station_lng && (
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-gray-700">
              <div 
                ref={mapContainerRef}
                className="w-full h-48 bg-slate-100 dark:bg-slate-800"
                style={{ minHeight: '192px' }}
              />
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <div className="font-medium text-slate-900 dark:text-white mb-1">
                  Wichtige Informationen
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400">
                  Deine Powerbank wird 1 Stunde vor der reservierten Zeit gesperrt und ist dann für dich verfügbar. Bitte sei pünktlich zur reservierten Zeit an der Station.
                </div>
              </div>
            </div>
          </div>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleCancelReservation}
            disabled={cancelling}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 h-12 font-semibold shadow-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                <span>Wird abgebrochen...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>Reservierung abbrechen</span>
              </>
            )}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else {
              const theme = isDarkMode ? "dark" : "light";
              router.push(`/app?theme=${theme}`);
            }
          }}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg transition-colors mt-[15px] mb-[15px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pt-20 pb-6 space-y-8">
        {reservationError && (
          <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
            {reservationError}
          </div>
        )}
        {authChecked && !user && (
          <div className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            Bitte melde dich an, um eine Reservierung vorzunehmen.{" "}
            <button
              type="button"
              onClick={() => router.push(`/login?returnUrl=${encodeURIComponent("/reservierung")}&theme=${isDarkMode ? "dark" : "light"}`)}
              className="underline font-medium"
            >
              Zum Login
            </button>
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]" style={{ fontSize: '26px' }}>
            {currentStep === 1 && "Station auswählen"}
            {currentStep === 2 && "Datum & Zeit wählen"}
            {currentStep === 3 && "Reservierung bestätigen"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]" style={{ fontSize: '13px' }}>
            {currentStep === 1 && "Wähle eine Station in deiner Nähe"}
            {currentStep === 2 && "Wann möchtest du die Powerbank abholen?"}
            {currentStep === 3 && "Überprüfe deine Reservierung"}
          </p>
        </div>

        {/* Progress Steps */}
        {user && (
        <div className="flex items-center justify-center space-x-4 -mt-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-white/20 text-slate-500 dark:text-white/60'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  step < currentStep ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-white/20'
                }`} />
              )}
            </div>
          ))}
        </div>
        )}

        {/* Step 1: Station Selection */}
        {currentStep === 1 && user && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
              Verfügbare Stationen
            </h3>
            {stationsLoading && (
              <div className="py-8 text-center text-slate-500 dark:text-gray-400">
                Stationen werden geladen…
              </div>
            )}
            {!stationsLoading && stationsError && (
              <div className="py-4 px-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
                {stationsError}
              </div>
            )}
            {!stationsLoading && !stationsError && user && stations.length === 0 && (
              <div className="py-6 text-center text-slate-500 dark:text-gray-400">
                Keine Stationen verfügbar.
              </div>
            )}
            {!stationsLoading && !stationsError && user && stations.length > 0 && (
            <div className="space-y-0">
              {stations.map((station, index) => (
                <div key={station.id}>
                  {index > 0 && (
                    <div className="border-t border-slate-200 dark:border-white/10 my-3"></div>
                  )}
                  <div
                    onClick={() => handleStationSelect(station)}
                    className={`p-4 rounded-xl transition-all duration-300 cursor-pointer transform ${
                      selectedStationId === station.id
                        ? 'scale-95 ring-4 ring-emerald-500/50 bg-emerald-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-white/10 hover:scale-[1.02]'
                    }`}
                  style={{
                    animation: selectedStationId === station.id ? 'pulse-select 0.4s ease-in-out' : undefined
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {!imageErrors.has(station.id) ? (
                          <img
                            src="/Powerbank.png"
                            alt="Powerbank"
                            className={`h-10 w-10 rounded-xl object-cover transition-all duration-300 flex-shrink-0 ${
                              selectedStationId === station.id ? 'scale-110' : ''
                            }`}
                            onError={() => {
                              setImageErrors(prev => new Set(prev).add(station.id));
                            }}
                          />
                        ) : (
                          <div className={`grid place-items-center h-10 w-10 rounded-xl bg-emerald-100 transition-all duration-300 flex-shrink-0 ${
                            selectedStationId === station.id ? 'scale-110 bg-emerald-200' : ''
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-600 transition-all duration-300 ${
                              selectedStationId === station.id ? 'scale-110' : ''
                            }`} style={{ textAlign: 'center', fontSize: '15px' }}>
                              <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                              <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor" style={{ width: '5px', height: '6px' }}/>
                            </svg>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {station.name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-gray-400">
                            {station.address}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm text-slate-500 dark:text-gray-400">
                              {station.availablePowerbanks} von {station.totalPowerbanks} verfügbar
                            </span>
                          </div>
                          {station.distance && (
                            <div className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
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
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {currentStep === 2 && reservationData.station && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
              Wann möchtest du die Powerbank abholen?
            </h3>
            
            {/* Selected Station */}
            <div className="p-3 rounded-xl mb-4 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                    <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {reservationData.station.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
                    {reservationData.station.address}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 my-4"></div>

            {/* Date Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-white/90">
                Datum
              </label>
              <input
                type="date"
                min={getTodayDate()}
                value={reservationData.date}
                onChange={(e) => setReservationData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white focus:ring-emerald-500/40 dark:focus:ring-emerald-900/40"
              />
            </div>

            {/* Time Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-white/90">
                Uhrzeit
              </label>
              <input
                type="time"
                min={reservationData.date === getTodayDate() ? getMinTime() : "00:00"}
                value={reservationData.time}
                onChange={(e) => setReservationData(prev => ({ ...prev, time: e.target.value }))}
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white focus:ring-emerald-500/40 dark:focus:ring-emerald-900/40"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 my-4"></div>

            {/* Pricing Info */}
            <div className="p-4 rounded-xl mb-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-full bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    Pay-per-Use
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
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
          <form onSubmit={handleReservation}>
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
              Reservierung bestätigen
            </h3>
            
            {/* Reservation Summary */}
            <div className="p-4 rounded-xl mb-4 bg-slate-50 dark:bg-white/5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Station
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {reservationData.station.name}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Datum & Zeit
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDateTime(reservationData.date, reservationData.time)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Aktivierungsgebühr
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    €{activationFee.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Preis pro Minute
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    €{pricePerMinute.toFixed(2)}
                  </span>
                </div>
                
                <div className="border-t border-slate-200 dark:border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Zahlung
                    </span>
                    <span className="text-emerald-600 font-bold text-lg">
                      Pay-per-Use
                    </span>
                  </div>
                  <div className="text-xs mt-1 text-slate-500 dark:text-gray-400">
                    Einmalige Aktivierung + Minutenpreis
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 my-4"></div>

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
        {currentStep === 1 && user && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white">
              So funktioniert&apos;s
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  1
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    Station auswählen
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
                    Wähle eine Station in deiner Nähe
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  2
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    Datum & Zeit wählen
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
                    Wann möchtest du die Powerbank abholen?
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                  3
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    Reservierung bestätigen
                  </div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">
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
