"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CameraOverlay from "@/components/CameraOverlay";
import SideMenu from "@/components/SideMenu";
import StationManager, { Station, isStationOnline, computeRealAvailability } from "@/components/StationManager";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import ReturnSummaryModal, { ReturnSummaryData } from "@/components/ReturnSummaryModal";
import mapboxgl from "mapbox-gl";
import { notifyRentalSuccess, notifyRentalError } from "@/lib/notifications";
import { getAbsoluteStationPhotoUrl } from "@/lib/photoUtils";
import { logger } from "@/lib/logger";

// Legacy Station type for backward compatibility
type LegacyStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  availableUnits: number;
};

// Photo Carousel Component
function PhotoCarousel({ photos, isDarkMode }: { photos: string[]; isDarkMode: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance && currentIndex < photos.length - 1) {
      // Swipe left - next photo
      setCurrentIndex(currentIndex + 1);
    } else if (distance < -minSwipeDistance && currentIndex > 0) {
      // Swipe right - previous photo
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToPhoto = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      const photoWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: currentIndex * photoWidth,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  if (photos.length === 0) return null;

  return (
    <div className="w-full">
      {/* Main large photo display with navigation */}
      <div className="relative w-full h-64 rounded-xl overflow-hidden mb-3">
        <div 
          ref={scrollContainerRef}
          className="w-full h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            scrollSnapType: 'x mandatory',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {photos.map((photo, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-full h-full"
              style={{ scrollSnapAlign: 'start' }}
            >
              <img
                src={photo}
                alt={`Station Foto ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback bei Fehler
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Navigation arrows (only show if more than 1 photo) */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={() => goToPhoto(currentIndex - 1)}
                className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-sm transition-all z-10 ${
                  isDarkMode
                    ? 'bg-black/40 text-white hover:bg-black/60'
                    : 'bg-white/80 text-gray-900 hover:bg-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            {currentIndex < photos.length - 1 && (
              <button
                onClick={() => goToPhoto(currentIndex + 1)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-sm transition-all z-10 ${
                  isDarkMode
                    ? 'bg-black/40 text-white hover:bg-black/60'
                    : 'bg-white/80 text-gray-900 hover:bg-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Photo indicators / thumbnails */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {photos.map((photo, index) => (
            <button
              key={index}
              onClick={() => goToPhoto(index)}
              className={`flex-shrink-0 transition-all ${
                currentIndex === index
                  ? 'ring-2 ring-emerald-500 ring-offset-2'
                  : 'opacity-60 hover:opacity-80'
              }`}
            >
              <img
                src={photo}
                alt={`Thumbnail ${index + 1}`}
                className="w-12 h-12 rounded-lg object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Function to check if station is currently open based on opening hours
function isStationOpen(openingHours: string | undefined): boolean {
  if (!openingHours) return true; // If no opening hours, assume always open
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
  
  // Map day numbers to German day names
  const dayNames: { [key: number]: string[] } = {
    0: ['So', 'Sonntag', 'Sun'],
    1: ['Mo', 'Montag', 'Mon'],
    2: ['Di', 'Dienstag', 'Tue'],
    3: ['Mi', 'Mittwoch', 'Wed'],
    4: ['Do', 'Donnerstag', 'Thu'],
    5: ['Fr', 'Freitag', 'Fri'],
    6: ['Sa', 'Samstag', 'Sat']
  };
  
  const currentDayNames = dayNames[currentDay] || [];
  
  // Parse opening hours string (e.g., "Mo-Fr: 8:00-18:00, Sa: 9:00-16:00")
  const parts = openingHours.split(',').map(p => p.trim());
  
  for (const part of parts) {
    // Check if current day matches
    let matchesDay = false;
    
    // Check for day ranges (Mo-Fr, Mo-Sa, etc.)
    if (part.includes('-')) {
      const [dayRange, times] = part.split(':').map(s => s.trim());
      const [startDay, endDay] = dayRange.split('-').map(d => d.trim());
      
      // Find day indices
      let startIdx = -1, endIdx = -1;
      for (let i = 0; i <= 6; i++) {
        const names = dayNames[i];
        if (names.some(n => n.toLowerCase().startsWith(startDay.toLowerCase()))) {
          startIdx = i;
        }
        if (names.some(n => n.toLowerCase().startsWith(endDay.toLowerCase()))) {
          endIdx = i;
        }
      }
      
      if (startIdx !== -1 && endIdx !== -1) {
        // Handle week wrap (e.g., Fr-Mo)
        if (startIdx > endIdx) {
          matchesDay = currentDay >= startIdx || currentDay <= endIdx;
        } else {
          matchesDay = currentDay >= startIdx && currentDay <= endIdx;
        }
      }
    } else {
      // Single day (e.g., "Mo: 8:00-18:00")
      const dayPart = part.split(':')[0].trim();
      matchesDay = currentDayNames.some(name => 
        name.toLowerCase().startsWith(dayPart.toLowerCase())
      );
    }
    
    if (matchesDay) {
      // Extract time range (e.g., "8:00-18:00")
      const timeMatch = part.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const [, startH, startM, endH, endM] = timeMatch;
        const startTime = parseInt(startH) * 60 + parseInt(startM);
        const endTime = parseInt(endH) * 60 + parseInt(endM);
        
        // Handle overnight hours (e.g., 22:00-02:00)
        if (endTime < startTime) {
          return currentTime >= startTime || currentTime <= endTime;
        } else {
          return currentTime >= startTime && currentTime <= endTime;
        }
      }
    }
  }
  
  return false; // If no match found, assume closed
}

// Internal component that handles the actual map rendering
function MapViewContent({ initialTheme }: { initialTheme: string | null }) {
  const [scanning, setScanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean | null>(null); // Start with null to wait for theme detection
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [showStationList, setShowStationList] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigationInstructions, setNavigationInstructions] = useState<string[]>([]);
  const [distanceToDestination, setDistanceToDestination] = useState<number>(0);
  const [timeToDestination, setTimeToDestination] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isFullScreenNavigation, setIsFullScreenNavigation] = useState<boolean>(false);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [isLocationFixed, setIsLocationFixed] = useState<boolean>(false);
  const [forceStationRerender, setForceStationRerender] = useState<number>(0);
  const [lastLocation, setLastLocation] = useState<{lat: number, lng: number} | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<number>(0);
  const [isFollowingLocation, setIsFollowingLocation] = useState<boolean>(false);
  const [is3DFollowing, setIs3DFollowing] = useState<boolean>(false); // Trackt ob 3D-Following aktiv ist
  const [isCentered, setIsCentered] = useState<boolean>(false); // Trackt ob gerade zentriert wurde
  const [isStationFollowingActive, setIsStationFollowingActive] = useState<boolean>(false); // Trackt ob Station-Following aktiv ist
  const [permissionRequested, setPermissionRequested] = useState<boolean>(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [showRentalModal, setShowRentalModal] = useState<boolean>(false);
  const [scannedStation, setScannedStation] = useState<Station | null>(null);
  const [compassPermissionGranted, setCompassPermissionGranted] = useState<boolean>(false);
  // Aktive Ausleihe (Timer-Banner)
  const [activeRental, setActiveRental] = useState<{
    id: string;
    station_id: string;
    started_at: string;
    start_price: number;
    price_per_minute: number;
    powerbank_id?: string | null;
  } | null>(null);
  const [returnSummary, setReturnSummary] = useState<ReturnSummaryData | null>(null);
  const [rentalNow, setRentalNow] = useState<number>(Date.now());
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stationsLayerRef = useRef<mapboxgl.Marker[]>([]);
  const routeLayerRef = useRef<string | null>(null);
  const walkingTimeLabelRef = useRef<mapboxgl.Marker | null>(null);
  const navigationLayerRef = useRef<string | null>(null);
  const navigationSourceRef = useRef<string | null>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef(false);
  // Smooth animation refs for Google Maps-style location tracking
  const animatedLocationRef = useRef<{lat: number, lng: number} | null>(null);
  const targetLocationRef = useRef<{lat: number, lng: number} | null>(null);
  const animatedHeadingRef = useRef<number>(0);
  const targetHeadingRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const headingElementRef = useRef<HTMLDivElement | null>(null);
  const locationUpdateThrottleRef = useRef<number>(0);
  const hasCompassDataRef = useRef(false);
  const orientationListenerAddedRef = useRef(false);
  const orientationThrottleRef = useRef(0);
  // Refs that mirror state to avoid stale closures inside watchPosition callback
  const isNavigatingRef = useRef(false);
  const isFollowingLocationRef = useRef(false);
  const is3DFollowingRef = useRef(false);
  const deviceOrientationRef = useRef(0);
  const compassPermissionGrantedRef = useRef(false);
  const selectedStationRef = useRef<Station | null>(null);
  const prevActiveRentalRef = useRef<string | null>(null);
  const lastLocationRef = useRef<{lat: number, lng: number} | null>(null);
  const isLocationFixedRef = useRef(false);
  // Station Manager Hook - verwende die Stationen direkt vom StationManager
  const stationManager = StationManager({ 
    onStationsUpdate: () => {}, // Leere Funktion, wir verwenden stationManager.stations direkt
    isDarkMode: isDarkMode === true 
  });

  // Verwende die Stationen direkt vom StationManager
  const stations = stationManager.stations;

  // Im Panel immer aktuelle Stationsdaten anzeigen (z. B. verfügbare Powerbanks)
  const panelStation = useMemo(
    () => (selectedStation ? (stations.find((s) => s.id === selectedStation.id) ?? selectedStation) : null),
    [stations, selectedStation]
  );

  // Keep refs in sync with state (avoids stale closures in watchPosition callback)
  useEffect(() => { isNavigatingRef.current = isNavigating; }, [isNavigating]);
  useEffect(() => { isFollowingLocationRef.current = isFollowingLocation; }, [isFollowingLocation]);
  useEffect(() => { is3DFollowingRef.current = is3DFollowing; }, [is3DFollowing]);
  useEffect(() => { deviceOrientationRef.current = deviceOrientation; }, [deviceOrientation]);
  useEffect(() => { compassPermissionGrantedRef.current = compassPermissionGranted; }, [compassPermissionGranted]);
  useEffect(() => { selectedStationRef.current = selectedStation; }, [selectedStation]);
  useEffect(() => { lastLocationRef.current = lastLocation; }, [lastLocation]);
  useEffect(() => { isLocationFixedRef.current = isLocationFixed; }, [isLocationFixed]);

  // Aktive Ausleihe laden (für Timer-Banner auf der Startseite)
  const fetchActiveRental = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setActiveRental(null);
        return false;
      }

      let { data, error } = await supabase
        .from('rentals')
        .select('id, station_id, started_at, start_price, price_per_minute, powerbank_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const missingPowerbankColumn =
        !!error &&
        `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase().includes('powerbank_id');

      if (missingPowerbankColumn) {
        const legacy = await supabase
          .from('rentals')
          .select('id, station_id, started_at, start_price, price_per_minute')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        data = legacy.data ? { ...legacy.data, powerbank_id: null } : null;
        error = legacy.error ?? null;
      }

      if (error) {
        throw error;
      }

      if (data) {
        prevActiveRentalRef.current = data.id;
        setActiveRental({
          id: data.id,
          station_id: data.station_id,
          started_at: data.started_at,
          start_price: parseFloat(data.start_price),
          price_per_minute: parseFloat(data.price_per_minute),
          powerbank_id: data.powerbank_id ?? null,
        });
        return true;
      } else {
        const prevId = prevActiveRentalRef.current;
        prevActiveRentalRef.current = null;
        setActiveRental(null);

        if (prevId) {
          try {
            const { data: finished } = await supabase
              .from('rentals')
              .select('id, station_id, started_at, ended_at, duration_minutes, start_price, price_per_minute, powerbank_id')
              .eq('id', prevId)
              .in('status', ['finished', 'closed'])
              .maybeSingle();

            if (finished?.ended_at) {
              const elapsed = Math.max(0, (new Date(finished.ended_at).getTime() - new Date(finished.started_at).getTime()) / 60000);
              const total = parseFloat(finished.start_price ?? '0.10') + elapsed * parseFloat(finished.price_per_minute ?? '0.05');

              const { data: stationData } = await supabase
                .from('stations')
                .select('name, address')
                .eq('id', finished.station_id)
                .maybeSingle();

              setReturnSummary({
                rentalId: finished.id,
                stationName: stationData?.name ?? 'Unbekannte Station',
                stationAddress: stationData?.address ?? undefined,
                powerbankId: finished.powerbank_id,
                startedAt: finished.started_at,
                endedAt: finished.ended_at,
                durationMinutes: finished.duration_minutes ?? Math.round(elapsed),
                totalPrice: Math.round(total * 100) / 100,
              });
            }
          } catch { /* silent */ }
        }

        return false;
      }
    } catch {
      return false;
    }
  }, []);

  const fetchActiveRentalWithRetry = useCallback(async () => {
    const attempts = [0, 1000, 2500, 5000];
    for (const waitMs of attempts) {
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      const found = await fetchActiveRental();
      if (found) {
        break;
      }
    }
  }, [fetchActiveRental]);

  useEffect(() => { fetchActiveRentalWithRetry(); }, [fetchActiveRentalWithRetry]);

  // Timer-Tick (jede Sekunde aktualisieren wenn aktive Ausleihe vorhanden)
  useEffect(() => {
    if (!activeRental) return;
    const interval = setInterval(() => setRentalNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeRental]);

  // Status-Sync: prüft regelmäßig, ob die Ausleihe serverseitig bereits beendet wurde
  useEffect(() => {
    if (!activeRental) return;
    const sync = setInterval(() => {
      fetchActiveRental();
    }, 5000);
    return () => clearInterval(sync);
  }, [activeRental, fetchActiveRental]);

  // Debug: Log stations when they change
  useEffect(() => {
    logger.dev('Stations updated:', stations.length, stations);
  }, [stations]);

  // Read theme from initial prop and sync with document + localStorage (so Light Mode works)
  useEffect(() => {
    if (initialTheme === "light") {
      document.documentElement.classList.remove("dark");
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
      if (typeof localStorage !== "undefined") localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    } else {
      // No URL param: use localStorage or current document class (set by ThemeScript)
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
      const useDark = saved ? saved === "dark" : document.documentElement.classList.contains("dark");
      setIsDarkMode(useDark);
    }
  }, [initialTheme]);

  // Get user's current location - nur einmal beim Laden
  useEffect(() => {
    if (!navigator.geolocation) {
      logger.warn('Geolocation is not supported by this browser');
      // Fallback to Berlin coordinates
      setUserLocation({ lat: 52.52, lng: 13.405 });
      setLocationLoading(false);
      return;
    }

    // Explizite Berechtigungsanfrage für Standort
    const requestLocationPermission = async () => {
      try {
        logger.dev('Requesting location permission...');
        
        // Versuche Standort zu erhalten - das triggert die Berechtigungsanfrage
        navigator.geolocation.getCurrentPosition(
            (position) => {
            const { latitude, longitude, heading } = position.coords;
            const loc = { lat: latitude, lng: longitude };
            setUserLocation(loc);
            // Initialize animation refs with first known position
            targetLocationRef.current = { ...loc };
            animatedLocationRef.current = { ...loc };
            if (heading !== null && !isNaN(heading)) {
              setUserHeading(heading);
              targetHeadingRef.current = heading;
              animatedHeadingRef.current = heading;
            }
            setLocationLoading(false);
            setLocationPermissionGranted(true);
            setShowPermissionModal(false);
          },
          (error) => {
            logger.error('Geolocation error:', error);
            if (error.code === error.PERMISSION_DENIED) {
              logger.warn('Location permission denied by user');
              setLocationPermissionGranted(false);
              setShowPermissionModal(true);
              setLocationLoading(false);
            } else {
              // Andere Fehler - auch Modal zeigen
              setLocationPermissionGranted(false);
              setShowPermissionModal(true);
              setLocationLoading(false);
            }
          },
          { 
            enableHighAccuracy: true, // Höhere Genauigkeit für bessere Navigation
            maximumAge: 0, // Keine gecachte Position - immer frische Daten
            timeout: 10000 // 10 seconds timeout
          }
        );
      } catch (error) {
        logger.error('Permission request error:', error);
        setUserLocation({ lat: 52.52, lng: 13.405 });
        setLocationLoading(false);
      }
    };

    requestLocationPermission();
    // Compass permission is requested from locateMe() (user gesture) for iOS
    // For Android, it's added automatically in the orientation useEffect
  }, []);

  // Explizite Berechtigungsanfrage beim ersten Laden
  useEffect(() => {
    if (!permissionRequested && navigator.geolocation) {
      setPermissionRequested(true);
      logger.dev('Requesting explicit location permission...');
      
      // Explizite Berechtigungsanfrage
      navigator.geolocation.getCurrentPosition(
        (position) => {
          logger.dev('Location permission granted');
          setLocationPermissionGranted(true);
          setShowPermissionModal(false);
        },
        (error) => {
          logger.dev('Location permission denied or error:', error);
          setLocationPermissionGranted(false);
          setShowPermissionModal(true);
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    }
  }, [permissionRequested]);

  const center = useMemo(() => userLocation || { lat: 52.52, lng: 13.405 }, [userLocation]);

  // Funktion um Standortberechtigung erneut anzufragen
  const requestLocationPermissionAgain = () => {
    if (!navigator.geolocation) return;
    
    logger.dev('Requesting location permission again...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        const loc = { lat: latitude, lng: longitude };
        setUserLocation(loc);
        targetLocationRef.current = { ...loc };
        animatedLocationRef.current = { ...loc };
        if (heading !== null && !isNaN(heading)) {
          setUserHeading(heading);
          targetHeadingRef.current = heading;
        }
        setLocationPermissionGranted(true);
        setShowPermissionModal(false);
        setLocationLoading(false);
      },
      (error) => {
        logger.error('Location permission still denied:', error);
        setLocationPermissionGranted(false);
        setShowPermissionModal(true);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  // Shared orientation event handler - used by both automatic and user-gesture flows
  const handleOrientationEvent = (event: DeviceOrientationEvent) => {
    let compassHeading: number | null = null;
    
    // iOS: webkitCompassHeading gives true north heading directly (most reliable)
    if ((event as any).webkitCompassHeading !== undefined && (event as any).webkitCompassHeading !== null) {
      compassHeading = (event as any).webkitCompassHeading as number;
    } else if (event.alpha !== null) {
      // Android / other browsers
      if (event.absolute) {
        // Absolute orientation: convert alpha to compass heading
        // alpha goes counterclockwise, compass heading goes clockwise
        compassHeading = (360 - event.alpha) % 360;
      } else {
        // Non-absolute: alpha is relative to arbitrary reference, less useful
        // but still use it as best effort
        compassHeading = event.alpha;
      }
    }
    
    if (compassHeading === null || isNaN(compassHeading)) return;
    
    // Normalize to 0-360
    compassHeading = ((compassHeading % 360) + 360) % 360;
    
    // Mark that we have valid compass data (shows the cone)
    hasCompassDataRef.current = true;
    
    // Update heading target for smooth animation
    targetHeadingRef.current = compassHeading;
    
    // Throttle React state updates (~5/sec)
    const now = Date.now();
    if (now - orientationThrottleRef.current > 200) {
      orientationThrottleRef.current = now;
      setDeviceOrientation(compassHeading);
      deviceOrientationRef.current = compassHeading;
      setUserHeading(compassHeading);
    }
  };

  // Add orientation event listeners (idempotent - safe to call multiple times)
  const addOrientationListeners = () => {
    if (orientationListenerAddedRef.current) return;
    orientationListenerAddedRef.current = true;
    
    window.addEventListener('deviceorientation', handleOrientationEvent, { passive: true });
    window.addEventListener('deviceorientationabsolute', handleOrientationEvent as any, { passive: true });
    setCompassPermissionGranted(true);
    compassPermissionGrantedRef.current = true;
    logger.dev('Orientation listeners added');
  };

  // Request compass permission - works from user gesture (iOS) or automatically (Android)
  // MUST be called from a user gesture on iOS 13+
  const requestCompassPermission = async (): Promise<boolean> => {
    // Already set up? Skip
    if (orientationListenerAddedRef.current) return true;
    
    try {
      // iOS 13+: requires explicit permission via user gesture
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          addOrientationListeners();
          return true;
        } else {
          setCompassPermissionGranted(false);
          compassPermissionGrantedRef.current = false;
          logger.warn('Compass permission denied by user');
          return false;
        }
      } else {
        // Android / desktop: no permission needed, just add listeners
        addOrientationListeners();
        return true;
      }
    } catch (error) {
      logger.error('Compass permission error:', error);
      // Try adding listeners anyway (works on some Android browsers)
      addOrientationListeners();
      return true;
    }
  };

  // Function to calculate distance between two coordinates in meters
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

  // Function to start navigation to station
  const startNavigation = async (station: Station) => {
    if (!mapRef.current || !userLocation) return;
    
    // Ensure compass is enabled (user gesture context)
    if (!orientationListenerAddedRef.current) {
      await requestCompassPermission();
    }
    
    try {
      const map = mapRef.current;
      
      // Beende Following-Modus und Zentrierung wenn Navigation gestartet wird
      setIsCentered(false);
      if (isFollowingLocation) {
        logger.dev('Navigation started - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      
      // Get Mapbox access token
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        logger.error('Mapbox access token not found');
        return;
      }
      
      // Request walking directions from user location to station with German language
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${station.lng},${station.lat}?geometries=geojson&steps=true&overview=full&language=de&access_token=${accessToken}`;
      
      const response = await fetch(directionsUrl);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeGeometry = route.geometry;
        
        // Clear existing navigation layers and markers
        if (navigationLayerRef.current) {
          if (map.getLayer(navigationLayerRef.current)) {
            map.removeLayer(navigationLayerRef.current);
          }
          if (navigationSourceRef.current && map.getSource(navigationSourceRef.current)) {
            map.removeSource(navigationSourceRef.current);
          }
          navigationLayerRef.current = null;
          navigationSourceRef.current = null;
        }
        
        // Remove existing highlight marker (old station)
        if (highlightMarkerRef.current) {
          highlightMarkerRef.current.remove();
          highlightMarkerRef.current = null;
        }
        
        // Remove existing walking route (dashed line) if any
        if (routeLayerRef.current) {
          try {
            if (map.getLayer(routeLayerRef.current)) {
              map.removeLayer(routeLayerRef.current);
            }
            if (map.getSource('walking-route')) {
              map.removeSource('walking-route');
            }
          } catch (error) {
            logger.dev('Error removing existing walking route:', error instanceof Error ? error.message : String(error));
          }
          routeLayerRef.current = null;
        }
        
        // Remove walking time label if any
        if (walkingTimeLabelRef.current) {
          try {
            walkingTimeLabelRef.current.remove();
          } catch (error) {
            logger.dev('Error removing walking time label:', error instanceof Error ? error.message : String(error));
          }
          walkingTimeLabelRef.current = null;
        }
        
        // Set navigation state
        setIsNavigating(true);
        setIsFullScreenNavigation(true);
        setIsLocationFixed(false); // Reset location fix when starting navigation
        setNavigationRoute(route);
        setDistanceToDestination(Math.round(route.distance));
        setTimeToDestination(Math.round(route.duration / 60));
        
        // Update selected station and close station list
        setSelectedStation(station);
        setShowStationList(false);
        
        // Force immediate update of user marker with navigation styling
        // Update marker immediately to show direction arrow
        logger.dev('Starting navigation - updating user marker with direction');
        updateUserMarker(userLocation, userHeading || 0, true);
        
        // Also update after a short delay to ensure state is set
        setTimeout(() => {
          logger.dev('Delayed update of user marker for navigation');
          updateUserMarker(userLocation, userHeading || 0, true);
        }, 100);
        
        // Extract navigation instructions
        const instructions: string[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((step: any, index: number) => {
            if (step.maneuver && step.maneuver.instruction) {
              instructions.push(step.maneuver.instruction);
            }
          });
        }
        setNavigationInstructions(instructions);
        
        // Set current instruction to first step
        if (instructions.length > 0) {
          setCurrentInstruction(instructions[0]);
          // Speak the first instruction if voice is enabled
          if (voiceEnabled) {
            speakInstruction(instructions[0]);
          }
        }
        
        // Start location tracking for navigation (only if not already tracking)
        if (watchId === null) {
          startLocationTracking();
        }
        
        // Center map on user location and start following
        centerMapOnUserAndFollow();
        
        // Add navigation route source
        const sourceId = 'navigation-route';
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry
          }
        });
        
        // Add navigation route layer
        const layerId = 'navigation-route-layer';
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#10b981', // Emerald color for navigation
            'line-width': 6,
            'line-opacity': 0.9
          }
        });
        
        navigationLayerRef.current = layerId;
        navigationSourceRef.current = sourceId;
        
        // Add destination marker (commented out to remove target window)
        // addDestinationMarker(station);
        
        logger.dev('Navigation started to:', station.name);
      }
    } catch (error) {
      logger.error('Error starting navigation:', error);
    }
  };

  // Function to add walking route to station (simplified version for display)
  const addWalkingRoute = async (station: Station) => {
    if (!mapRef.current || !userLocation) return;
    
    try {
      const map = mapRef.current;
      
      // Remove existing route if any
      if (routeLayerRef.current) {
        try {
          if (map.getLayer(routeLayerRef.current)) {
            map.removeLayer(routeLayerRef.current);
          }
          if (map.getSource('walking-route')) {
            map.removeSource('walking-route');
          }
        } catch (error) {
          logger.dev('Error removing existing route:', error instanceof Error ? error.message : String(error));
        }
        routeLayerRef.current = null;
      }
      
      // Also try to remove any existing route sources/layers that might be left
      try {
        if (map.getLayer('walking-route-layer')) {
          map.removeLayer('walking-route-layer');
        }
        if (map.getSource('walking-route')) {
          map.removeSource('walking-route');
        }
      } catch (error) {
        // Ignore errors if layer/source doesn't exist
        logger.dev('Route cleanup - some layers/sources may not exist:', error instanceof Error ? error.message : String(error));
      }
      
      // Get Mapbox access token
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        logger.error('Mapbox access token not found');
        return;
      }
      
      // Request walking directions from user location to station
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${station.lng},${station.lat}?geometries=geojson&access_token=${accessToken}`;
      
      const response = await fetch(directionsUrl);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeGeometry = route.geometry;
        
        // Calculate walking time in minutes
        const walkingTimeMinutes = Math.round(route.duration / 60);
        
        // Add route source
        const sourceId = 'walking-route';
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry
          }
        });
        
        // Add route layer with dashed line
        const layerId = 'walking-route-layer';
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6', // Helles, leuchtendes Blau für beide Modi
            'line-width': 4, // Dickere Linie für bessere Sichtbarkeit
            'line-dasharray': [2, 2], // Kürzere Striche für feinere Optik
            'line-opacity': 0.9 // Leichte Transparenz für besseren Kontrast
          }
        });
        
        routeLayerRef.current = layerId;
        
        // Add walking time label above the station marker
        addWalkingTimeLabel(station, walkingTimeMinutes);
        
        logger.dev('Walking route added to map with time:', walkingTimeMinutes, 'minutes');
      }
    } catch (error) {
      logger.error('Error adding walking route:', error);
    }
  };

  // Function to add destination marker
  const addDestinationMarker = (station: Station) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Create destination marker element (secure DOM manipulation)
      const destinationElement = document.createElement('div');
      const innerDiv = document.createElement('div');
      innerDiv.style.cssText = `
        background: #10b981;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        border: 2px solid white;
      `;
      // Safely set text content (prevents XSS)
      innerDiv.textContent = `🎯 Ziel: ${station.name}`;
      destinationElement.appendChild(innerDiv);
      
      // Add destination marker
      const destinationMarker = new mapboxgl.Marker({
        element: destinationElement,
        anchor: 'bottom'
      })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      
      logger.dev('Destination marker added for:', station.name);
    } catch (error) {
      logger.error('Error adding destination marker:', error);
    }
  };

  // Function to clear navigation
  const clearNavigation = (keepStationSelection = false) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Remove navigation route
      if (navigationLayerRef.current) {
        if (map.getLayer(navigationLayerRef.current)) {
          map.removeLayer(navigationLayerRef.current);
        }
        if (navigationSourceRef.current && map.getSource(navigationSourceRef.current)) {
          map.removeSource(navigationSourceRef.current);
        }
        navigationLayerRef.current = null;
        navigationSourceRef.current = null;
      }
      
      // Stop location tracking
      stopLocationTracking();
      
      // Stop any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      
      // Reset navigation state
      setIsNavigating(false);
      setIsFullScreenNavigation(false);
      setIsLocationFixed(false); // Reset location fix when ending navigation
      setNavigationRoute(null);
      setCurrentStep(0);
      setNavigationInstructions([]);
      setDistanceToDestination(0);
      setTimeToDestination(0);
      setCurrentInstruction('');
      
      // Zurück zur normalen Ansicht (Nord oben)
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
        essential: true
      });
      
      // Update user marker to normal mode but keep direction if available
      if (userLocation) {
        updateUserMarker(userLocation, userHeading, false);
      }
      
      // Re-add walking route if a station is selected (normal mode)
      if (selectedStation && userLocation) {
        addWalkingRoute(selectedStation);
      }
      
      // Re-add highlight marker for selected station if one is selected
      if (selectedStation && mapRef.current) {
        const map = mapRef.current;
        
        // Create highlight marker for selected station
        const highlightElement = document.createElement('div');
        highlightElement.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="64" viewBox="0 0 32 40">
            <!-- Main marker pin body -->
            <path fill="#10b981" stroke="#10b981" stroke-width="1.5" d="M16 38s-10-6.2-10-14.3a10 10 0 1 1 20 0C26 31.8 16 38 16 38z"/>
            <!-- Lightning bolt - centered at x=16, y=24 -->
            <path d="M16.5 24h3l-4 6v-4h-3l4-6v4z" fill="white" stroke="white" stroke-width="1"/>
          </svg>
        `;
        highlightElement.style.width = '56px';
        highlightElement.style.height = '64px';
        highlightElement.style.cursor = 'pointer';
        
        // Add highlight marker
        const highlightMarker = new mapboxgl.Marker({
          element: highlightElement,
          anchor: 'bottom'
        })
          .setLngLat([selectedStation.lng, selectedStation.lat])
          .addTo(map);
        
        highlightMarkerRef.current = highlightMarker;
        logger.dev('Highlight marker re-added for selected station:', selectedStation.name);
      }
      
      // Force re-render of station markers by triggering the useEffect
      // This ensures all station markers are visible after navigation ends
      setForceStationRerender(prev => prev + 1);
      
      // Ensure the panel is in collapsed state for the selected station
      if (selectedStation) {
        setIsPanelExpanded(false);
        logger.dev('Panel collapsed for selected station:', selectedStation.name);
        
        // Center map on the selected station (same as when selecting a station normally)
        const map = mapRef.current;
        if (map) {
          const latOffset = -0.0013; // Same offset as in highlightStation function
          const targetCenter = [selectedStation.lng, selectedStation.lat + latOffset];
          
          map.flyTo({
            center: targetCenter as [number, number],
            zoom: 16, // Zurück zum ursprünglichen Zoom-Level
            bearing: 0, // Reset rotation after navigation
            essential: true,
            duration: 1000 // Smooth animation
          });
          
          logger.dev('Map centered on selected station after navigation:', selectedStation.name);
        }
      }
      
      logger.dev('Navigation cleared');
    } catch (error) {
      logger.error('Error clearing navigation:', error);
    }
  };

  // Function to stop navigation
  const stopNavigation = () => {
    clearNavigation();
    // Ensure user marker is updated to normal mode but keep direction
    if (userLocation) {
      updateUserMarker(userLocation, userHeading, false);
    }
    logger.dev('Navigation stopped');
  };

  // Function to speak navigation instruction
  const speakInstruction = (text: string) => {
    if (!voiceEnabled) return;
    
    try {
      // Cancel any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        window.speechSynthesis.speak(utterance);
        logger.dev('Speaking instruction:', text);
      }
    } catch (error) {
      logger.error('Error speaking instruction:', error);
    }
  };

  // Function to toggle voice navigation
  const toggleVoiceNavigation = () => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled && currentInstruction) {
      speakInstruction(currentInstruction);
    }
  };

  // Function to start location tracking - optimized for smooth tracking
  // IMPORTANT: Reads from refs (not state) inside callback to avoid stale closures
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      logger.warn('Geolocation is not supported by this browser');
      return;
    }

    const newWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        // Set target for smooth animation (immediate, no throttle)
        targetLocationRef.current = { ...newLocation };
        if (!animatedLocationRef.current) {
          animatedLocationRef.current = { ...newLocation };
        }
        
        // Throttle React state updates to avoid excessive re-renders (max every 500ms)
        const now = Date.now();
        if (now - locationUpdateThrottleRef.current > 500) {
          setUserLocation(newLocation);
          locationUpdateThrottleRef.current = now;
        }
        
        // Heading calculation using refs for current values
        let calculatedHeading = animatedHeadingRef.current;
        const prevLocation = lastLocationRef.current;
        
        if (heading !== null && !isNaN(heading) && heading >= 0) {
          calculatedHeading = heading;
          setUserHeading(heading);
          targetHeadingRef.current = heading;
        } else if (prevLocation && speed && speed > 0.5) {
          const deltaLat = newLocation.lat - prevLocation.lat;
          const deltaLng = newLocation.lng - prevLocation.lng;
          const bearing = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
          calculatedHeading = (bearing + 360) % 360;
          setUserHeading(calculatedHeading);
          targetHeadingRef.current = calculatedHeading;
        }
        
        // Use device orientation compass if available (reads from ref, always current)
        const currentDeviceOrientation = deviceOrientationRef.current;
        const hasCompass = compassPermissionGrantedRef.current;
        if (currentDeviceOrientation !== null && !isNaN(currentDeviceOrientation) && hasCompass) {
          calculatedHeading = currentDeviceOrientation;
          targetHeadingRef.current = calculatedHeading;
        }
        
        // Update navigation if active (reads from refs, always current)
        const navActive = isNavigatingRef.current;
        const navStation = selectedStationRef.current;
        if (navActive && navStation && mapRef.current) {
          // Inline navigation progress update to avoid stale function closure
          const distance = calculateDistance(
            newLocation.lat, newLocation.lng,
            navStation.lat, navStation.lng
          );
          setDistanceToDestination(Math.round(distance));
          
          // Camera following during navigation
          // Bearing is continuously updated by animation loop (compass-following)
          if (!isLocationFixedRef.current) {
            const map = mapRef.current;
            const currentZoom = map.getZoom();
            const targetZoom = currentZoom < 18 ? 19 : currentZoom;
            
            map.easeTo({
              center: [newLocation.lng, newLocation.lat],
              zoom: targetZoom,
              duration: 800,
              essential: true
            });
          }
          
          // Check arrival
          if (distance < 10) {
            logger.dev('User has arrived at destination!');
          }
        }
        
        // Following mode: camera follows position smoothly (reads from refs)
        // Bearing is continuously updated by animation loop (compass-following)
        const following = isFollowingLocationRef.current;
        const following3D = is3DFollowingRef.current;
        if (following && mapRef.current && !navActive) {
          const map = mapRef.current;
          
          map.easeTo({
            center: [newLocation.lng, newLocation.lat],
            pitch: following3D ? 60 : 0,
            duration: 800,
            essential: true
          });
        }
        
        // Save current position for next heading calculation (via ref)
        lastLocationRef.current = newLocation;
        setLastLocation(newLocation);
      },
      (error) => {
        logger.error('Geolocation error during tracking:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 8000
      }
    );
    
    setWatchId(newWatchId);
    logger.dev('Location tracking started');
  };

  // Function to stop location tracking
  const stopLocationTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      logger.dev('Location tracking stopped');
    }
  };


  // Function to update user marker with direction - Google Maps / Apple Maps style
  const updateUserMarker = (location: {lat: number, lng: number}, heading?: number | null, _forceNavigationMode?: boolean) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Set target for smooth animation
      targetLocationRef.current = { ...location };
      if (heading !== null && heading !== undefined && !isNaN(heading)) {
        targetHeadingRef.current = heading;
      }
      
      // Initialize animated position if not set
      if (!animatedLocationRef.current) {
        animatedLocationRef.current = { ...location };
      }
      
      // If marker already exists, targets are set - animation loop handles movement
      if (userMarkerRef.current) {
        return;
      }
      
      // Inject CSS animations for pulse effects (once)
      if (!document.getElementById('gridbox-location-pulse-css')) {
        const style = document.createElement('style');
        style.id = 'gridbox-location-pulse-css';
        style.textContent = `
          @keyframes gridbox-loc-pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
            100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
          }
          @keyframes gridbox-loc-glow {
            0% { box-shadow: 0 0 6px 2px rgba(66,133,244,0.45); }
            50% { box-shadow: 0 0 10px 4px rgba(66,133,244,0.25); }
            100% { box-shadow: 0 0 6px 2px rgba(66,133,244,0.45); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Create Google Maps / Apple Maps-style location indicator
      const userElement = document.createElement('div');
      userElement.style.width = '160px';
      userElement.style.height = '160px';
      userElement.style.position = 'relative';
      userElement.style.pointerEvents = 'none';
      
      const initialHeading = heading || 0;
      const mapBearing = map.getBearing();
      const visualRotation = initialHeading - mapBearing;
      
      // Cone starts hidden until we receive real compass data
      const coneVisible = hasCompassDataRef.current;
      
      userElement.innerHTML = `
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:160px;height:160px;">
          <!-- Direction cone / heading fan - hidden until compass data arrives -->
          <div id="gridbox-heading-cone" style="position:absolute;top:0;left:0;width:160px;height:160px;transform:rotate(${visualRotation}deg);will-change:transform;opacity:${coneVisible ? 1 : 0};transition:opacity 0.5s ease;">
            <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="gridbox-cone-lg" x1="50%" y1="0%" x2="50%" y2="50%">
                  <stop offset="0%" stop-color="#4285F4" stop-opacity="0.0"/>
                  <stop offset="100%" stop-color="#4285F4" stop-opacity="0.35"/>
                </linearGradient>
              </defs>
              <path d="M 80 80 L 48 8 Q 64 0 80 0 Q 96 0 112 8 Z" fill="url(#gridbox-cone-lg)"/>
            </svg>
          </div>
          <!-- Pulse ring (expanding) -->
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:rgba(66,133,244,0.15);animation:gridbox-loc-pulse 2.5s ease-out infinite;"></div>
          <!-- Blue dot with white border -->
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:17px;height:17px;border-radius:50%;background:#4285F4;border:2.5px solid white;animation:gridbox-loc-glow 3s ease-in-out infinite;"></div>
        </div>
      `;
      
      // Store reference to heading cone element for smooth rotation
      headingElementRef.current = userElement.querySelector('#gridbox-heading-cone') as HTMLDivElement;
      
      // Create the mapbox marker
      const userMarker = new mapboxgl.Marker({
        element: userElement,
        anchor: 'center'
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
      
      userMarkerRef.current = userMarker;
      animatedLocationRef.current = { ...location };
      animatedHeadingRef.current = initialHeading;
    } catch (error) {
      logger.error('Error updating user marker:', error);
    }
  };
  
  // Smooth animation loop for fluid location & heading tracking (requestAnimationFrame)
  // This runs continuously and interpolates position/heading for a Google Maps-like experience
  useEffect(() => {
    let running = true;
    
    const animate = () => {
      if (!running) return;
      
      // --- Smooth position interpolation (lerp) ---
      if (animatedLocationRef.current && targetLocationRef.current && userMarkerRef.current) {
        const prevLat = animatedLocationRef.current.lat;
        const prevLng = animatedLocationRef.current.lng;
        const targetLat = targetLocationRef.current.lat;
        const targetLng = targetLocationRef.current.lng;
        
        const latDiff = targetLat - prevLat;
        const lngDiff = targetLng - prevLng;
        
        // Only interpolate if there's a meaningful difference (avoids jitter at rest)
        if (Math.abs(latDiff) > 1e-8 || Math.abs(lngDiff) > 1e-8) {
          // Adaptive smoothing: faster when far, slower when close
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          const smoothFactor = distance > 0.0005 ? 0.15 : 0.08; // ~50m threshold
          
          animatedLocationRef.current = {
            lat: prevLat + latDiff * smoothFactor,
            lng: prevLng + lngDiff * smoothFactor,
          };
          userMarkerRef.current.setLngLat([animatedLocationRef.current.lng, animatedLocationRef.current.lat]);
        }
      }
      
      // --- Smooth heading interpolation ---
      if (headingElementRef.current && mapRef.current) {
        // Show/hide cone based on whether we have compass data
        if (hasCompassDataRef.current) {
          if (headingElementRef.current.style.opacity !== '1') {
            headingElementRef.current.style.opacity = '1';
          }
        }
        
        const currentHeading = animatedHeadingRef.current;
        const targetHeading = targetHeadingRef.current;
        
        // Shortest path rotation (handle 0/360 wrap-around)
        let diff = targetHeading - currentHeading;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        if (Math.abs(diff) > 0.15) {
          animatedHeadingRef.current = ((currentHeading + diff * 0.12) + 360) % 360;
        }
        
        // Account for map bearing so cone always points correctly in real-world direction
        const mapBearing = mapRef.current.getBearing();
        const visualRotation = animatedHeadingRef.current - mapBearing;
        headingElementRef.current.style.transform = `rotate(${visualRotation}deg)`;
      }
      
      // --- Rotate map bearing to follow compass heading (Google Maps-style) ---
      // When in following mode (2D or 3D) or navigation mode, the map rotates
      // so the direction the user is facing always points "up" on screen.
      const isFollowing = isFollowingLocationRef.current;
      const isNav = isNavigatingRef.current;
      const isLocFixed = isLocationFixedRef.current;
      if ((isFollowing || (isNav && !isLocFixed)) && hasCompassDataRef.current && mapRef.current) {
        const targetMapBearing = animatedHeadingRef.current;
        const currentMapBearing = mapRef.current.getBearing();
        
        // Normalize to 0-360 for comparison
        const normalizedTarget = ((targetMapBearing % 360) + 360) % 360;
        const normalizedCurrent = ((currentMapBearing % 360) + 360) % 360;
        
        // Shortest path rotation (handle 0/360 wrap-around)
        let bearingDiff = normalizedTarget - normalizedCurrent;
        if (bearingDiff > 180) bearingDiff -= 360;
        if (bearingDiff < -180) bearingDiff += 360;
        
        if (Math.abs(bearingDiff) > 0.15) {
          const newBearing = currentMapBearing + bearingDiff * 0.12;
          mapRef.current.setBearing(newBearing);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  // Function to center map on user and start following
  const centerMapOnUserAndFollow = () => {
    if (!mapRef.current || !userLocation) return;
    
    try {
      const map = mapRef.current;
      
      // Center map on user location with high zoom and compass bearing
      const compassBearing = hasCompassDataRef.current ? deviceOrientationRef.current : 0;
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 19, // High zoom for detailed navigation
        bearing: compassBearing, // Kompass-Ausrichtung für Navigation
        essential: true,
        duration: 1500
      });
      
      logger.dev('Map centered on user location for navigation');
    } catch (error) {
      logger.error('Error centering map on user:', error);
    }
  };

  // Function to update navigation progress
  const updateNavigationProgress = async (currentLocation: {lat: number, lng: number}, destination: Station) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Calculate distance to destination
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        destination.lat,
        destination.lng
      );
      
      // Update distance display
      setDistanceToDestination(Math.round(distance));
      
      // Center map on user location during navigation (smooth following) - only if not fixed
      if (!isLocationFixed) {
        // Verwende easeTo für flüssige Bewegung während der Navigation
        const currentZoom = map.getZoom();
        const targetZoom = currentZoom < 18 ? 19 : currentZoom;
        
        // Apply device orientation rotation if available and valid
        const targetBearing = (deviceOrientation !== 0 && !isNaN(deviceOrientation)) 
          ? -deviceOrientation + 180 
          : map.getBearing();
        
        map.easeTo({
          center: [currentLocation.lng, currentLocation.lat],
          zoom: targetZoom,
          bearing: targetBearing,
          duration: 500,
          essential: true
        });
        
        logger.dev('Following mode: Map centered on user location');
      } else {
        // In fixed mode, only update the user marker position without moving the map
        logger.dev('Fixed mode: Map will not follow user movement, only marker updates');
      }
      
      // Check if user is close to destination (within 10 meters)
      if (distance < 10) {
        // User has arrived at destination
        logger.dev('User has arrived at destination!');
        if (voiceEnabled) {
          speakInstruction('Sie haben Ihr Ziel erreicht!');
        }
        // Optionally stop navigation automatically
        // stopNavigation();
      }
      
    } catch (error) {
      logger.error('Error updating navigation progress:', error);
    }
  };

  // Function to add walking time label above station marker
  const addWalkingTimeLabel = (station: Station, walkingTimeMinutes: number) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Remove existing walking time label if any
      if (walkingTimeLabelRef.current) {
        try {
          walkingTimeLabelRef.current.remove();
        } catch (error) {
          logger.dev('Error removing existing walking time label:', error instanceof Error ? error.message : String(error));
        }
        walkingTimeLabelRef.current = null;
      }
      
      // Create walking time label element
      const timeLabelElement = document.createElement('div');
      timeLabelElement.innerHTML = `
        <div class="walking-time-label" style="
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
        ">
          ${walkingTimeMinutes} Min
        </div>
      `;
      
      // Add walking time label marker
      const timeLabelMarker = new mapboxgl.Marker({
        element: timeLabelElement,
        anchor: 'bottom',
        offset: [0, -50] // Position above the station marker
      })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      
      walkingTimeLabelRef.current = timeLabelMarker;
      logger.dev('Walking time label added:', walkingTimeMinutes, 'minutes');
    } catch (error) {
      logger.error('Error adding walking time label:', error);
    }
  };

  // Function to highlight and zoom to a station on the map
  const highlightStation = async (station: Station) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Beende Following-Modus wenn Station ausgewählt wird
      if (isFollowingLocation) {
        logger.dev('Station selected - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      // Deaktiviere Station-Following wenn neue Station ausgewählt wird
      setIsStationFollowingActive(false);
      
      // Debug: Log station coordinates and validate them
      logger.dev('Highlighting station:', station.name, 'Coordinates:', { lat: station.lat, lng: station.lng });
      
      // Validate coordinates
      if (!station.lat || !station.lng || isNaN(station.lat) || isNaN(station.lng)) {
        logger.error('Invalid station coordinates:', station);
        return;
      }
      
      // If we're in navigation mode, automatically start navigation to the new station
      if (isNavigating) {
        logger.dev('Navigation mode active - switching to new station:', station.name);
        // Clear current navigation first but keep station markers visible
        clearNavigation(true);
        // Start navigation to new station
        await startNavigation(station);
        return;
      }
      
      // Remove existing highlight marker if any
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.remove();
      }
      
      // Create a larger, more prominent highlight marker with pulsing ring
      const highlightElement = document.createElement('div');
      highlightElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="64" viewBox="0 0 32 40">
          <!-- Main marker pin body -->
          <path fill="#10b981" stroke="#10b981" stroke-width="1.5" d="M16 38s-10-6.2-10-14.3a10 10 0 1 1 20 0C26 31.8 16 38 16 38z"/>
          <!-- Lightning bolt - centered at x=16, y=24 -->
          <path d="M16.5 24h3l-4 6v-4h-3l4-6v4z" fill="white" stroke="white" stroke-width="1"/>
        </svg>
      `;
      highlightElement.style.width = '56px';
      highlightElement.style.height = '64px';
      highlightElement.style.cursor = 'pointer';
      
      // Add highlight marker (in addition to the normal marker)
      const highlightMarker = new mapboxgl.Marker({
        element: highlightElement,
        anchor: 'bottom'
      })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      
      highlightMarkerRef.current = highlightMarker;
      
      // Add walking route to station (only if not in navigation mode)
      if (!isNavigating) {
        await addWalkingRoute(station);
      }
      
      // Center the map on the station with offset for panel interaction
      const latOffset = -0.0013; // Fine-tuned offset - perfect balance for panel interaction
      
      // Set view with offset so station appears in upper portion when panel is expanded
      const targetCenter = [station.lng, station.lat + latOffset];
      logger.dev('✅ Jumping instantly to coordinates:', targetCenter);
      
      // Jump SOFORT zur Station ohne Animation
      map.jumpTo({
        center: targetCenter as [number, number],
        zoom: 16,
        bearing: 0 // Reset rotation to ensure proper positioning
      });
      
      // Set selected station
      setSelectedStation(station);
      setShowStationList(false);
      setIsPanelExpanded(false); // Panel standardmäßig im kleinen Zustand
      
      logger.dev('Station highlighted and map centered on:', { lng: station.lng, lat: station.lat + latOffset });
      logger.dev('🔍 Panel State:', {
        selectedStation: !!station,
        showStationList: false,
        userLocation: !!userLocation,
        isPanelExpanded: true,
        isClosing: false,
        isFullScreenNavigation: false
      });
      logger.dev('📋 Station Data:', {
        name: station.name,
        address: station.address || 'NICHT VORHANDEN',
        description: station.description || 'NICHT VORHANDEN',
        opening_hours: station.opening_hours || 'NICHT VORHANDEN',
        photos: station.photos?.length || 0,
        photo_url: station.photo_url || 'NICHT VORHANDEN'
      });
    } catch (error) {
      logger.error('Error highlighting station:', error);
    }
  };

  // Touch handlers for dragging the panel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    
    const currentY = e.touches[0].clientY;
    const delta = touchStartY.current - currentY;
    
    // Always show drag feedback
    if (delta > 0 && !isPanelExpanded) {
      // Dragging up when collapsed - limit to reasonable height
      setDragOffset(Math.min(delta, 300));
    } else if (delta < 0 && isPanelExpanded) {
      // Dragging down when expanded
      setDragOffset(Math.max(delta, -300));
    } else {
      // Reset if dragging in wrong direction
      setDragOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    
    // Snap to expanded or collapsed based on drag offset
    if (dragOffset > 80) {
      setIsPanelExpanded(true);
    } else if (dragOffset < -80) {
      // Check if collapsed and swiped down far
      if (!isPanelExpanded && dragOffset < -150) {
        setIsClosing(true);
        setTimeout(() => {
          clearHighlight();
          setIsClosing(false);
        }, 300); // Match animation duration
      } else {
        setIsPanelExpanded(false);
      }
    }
    
    // Reset
    setDragOffset(0);
    isDragging.current = false;
    touchStartY.current = 0;
  };

  // Function to clear station highlight
  const clearHighlight = async () => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Remove highlight marker
      if (highlightMarkerRef.current) {
        try {
          highlightMarkerRef.current.remove();
        } catch (error) {
          logger.dev('Error removing highlight marker:', error instanceof Error ? error.message : String(error));
        }
        highlightMarkerRef.current = null;
      }
      
      // Remove walking time label
      if (walkingTimeLabelRef.current) {
        try {
          walkingTimeLabelRef.current.remove();
        } catch (error) {
          logger.dev('Error removing walking time label:', error instanceof Error ? error.message : String(error));
        }
        walkingTimeLabelRef.current = null;
      }
      
      // Remove walking route
      if (routeLayerRef.current) {
        if (map.getLayer(routeLayerRef.current)) {
          map.removeLayer(routeLayerRef.current);
        }
        if (map.getSource('walking-route')) {
          map.removeSource('walking-route');
        }
        routeLayerRef.current = null;
      }
      
      // Also try to remove any existing route sources/layers that might be left
      try {
        if (map.getLayer('walking-route-layer')) {
          map.removeLayer('walking-route-layer');
        }
        if (map.getSource('walking-route')) {
          map.removeSource('walking-route');
        }
      } catch (error) {
        // Ignore errors if layer/source doesn't exist
        logger.dev('Route cleanup - some layers/sources may not exist:', error instanceof Error ? error.message : String(error));
      }
      
      // Clear navigation if active
      if (isNavigating) {
        clearNavigation();
      }
      
      // Re-center map to user location when closing panel
      if (userLocation) {
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 16,
          bearing: 0, // Reset rotation when clearing highlight
          essential: true
        });
        // Update user marker to normal mode but keep direction if available
        updateUserMarker(userLocation, userHeading, false);
      }
      
      // Reset selected station and panel state
      setSelectedStation(null);
      setIsPanelExpanded(false);
      setIsStationFollowingActive(false); // Deaktiviere Station-Following
      
      // Deaktiviere auch den normalen Following-Modus
      if (isFollowingLocation) {
        logger.dev('Clearing highlight - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      
      logger.dev('Station highlight and route cleared');
    } catch (error) {
      logger.error('Error clearing highlight:', error);
    }
  };

  // Function to open external navigation (Google Maps / Apple Maps)
  const openExternalNavigation = (station: Station) => {
    if (!userLocation) return;
    
    const googleMapsUrl = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${station.lat},${station.lng}`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${station.lat},${station.lng}&saddr=${userLocation.lat},${userLocation.lng}`;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      window.open(appleMapsUrl, '_blank');
    } else {
      window.open(googleMapsUrl, '_blank');
    }
  };

  // Legacy function for backward compatibility
  const openNavigation = (station: Station) => {
    if (!userLocation) return;
    
    // Try to open in Google Maps first, fallback to Apple Maps
    const googleMapsUrl = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${station.lat},${station.lng}`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${station.lat},${station.lng}&saddr=${userLocation.lat},${userLocation.lng}`;
    
    // Check if it's iOS device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Try Apple Maps first on iOS
      window.open(appleMapsUrl, '_blank');
    } else {
      // Use Google Maps on other devices
      window.open(googleMapsUrl, '_blank');
    }
  };

  // Filter nearby stations within 200m
  useEffect(() => {
    if (!userLocation || stations.length === 0) {
      setNearbyStations([]);
      return;
    }

    const nearby = stations.filter(station => {
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        station.lat, 
        station.lng
      );
      return distance <= 200; // 200 meters
    });

    setNearbyStations(nearby);
  }, [userLocation, stations]);

  // Device orientation setup on mount
  // On Android: adds listeners automatically (no permission needed)
  // On iOS: tries automatic request, but this usually fails (needs user gesture)
  //         The actual grant happens in locateMe() which IS a user gesture
  useEffect(() => {
    // Try automatic setup (works on Android, fails silently on iOS)
    const tryAutoSetup = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        // iOS: Don't try automatic - it will fail without user gesture
        // We'll request in locateMe() instead
        logger.dev('iOS detected: compass permission will be requested on user interaction');
        return;
      }
      // Android / desktop: just add listeners
      addOrientationListeners();
    };
    
    tryAutoSetup();
    
    return () => {
      if (orientationListenerAddedRef.current) {
        window.removeEventListener('deviceorientation', handleOrientationEvent);
        window.removeEventListener('deviceorientationabsolute', handleOrientationEvent as any);
        orientationListenerAddedRef.current = false;
      }
    };
  }, []);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  useEffect(() => {
    if (mapRef.current || !mapElRef.current || isDarkMode === null || locationLoading) return;
    
    // Dynamically import Mapbox GL only on client side
    const initMap = async () => {
      try {
        // Set Mapbox access token
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!accessToken) {
          logger.error('Mapbox access token not found. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables.');
          return;
        }
        
        mapboxgl.accessToken = accessToken;
        
        // Import Mapbox GL CSS dynamically
        if (!document.querySelector('link[href*="mapbox-gl"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
          document.head.appendChild(link);
        }
        
        // Ensure map container has proper dimensions
        const mapContainer = mapElRef.current!;
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
        
        // Get style URLs from environment variables
        const lightStyle = process.env.NEXT_PUBLIC_MAPBOX_LIGHT_STYLE || 'mapbox://styles/mapbox/light-v11';
        const darkStyle = process.env.NEXT_PUBLIC_MAPBOX_DARK_STYLE || 'mapbox://styles/mapbox/dark-v11';
        
        const map = new mapboxgl.Map({
          container: mapContainer,
          style: isDarkMode ? darkStyle : lightStyle,
          center: [center.lng, center.lat], // Use current user location
          zoom: 17,
          pitch: 0,
          bearing: 0,
          attributionControl: false, // Reduziert Overhead
          fadeDuration: 300 // Standard Tile-Übergänge
        });

        mapRef.current = map;
        logger.dev('Mapbox map initialized successfully');
        logger.dev('Map center set to:', center);

        // Add event listeners for map interactions
        map.on('dragstart', () => {
          // Wenn Benutzer die Karte manuell bewegt, beende Following-Modus komplett
          logger.dev('User drag detected - deactivating following mode');
          setIsCentered(false);
          setIsStationFollowingActive(false);
          setIsFollowingLocation(false);
          setIs3DFollowing(false);
          
          if (watchId !== null) {
            stopLocationTracking();
          }
          
          // Zurück zur normalen Ansicht (Nord oben, kein Pitch)
          const needsReset = map.getPitch() > 5 || Math.abs(((map.getBearing() + 180) % 360) - 180) > 1;
          if (needsReset) {
            map.easeTo({
              pitch: 0,
              bearing: 0,
              duration: 500
            });
          }
        });

        map.on('pitchstart', () => {
          // Nur deaktivieren wenn Following aktiv ist (um programmatische Pitch-Änderungen zu ignorieren)
          if (!isFollowingLocation) return;
          
          logger.dev('User pitch detected - deactivating following mode');
          setIsCentered(false);
          setIsStationFollowingActive(false);
          setIsFollowingLocation(false);
          setIs3DFollowing(false);
          
          if (watchId !== null) {
            stopLocationTracking();
          }
        });

        // Heading cone rotation is handled by animation loop (reads map bearing every frame)
        // No need for manual rotation event handler

        // Add user location marker if we have the location
        if (userLocation) {
          // Use updateUserMarker function to get proper direction display
          updateUserMarker(userLocation, userHeading, false);
          logger.dev('User marker added at:', userLocation, 'with heading:', userHeading);
        }

        // Standort fortlaufend aktualisieren für flüssige Bewegung auf der Karte
        if (watchId === null && navigator.geolocation) {
          startLocationTracking();
        }

        // Force map to invalidate size and render
        setTimeout(() => {
          map.resize();
          logger.dev('Map resized and should be visible now');
        }, 100);

        return () => {
          if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
          }
        };
      } catch (error) {
        logger.error('Error initializing Mapbox map:', error);
      }
    };

    initMap();
  }, [center, isDarkMode, locationLoading, userLocation]);

  // Cleanup beim Component Unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Effect to change map style when theme changes
  useEffect(() => {
    if (!mapRef.current || isDarkMode === null) {
      // Map not initialized yet or theme not detected yet, wait for it
      return;
    }
    
    const changeMapStyle = async () => {
      try {
        const map = mapRef.current!;
        
        // Get style URLs from environment variables
        const lightStyle = process.env.NEXT_PUBLIC_MAPBOX_LIGHT_STYLE || 'mapbox://styles/mapbox/light-v11';
        const darkStyle = process.env.NEXT_PUBLIC_MAPBOX_DARK_STYLE || 'mapbox://styles/mapbox/dark-v11';
        
        const newStyle = isDarkMode ? darkStyle : lightStyle;
        logger.dev("Switching to Mapbox style:", newStyle);
        
        map.setStyle(newStyle);
      } catch (error) {
        logger.error('Error changing map style:', error);
      }
    };
    
    changeMapStyle();
  }, [isDarkMode]);

  // Automatisches Starten/Stoppen des Location Tracking bei Following-Modus
  useEffect(() => {
    // Nur ausführen wenn Map und User Location bereit sind
    if (!mapRef.current || !userLocation) return;
    
    if (isFollowingLocation && !isNavigating) {
      // Following-Modus aktiviert - starte Location Tracking
      if (watchId === null) {
        logger.dev('Following mode activated - starting location tracking');
        startLocationTracking();
      }
      
      // Setze Pitch basierend auf 2D/3D-Modus
      // Bearing wird kontinuierlich vom Animation Loop aktualisiert (Kompass-Rotation)
      const map = mapRef.current;
      const compassBearing = hasCompassDataRef.current ? deviceOrientation : 0;
      if (is3DFollowing) {
        // 3D-Ansicht mit Kompass-Bearing
        map.easeTo({
          pitch: 60,
          bearing: compassBearing,
          duration: 800,
          essential: true
        });
      } else {
        // 2D-Ansicht mit Kompass-Bearing (Karte dreht sich mit Blickrichtung)
        map.easeTo({
          pitch: 0,
          bearing: compassBearing,
          duration: 800,
          essential: true
        });
      }
    } else if (!isFollowingLocation && !isNavigating && watchId !== null) {
      // Following-Modus deaktiviert - stoppe Location Tracking nur wenn es läuft
      logger.dev('Following mode deactivated - stopping location tracking');
      stopLocationTracking();
      
      // Zurück zur normalen 2D-Ansicht (Nord oben)
      if (mapRef.current) {
        const map = mapRef.current;
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 800,
          essential: true
        });
      }
    }
  }, [isFollowingLocation, is3DFollowing, isNavigating]);

  // Stationen auf Karte anzeigen
  useEffect(() => {
    if (!mapRef.current || stations.length === 0) {
      logger.dev('Map not ready or no stations available');
      return;
    }
    
    const map = mapRef.current;
    
    const addMarkers = async () => {
      try {
        // Remove existing station markers
        stationsLayerRef.current.forEach(marker => marker.remove());
        stationsLayerRef.current = [];
        
        stations.forEach((s) => {
          // Skip the selected station - it will be shown as highlight marker
          // BUT only if we're NOT in navigation mode (in navigation mode, keep all stations visible)
          if (selectedStation && selectedStation.id === s.id && !isNavigating) {
            return;
          }
          
          // Marker-Farbe basierend auf Verbindungsstatus
          const online = isStationOnline(s);
          const markerColor = online ? '#10b981' : '#9ca3af'; // grün wenn online, grau wenn offline
          
          const stationElement = document.createElement('div');
          stationElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path fill="${markerColor}" stroke="${markerColor}" d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
              <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="white" stroke="white"/>
            </svg>
          `;
          stationElement.style.width = '32px';
          stationElement.style.height = '32px';
          stationElement.style.cursor = 'pointer';
          if (!online) {
            stationElement.style.opacity = '0.6';
          }
          
          const marker = new mapboxgl.Marker({
            element: stationElement,
            anchor: 'bottom'
          })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          
          // Add click handler to open info panel
          marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            logger.dev('Marker clicked:', s.name);
            highlightStation(s);
          });
          
          stationsLayerRef.current.push(marker);
        });
        
        logger.dev(`Successfully added ${stations.length} station markers to map`);
      } catch (error) {
        logger.error('Error adding markers to map:', error);
      }
    };
    
    addMarkers();
  }, [stations, mapRef.current, userLocation, selectedStation, isNavigating, forceStationRerender]);

  async function locateMe() {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!navigator.geolocation) {
      logger.warn('Geolocation is not supported by this browser');
      return;
    }

    // Request compass permission from user gesture context (required for iOS)
    // This is the ONLY reliable way to get compass on iOS 13+
    if (!orientationListenerAddedRef.current) {
      await requestCompassPermission();
    }

    // Explizite Berechtigungsanfrage für Standort
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          alert('Standortberechtigung wurde verweigert. Bitte erlauben Sie den Zugriff auf Ihren Standort in den Browser-Einstellungen.');
          return;
        }
      }
    } catch (error) {
      logger.error('Permission check error in locateMe:', error);
    }
    
    if (isFollowingLocation && is3DFollowing) {
      // Zustand 3: Following 3D ist aktiv -> Deaktiviere Following komplett
      logger.dev('Deactivating 3D following mode');
      setIsFollowingLocation(false);
      setIs3DFollowing(false);
      setIsCentered(false);
      
      // Stoppe Location Tracking
      stopLocationTracking();
      
      if (userLocation) {
        // Zurück zur normalen Ansicht ohne Following
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 17,
          bearing: 0,
          pitch: 0,
          essential: true,
          duration: 800
        });
        
        logger.dev('Following mode deactivated');
      }
    } else if (isFollowingLocation && !is3DFollowing) {
      // Zustand 2: Following 2D ist aktiv -> Wechsel zu Following 3D
      logger.dev('Switching to 3D following mode');
      setIs3DFollowing(true);
      
      if (userLocation) {
        // Aktiviere 3D-Ansicht mit Kompass-Bearing
        const compassBearing = hasCompassDataRef.current ? deviceOrientation : 0;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 19,
          bearing: compassBearing,
          pitch: 60, // 3D-Ansicht
          essential: true,
          duration: 800
        });
        
        logger.dev('3D following mode activated');
      }
    } else if (isCentered && !isFollowingLocation) {
      // Zustand 1b: Bereits zentriert -> Aktiviere 2D Following
      logger.dev('Activating 2D following mode from centered state');
      
      if (userLocation) {
        setIsFollowingLocation(true);
        setIs3DFollowing(false);
        setIsCentered(false); // Reset centered state when activating following
        // Location Tracking wird automatisch durch useEffect gestartet
        
        // Kompass-Bearing: Blickrichtung zeigt nach oben (wie Google Maps)
        const compassBearing = hasCompassDataRef.current ? deviceOrientation : 0;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 18,
          bearing: compassBearing,
          pitch: 0, // 2D-Ansicht
          essential: true,
          duration: 800
        });
        
        logger.dev('2D following mode activated');
        return;
      }
      
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              const { latitude, longitude, heading } = pos.coords;
              // Update user location state
              setUserLocation({ lat: latitude, lng: longitude });
              if (heading !== null && !isNaN(heading)) {
                setUserHeading(heading);
              }
              
              setIsFollowingLocation(true);
              setIs3DFollowing(false);
              setIsCentered(false); // Reset centered state when activating following
              // Location Tracking wird automatisch durch useEffect gestartet
              
              // Kompass-Bearing: Blickrichtung zeigt nach oben (wie Google Maps)
              const compassBearing = hasCompassDataRef.current ? deviceOrientationRef.current : 0;
              map.flyTo({
                center: [longitude, latitude],
                zoom: 18,
                bearing: compassBearing,
                pitch: 0, // 2D-Ansicht
                essential: true,
                duration: 800
              });
              
              // Update user marker with direction
              updateUserMarker({ lat: latitude, lng: longitude }, heading, false);
              logger.dev('2D following mode activated');
            } catch (error) {
              logger.error('Error updating user location:', error);
            }
          },
          (error) => {
            logger.error('Geolocation error:', error);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
          }
        );
      } catch (error) {
        logger.error('Error with geolocation:', error);
      }
    } else {
      // Zustand 1a: Standort einfach zentrieren (ohne Following zu aktivieren)
      logger.dev('Centering on user location');
      
      // Verwende die bereits gecachte Position wenn vorhanden
      if (userLocation) {
        setIsCentered(true);
        
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 17,
          bearing: 0,
          pitch: 0,
          essential: true,
          duration: 800
        });
        
        logger.dev('Location centered');
        return;
      }
      
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              const { latitude, longitude, heading } = pos.coords;
              // Update user location state
              setUserLocation({ lat: latitude, lng: longitude });
              if (heading !== null && !isNaN(heading)) {
                setUserHeading(heading);
              }
              
              setIsCentered(true);
              
              map.flyTo({
                center: [longitude, latitude],
                zoom: 17,
                bearing: 0,
                pitch: 0,
                essential: true,
                duration: 800
              });
              
              // Update user marker with direction
              updateUserMarker({ lat: latitude, lng: longitude }, heading, false);
              logger.dev('Location centered');
            } catch (error) {
              logger.error('Error updating user location:', error);
            }
          },
          (error) => {
            logger.error('Geolocation error:', error);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
          }
        );
      } catch (error) {
        logger.error('Error with geolocation:', error);
      }
    }
  }

  // Funktion für den Button beim Station-Panel: Zentriert auf Station und aktiviert Following-Modus
  async function centerOnStationAndFollow() {
    if (!mapRef.current || !selectedStation || !userLocation) return;
    const map = mapRef.current;
    
    logger.dev('Centering on station and activating following mode');
    
    // Gleicher Offset wie beim Klick auf die Station
    const latOffset = -0.0013;
    const targetCenter = [selectedStation.lng, selectedStation.lat + latOffset];
    
    // Zentriere auf die Station (gleiche Position wie das Panel zeigt)
    map.flyTo({
      center: targetCenter as [number, number],
      zoom: 16, // Gleicher Zoom wie beim Klick auf die Station
      bearing: 0,
      pitch: 0,
      essential: true,
      duration: 1000
    });
    
    // Nach der Animation: Aktiviere Following-Modus
    setTimeout(() => {
      setIsFollowingLocation(true);
      setIsStationFollowingActive(true); // Aktiviere den grünen Rand
      // Location Tracking wird automatisch durch useEffect gestartet
      
      logger.dev('Station-following mode activated');
    }, 1000);
  }

  return (
    <>
      {/* Standortberechtigung Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Standortberechtigung erforderlich
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Diese App benötigt Zugriff auf Ihren Standort und Kompass, um die nächsten Ladestationen zu finden und die Navigation zu ermöglichen.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    await requestLocationPermissionAgain();
                    await requestCompassPermission();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200"
                >
                  Standort & Kompass-Berechtigung gewähren
                </button>
                <button
                  onClick={() => {
                    setShowPermissionModal(false);
                    // App trotzdem verwenden, aber mit eingeschränkter Funktionalität
                    setUserLocation({ lat: 52.52, lng: 13.405 });
                    setLocationLoading(false);
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-xl transition-colors duration-200"
                >
                  Ohne Standort fortfahren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={mapElRef} 
        className={`fixed inset-0 z-0 ${!locationPermissionGranted ? 'pointer-events-none opacity-50' : ''}`}
        style={{ 
          width: '100vw', 
          height: '100vh',
          minHeight: '100vh'
        }} 
      />
      
      {/* Aktive Ausleihe Timer-Pill */}
      {activeRental && !showRentalModal && (() => {
        const start = new Date(activeRental.started_at).getTime();
        const diffMs = rentalNow - start;
        const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const minutesAsDecimal = diffMs / 60000;
        const currentPrice = activeRental.start_price + Math.max(0, minutesAsDecimal) * activeRental.price_per_minute;

        return (
          <div className="fixed top-[68px] left-0 right-0 z-[900] flex justify-center pointer-events-none">
            <div className={`inline-flex items-center gap-3 rounded-full px-4 py-2 shadow-lg backdrop-blur-sm pointer-events-auto ${
              isDarkMode === true
                ? 'bg-black/30 border border-white/15 text-white'
                : 'bg-white/40 border border-slate-300/40 text-slate-900 shadow-lg'
            }`}>
              <div className="grid place-items-center h-7 w-7 rounded-full bg-emerald-500 text-white flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="font-semibold tabular-nums text-sm tracking-tight">
                {hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}
                {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
              </div>
              <div className={`h-4 w-px ${isDarkMode === true ? 'bg-white/20' : 'bg-slate-300/60'}`} />
              <div className="font-bold text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                {currentPrice.toFixed(2)} €
              </div>
            </div>
          </div>
        );
      })()}

      {/* Return Summary Modal */}
      {returnSummary && (
        <ReturnSummaryModal
          data={returnSummary}
          isDarkMode={isDarkMode === true}
          onClose={() => setReturnSummary(null)}
        />
      )}

      {/* Loading indicator for location */}
      {locationLoading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className={`rounded-xl px-6 py-4 shadow-lg ${
            isDarkMode === true 
              ? 'bg-gray-800 text-white' 
              : 'bg-white text-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent"></div>
              <span className="text-sm font-medium">Standort wird ermittelt...</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator for stations */}
      {stationManager.loading && !locationLoading && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[999]">
          <div className={`rounded-xl px-4 py-2 shadow-lg ${
            isDarkMode === true 
              ? 'bg-gray-800 text-white border border-gray-700' 
              : 'bg-white text-slate-900 border border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent"></div>
              <span className="text-xs font-medium">Stationen werden geladen...</span>
            </div>
          </div>
        </div>
      )}

      {/* Error indicator for stations */}
      {stationManager.error && !locationLoading && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[999]">
          <div className={`rounded-xl px-4 py-2 shadow-lg border ${
            isDarkMode === true 
              ? 'bg-red-900/90 text-white border-red-700' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">⚠️ {stationManager.error}</span>
            </div>
          </div>
        </div>
      )}

      {/* No stations indicator */}
      {!stationManager.loading && !stationManager.error && stations.length === 0 && !locationLoading && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[999]">
          <div className={`rounded-xl px-4 py-2 shadow-lg border ${
            isDarkMode === true 
              ? 'bg-yellow-900/90 text-white border-yellow-700' 
              : 'bg-yellow-50 text-yellow-900 border-yellow-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">ℹ️ Keine Stationen in der Datenbank gefunden</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Top bar with account and help buttons - optimiert für bessere UX */}
      {!isFullScreenNavigation && (
      <div className="fixed left-0 right-0 top-4 z-[1000] flex items-start justify-between pl-4 pr-4 pointer-events-none">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Account & Einstellungen"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95 pointer-events-auto ${
            isDarkMode === true
              ? 'bg-black/20 text-white border border-white/20 hover:bg-black/30' 
              : 'bg-white/20 text-slate-900 border border-slate-300/30 hover:bg-white/30 shadow-lg'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        
        <a
          href="/hilfe"
          aria-label="Hilfe"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 pointer-events-auto ${
            isDarkMode === true
              ? 'bg-black/20 text-white border border-white/20 hover:bg-black/30' 
              : 'bg-white/20 text-slate-900 border border-slate-300/30 hover:bg-white/30 shadow-lg'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </a>
      </div>
      )}

      {/* QR-Code Scannen Button - über dem Info-Panel, nur wenn Panel nicht bewegt wird */}
      {selectedStation && !showStationList && !isPanelExpanded && dragOffset === 0 && !isFullScreenNavigation && (
        <>
          {/* QR-Code Scannen Button - zentriert */}
          <div className="fixed bottom-72 left-0 right-0 z-[1000] flex justify-center px-4 animate-slide-up">
            <button
              type="button"
              onClick={() => {
                setScanning(true);
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
                isDarkMode === true
                  ? 'bg-black/30 text-white border border-white/30 hover:bg-black/40' 
                  : 'bg-white/40 text-slate-900 border border-slate-400/40 hover:bg-white/50'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
              <span className="text-sm font-semibold">QR-Code Scannen</span>
            </button>
          </div>

          {/* Positionierungs-Button - rechts, größer */}
          <button
            type="button"
            onClick={centerOnStationAndFollow}
            aria-label="Auf Station zentrieren und Position verfolgen"
            className={`fixed bottom-72 right-4 z-[1001] flex items-center justify-center gap-2 px-5 py-3 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg animate-slide-up ${
              isStationFollowingActive 
                ? 'bg-emerald-600 text-white border-2 border-emerald-400 hover:bg-emerald-700 animate-pulse' 
                : isDarkMode === true
                  ? 'bg-black/30 text-white border border-white/30 hover:bg-black/40' 
                  : 'bg-white/40 text-slate-900 border border-slate-400/40 hover:bg-white/50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              <circle cx="12" cy="12" r="4" fill={isStationFollowingActive ? "currentColor" : "none"} />
              {isStationFollowingActive && (
                <circle cx="12" cy="12" r="2" fill="white" />
              )}
            </svg>
          </button>
        </>
      )}

      {/* Selected Station Info Panel - Full Width from Bottom */}
      {selectedStation && !showStationList && !isFullScreenNavigation && (
        <div className={`fixed bottom-0 left-0 right-0 z-[999] ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
          <div 
            className={`shadow-lg border-t flex flex-col rounded-t-3xl ${
              isDarkMode === true
                ? 'text-white border-gray-600' 
                : 'bg-white text-slate-900 border-slate-200'
            }`}
            style={{
              backgroundColor: isDarkMode === true ? '#282828' : 'white',
              height: isPanelExpanded 
                ? dragOffset < 0 
                  ? `calc(70vh + ${dragOffset}px)` 
                  : '80vh'
                : dragOffset > 0
                  ? `calc(17rem + ${dragOffset}px)`
                  : '17rem',
              maxHeight: '80vh',
              minHeight: 'auto',
              transition: dragOffset === 0 ? 'height 0.3s ease-out' : 'none'
            }}
          >
            {/* Drag Handle - zum Erweitern/Verkleinern */}
            <div 
              className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className={`w-12 h-1 rounded-full transition-all ${
                isDarkMode === true ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            </div>

            {/* Scrollable Content Area */}
            <div className={`flex-1 ${isPanelExpanded ? 'overflow-y-auto' : 'overflow-hidden'} px-5 ${isPanelExpanded ? '' : 'pb-6'} relative`}>
              {/* Close Button - rechts oben */}
              <button
                onClick={clearHighlight}
                className={`absolute -top-3 right-4 p-2 rounded-full transition-colors ${
                  isDarkMode === true ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
                }`}
                aria-label="Schließen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              {/* Station Name - größer */}
              <h3 className="text-lg font-semibold mb-1 pr-10">{panelStation?.name}</h3>

              {/* Hauptbereich: Info links, Foto rechts */}
              <div className="flex gap-4">
                {/* Linke Seite: Info */}
                <div className="flex-1 space-y-1.5">
                  {/* Verfügbare Powerbanks */}
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="5 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${panelStation && isStationOnline(panelStation) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      <path d="M13 11h3l-4 6v-4H9l4-6v4z"/>
                    </svg>
                    <span className="text-base -ml-2">
                      <span className="font-semibold">{panelStation ? computeRealAvailability(panelStation) : 0}</span> verfügbar
                    </span>
                  </div>

                  {/* Verbindungsstatus */}
                  {panelStation && !isStationOnline(panelStation) && (
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                      isDarkMode === true ? 'bg-red-900/30' : 'bg-red-50'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className={`text-xs font-medium ${isDarkMode === true ? 'text-red-400' : 'text-red-600'}`}>
                        Station offline
                      </span>
                    </div>
                  )}
                  {panelStation && isStationOnline(panelStation) && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className={`text-xs font-medium ${isDarkMode === true ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Verbunden
                      </span>
                    </div>
                  )}

                  {/* Kosten */}
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <path d="M2 10h20"/>
                    </svg>
                    <span className="text-base">
                      <span className="font-semibold">0,10€</span> zum Start, anschließend <span className="font-semibold">0,05€</span>/Min
                    </span>
                  </div>

                  {/* Öffnungsstatus (nur Geöffnet/Geschlossen) */}
                  {panelStation?.opening_hours && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${
                        isStationOpen(panelStation.opening_hours) 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span className={`text-sm font-semibold ${
                        isStationOpen(panelStation.opening_hours) 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isStationOpen(panelStation.opening_hours) ? 'Geöffnet' : 'Geschlossen'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rechte Seite: Powerbank Bild */}
                <div className="w-24 h-24 flex-shrink-0">
                  <img 
                    src="/powerbank.jpg" 
                    alt="Powerbank"
                    className="w-full h-full object-contain rounded-lg shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-2"
                    onError={(e) => {
                      // Fallback zu PNG wenn JPG nicht existiert
                      const target = e.target as HTMLImageElement;
                      if (target.src.endsWith('.jpg')) {
                        target.src = '/powerbank.png';
                      } else {
                        // Wenn beide nicht existieren, zeige Placeholder
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-full rounded-lg flex items-center justify-center ${
                              isDarkMode === true ? 'bg-gray-700/50' : 'bg-gray-200'
                            }">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-40">
                                <path d="M13 11h3l-4 6v-4H9l4-6v4z"/>
                              </svg>
                            </div>
                          `;
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Erweiterte Informationen - nur wenn Panel erweitert ist */}
              {isPanelExpanded && (
                <div className="mt-4 space-y-3">
                  {/* FOTO-CAROUSEL – nur anzeigen, wenn der Owner Fotos hinzugefügt hat */}
                  {(() => {
                    const allPhotos: string[] = [];
                    if (panelStation?.photos && Array.isArray(panelStation.photos)) {
                      allPhotos.push(...panelStation.photos.filter((url): url is string => typeof url === 'string' && url.length > 0));
                    }
                    if (panelStation?.photo_url && !allPhotos.includes(panelStation.photo_url)) {
                      allPhotos.unshift(panelStation.photo_url);
                    }
                    const displayPhotos = allPhotos
                      .slice(0, 3)
                      .map(getAbsoluteStationPhotoUrl)
                      .filter(Boolean) as string[];
                    if (displayPhotos.length === 0) return null;
                    return (
                      <div className="w-full">
                        <PhotoCarousel photos={displayPhotos} isDarkMode={isDarkMode === true} />
                      </div>
                    );
                  })()}

                  {/* Öffnungszeiten */}
                  {panelStation?.opening_hours && (
                    <div className={`p-3 rounded-lg ${
                      isDarkMode === true ? 'bg-gray-700/30' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-500 dark:text-gray-400 mt-0.5">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <div className="flex-1">
                          <div className="text-xs opacity-70 mb-1">🕐 Öffnungszeiten</div>
                          <div className="text-sm">{panelStation.opening_hours}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Adresse */}
                  {panelStation?.address && (
                    <div className={`p-3 rounded-lg ${
                      isDarkMode === true ? 'bg-gray-700/30' : 'bg-gray-50'
                    }`}>
                      <div className="text-xs opacity-70 mb-1">📍 Adresse</div>
                      <div className="text-sm">{panelStation.address}</div>
                    </div>
                  )}

                  {/* Beschreibung */}
                  {panelStation?.description && (
                    <div className={`p-3 rounded-lg ${
                      isDarkMode === true ? 'bg-gray-700/30' : 'bg-gray-50'
                    }`}>
                      <div className="text-xs opacity-70 mb-1">ℹ️ Information</div>
                      <div className="text-sm">{panelStation.description}</div>
                    </div>
                  )}

                  {/* Navigation Section */}
                  <div className="space-y-3">
                    {/* Navigation Status */}
                    {isNavigating && (
                      <div className={`p-3 rounded-xl border ${
                        isDarkMode === true 
                          ? 'bg-emerald-900/30 border-emerald-700' 
                          : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-semibold text-emerald-600">Navigation aktiv</span>
                          </div>
                          <button
                            onClick={stopNavigation}
                            className="p-1 rounded-full hover:bg-emerald-200/50 transition-colors"
                            aria-label="Navigation beenden"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                        
                        {/* Distance and Time */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-center">
                            <div className="font-bold text-emerald-600">
                              {distanceToDestination < 1000 
                                ? `${distanceToDestination}m` 
                                : `${(distanceToDestination / 1000).toFixed(1)}km`
                              }
                            </div>
                            <div className="text-xs opacity-70">Entfernung</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-emerald-600">
                              {timeToDestination} Min
                            </div>
                            <div className="text-xs opacity-70">Geschätzte Zeit</div>
                          </div>
                        </div>
                        
                        {/* Current Instruction */}
                        {currentInstruction && (
                          <div className="mt-2 p-2 rounded-lg bg-white/50 dark:bg-black/20">
                            <div className="text-xs font-medium text-emerald-600 mb-1">Aktuelle Anweisung:</div>
                            <div className="text-sm">{currentInstruction}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="space-y-2">
                      {!isNavigating ? (
                        <button
                          onClick={() => (panelStation ?? selectedStation) && startNavigation(panelStation ?? selectedStation)}
                          className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm ${
                            isDarkMode === true
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          } flex items-center justify-center gap-2`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 11l19-9-9 19-2-8-8-2z" />
                          </svg>
                          Navigation starten
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={toggleVoiceNavigation}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              voiceEnabled 
                                ? 'bg-emerald-600 text-white' 
                                : isDarkMode === true 
                                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                            } flex items-center justify-center gap-2`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              <line x1="12" y1="19" x2="12" y2="23"/>
                              <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                            {voiceEnabled ? 'Stumm' : 'Laut'}
                          </button>
                          
                          <button
                            onClick={stopNavigation}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Beenden
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Reservieren Button - Fixed at bottom */}
            <div className={`flex-shrink-0 px-4 pb-5 pt-3 border-t ${
              isDarkMode === true ? 'border-gray-600/30' : 'border-gray-200'
            }`}
              style={isDarkMode === true ? { backgroundColor: '#282828' } : { backgroundColor: 'white' }}
            >
              <button
                type="button"
                onClick={async () => {
                  const stationForRental = panelStation ?? selectedStation;
                  if (!stationForRental) {
                    return;
                  }

                  try {
                    const {
                      data: { user },
                      error: userError,
                    } = await supabase.auth.getUser();

                    if (userError || !user) {
                      const currentUrl =
                        window.location.pathname + window.location.search;
                      window.location.href = `/login?returnUrl=${encodeURIComponent(currentUrl)}`;
                      return;
                    }

                    const reservationEndMs = Date.now() + 10 * 60 * 1000;
                    const reservedAt = new Date(reservationEndMs).toISOString();

                    await supabase
                      .from("reservations")
                      .update({ status: "cancelled" })
                      .eq("user_id", user.id)
                      .in("status", ["pending", "confirmed"]);

                    const { error: reservationError } = await supabase
                      .from("reservations")
                      .insert({
                        user_id: user.id,
                        station_id: stationForRental.id,
                        reserved_at: reservedAt,
                        status: "confirmed",
                      });

                    if (reservationError) {
                      throw reservationError;
                    }

                    sessionStorage.setItem(
                      "rental_reservation_end",
                      String(reservationEndMs)
                    );
                    alert("Powerbank fuer 10 Minuten reserviert.");
                  } catch (err) {
                    logger.error("Fehler bei der Reservierung:", err);
                    alert(
                      "Reservierung fehlgeschlagen. Bitte versuchen Sie es erneut."
                    );
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3.5 shadow-md active:scale-95 transition-transform"
              >
                <span className="text-lg font-semibold">Reservieren</span>
                <span className="text-base opacity-80">· kostenlos fuer 10 Min</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby stations text */}
      {!isFullScreenNavigation && (
        <div className="fixed left-1/2 top-4 z-[1001] transform -translate-x-1/2">
        <button
          onClick={() => {
            logger.dev('Button clicked! Current state:', showStationList, 'Nearby stations:', nearbyStations.length);
            setShowStationList(!showStationList);
          }}
          className={`flex items-center gap-2.5 px-5 h-10 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
            isDarkMode === true
              ? 'bg-black/30 text-white border border-white/30 hover:bg-black/40' 
              : 'bg-white/40 text-slate-900 border border-slate-400/40 hover:bg-white/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${nearbyStations.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-sm font-semibold whitespace-nowrap">
            {nearbyStations.length} Station{nearbyStations.length !== 1 ? 'en' : ''} in der Nähe
          </span>
          {/* Chevron Icon to indicate it's clickable */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="16" 
            height="16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${showStationList ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        </div>
      )}

      {/* Station list */}
      {showStationList && userLocation && nearbyStations.length > 0 && (
        <div className="fixed left-1/2 top-16 z-[999] transform -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)]">
          <div className={`rounded-2xl shadow-xl backdrop-blur-md border ${
            isDarkMode === true
              ? 'text-white border-gray-600' 
              : 'bg-white/95 text-slate-900 border-gray-200'
          }`}
          style={{
            backgroundColor: isDarkMode === true ? '#282828' : 'rgba(255, 255, 255, 0.95)'
          }}>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Stationen in der Nähe</h3>
              <div className="space-y-3">
                {nearbyStations.map((station) => {
                  const distance = calculateDistance(userLocation.lat, userLocation.lng, station.lat, station.lng);
                  return (
                    <button
                      key={station.id}
                      onClick={() => highlightStation(station)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                        isDarkMode === true
                          ? 'bg-gray-700/30 hover:bg-gray-700/50 active:bg-gray-600/50' 
                          : 'bg-gray-50/50 hover:bg-gray-50/70 active:bg-gray-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                        <div className="text-left">
                          <div className="font-medium">{station.name}</div>
                          <div className="text-sm opacity-75">{Math.round(distance)}m entfernt</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          isStationOnline(station) 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {computeRealAvailability(station)} verfügbar
                        </div>
                        {!isStationOnline(station) && (
                          <div className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                            Offline
                          </div>
                        )}
                        <div className="text-xs opacity-60 mt-1">
                          Details →
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Positionierungsknopf - unten rechts, höher positioniert */}
      {!selectedStation && !isFullScreenNavigation && (
        <button
          type="button"
          onClick={locateMe}
          aria-label={
            isFollowingLocation 
              ? "3D-Modus aktiv (klicken zum Deaktivieren)" 
              : isCentered
                ? "Zentriert (klicken für 3D-Modus)"
                : "Meine Position zentrieren"
          }
          className={`fixed bottom-28 right-4 z-[1000] grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
            isFollowingLocation 
              ? 'bg-emerald-600 text-white border-2 border-emerald-400 hover:bg-emerald-700 animate-pulse' // Grüner Hintergrund + Puls-Animation im Following-Modus
              : isDarkMode === true
                ? 'bg-black/20 text-white border border-white/20 hover:bg-black/30' 
                : 'bg-white/20 text-slate-900 border border-slate-300/30 hover:bg-white/30'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <circle cx="12" cy="12" r="4" fill={isFollowingLocation ? "currentColor" : "none"} />
            {isFollowingLocation && (
              <circle cx="12" cy="12" r="2" fill="white" />
            )}
          </svg>
        </button>
      )}

      {/* Bottom Action Button - nur anzeigen wenn keine Station ausgewählt */}
      {!selectedStation && !isFullScreenNavigation && (
        activeRental ? (
          <button
            type="button"
            onClick={() => {
              if (!userLocation || stations.length === 0) return;
              const sorted = [...stations].sort((a, b) => {
                const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
                const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
                return distA - distB;
              });
              if (sorted.length > 0) {
                highlightStation(sorted[0]);
              }
            }}
            className="fixed bottom-5 left-4 right-4 z-[1000] flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-12 shadow-lg active:scale-95 border border-emerald-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-base font-semibold tracking-wide">Nächste Station finden</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setScanning(true);
            }}
            className="fixed bottom-5 left-4 right-4 z-[1000] flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-12 shadow-lg active:scale-95 border border-emerald-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
            <span className="text-base font-semibold tracking-wide">Scannen</span>
          </button>
        )
      )}
      

      {/* Full Screen Navigation Interface */}
      {isFullScreenNavigation && (
        <div className="fixed inset-0 z-[2000] pointer-events-none">
          {/* Navigation Header */}
          <div className="absolute top-0 left-0 right-0 z-[2001] p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <div>
                  <div className="text-white text-lg font-semibold">Navigation aktiv</div>
                  <div className="text-emerald-400 text-sm">{selectedStation?.name}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pointer-events-auto">
                {/* Voice Toggle */}
                <button
                  onClick={toggleVoiceNavigation}
                  className={`p-3 rounded-full transition-colors ${
                    voiceEnabled 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  aria-label={voiceEnabled ? "Sprachansagen deaktivieren" : "Sprachansagen aktivieren"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                
                {/* Stop Navigation */}
                <button
                  onClick={stopNavigation}
                  className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                  aria-label="Navigation beenden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Info - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-[2001] p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between mb-4">
              {/* Distance and Time */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-400">
                    {distanceToDestination < 1000 
                      ? `${distanceToDestination}m` 
                      : `${(distanceToDestination / 1000).toFixed(1)}km`
                    }
                  </div>
                  <div className="text-white/70 text-sm">Entfernung</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-400">
                    {timeToDestination} Min
                  </div>
                  <div className="text-white/70 text-sm">Geschätzte Zeit</div>
                </div>
              </div>
              
              {/* Location Toggle Button - Follow vs Fixed */}
              <div className="pointer-events-auto">
                <button
                  onClick={() => {
                    if (userLocation && mapRef.current) {
                      const map = mapRef.current;
                      
                      if (isLocationFixed) {
                        // Currently fixed - switch to following mode
                        logger.dev('Switching from FIXED to FOLLOWING mode');
                        setIsLocationFixed(false);
                        // Reset map bearing to north
                        map.setBearing(0);
                        // Center map on user location and start following
                        map.flyTo({
                          center: [userLocation.lng, userLocation.lat],
                          zoom: 19, // High zoom for detailed navigation
                          bearing: 0, // Reset rotation
                          essential: true,
                          duration: 1000 // Smooth animation
                        });
                        logger.dev('Now in FOLLOWING mode - map will follow user');
                      } else {
                        // Currently following - switch to fixed mode
                        logger.dev('Switching from FOLLOWING to FIXED mode');
                        setIsLocationFixed(true);
                        // Center map perfectly on user location
                        map.flyTo({
                          center: [userLocation.lng, userLocation.lat],
                          zoom: 19,
                          bearing: 0, // Reset rotation for fixed mode
                          essential: true,
                          duration: 1000
                        });
                        logger.dev('Now in FIXED mode - map will NOT follow user');
                      }
                    }
                  }}
                  className={`p-3 rounded-full transition-colors ${
                    isLocationFixed 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  aria-label={isLocationFixed ? "Position fixiert (grün) - Karte folgt NICHT - zum Folgen wechseln" : "Position folgt (transparent) - Karte folgt Benutzer - zum Fixieren wechseln"}
                >
                  {isLocationFixed ? (
                    // Fixed mode icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  ) : (
                    // Following mode icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Current Instruction */}
            {currentInstruction && (
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
                  </svg>
                  <span className="text-emerald-400 font-semibold text-sm">Aktuelle Anweisung:</span>
                </div>
                <div className="text-white text-lg font-medium">{currentInstruction}</div>
              </div>
            )}

            {/* Navigation Steps */}
            {navigationInstructions.length > 0 && (
              <div className="bg-black/40 rounded-xl p-3">
                <div className="text-white/70 text-sm font-semibold mb-2">Nächste Schritte:</div>
                <div className="space-y-1">
                  {navigationInstructions.slice(0, 2).map((instruction, index) => (
                    <div key={index} className="text-white/80 text-sm flex items-start gap-2">
                      <span className="text-emerald-400 font-bold text-xs mt-1">{index + 1}.</span>
                      <span>{instruction}</span>
                    </div>
                  ))}
                  {navigationInstructions.length > 2 && (
                    <div className="text-white/50 text-xs text-center">
                      ... und {navigationInstructions.length - 2} weitere Schritte
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      
      {scanning && (
        <CameraOverlay 
          onClose={() => setScanning(false)}
          onStationScanned={async (stationId: string) => {
            setScanning(false);
            const scannedId = stationId.trim();
            if (!scannedId) {
              alert("Ungueltiger QR-Code.");
              return;
            }

            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }

            const theme = isDarkMode === true ? "dark" : "light";
            window.location.href = `/rent/${encodeURIComponent(scannedId)}?theme=${theme}`;
          }}
        />
      )}
      {showRentalModal && scannedStation && (
        <RentalConfirmationModal
          station={stations.find((s) => s.id === scannedStation.id) ?? scannedStation}
          onClose={() => {
            setShowRentalModal(false);
            setScannedStation(null);
          }}
          onConfirm={async () => {
            const currentStation = stations.find((s) => s.id === scannedStation.id) ?? scannedStation;

            // 1. Aktuellen User holen
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
              throw new Error('Bitte melden Sie sich an, um eine Powerbank auszuleihen.');
            }

            // 2. Verbindungsstatus prüfen und available_units synchronisieren
            const { data: batteryCheck } = await supabase
              .from('stations')
              .select('battery_voltage, battery_percentage, available_units, last_seen, updated_at')
              .eq('id', currentStation.id)
              .single();

            // Station offline? Ausleihe verhindern
            if (batteryCheck && !isStationOnline(batteryCheck)) {
              throw new Error('Diese Station ist derzeit nicht verbunden. Bitte versuche es später erneut.');
            }

            if (batteryCheck) {
              const realAvailable = computeRealAvailability(batteryCheck);
              if ((batteryCheck.available_units ?? 0) < realAvailable) {
                await supabase
                  .from('stations')
                  .update({ available_units: realAvailable })
                  .eq('id', currentStation.id);
              }
            }

            // 3. Geolocation holen
            const getPosition = () =>
              new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation wird nicht unterstützt.'));
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
              throw new Error('Standort konnte nicht ermittelt werden. Bitte Standortzugriff erlauben.');
            }

            // 4. Ausleihe über RPC erstellen (erstellt Rental + setzt dispense_requested)
            const withGeo = await supabase.rpc('create_rental', {
              p_user_id: user.id,
              p_station_id: currentStation.id,
              p_user_lat: userLat,
              p_user_lng: userLng,
            });

            const shouldFallbackToLegacy =
              !!withGeo.error &&
              (
                withGeo.error.code === 'PGRST202' ||
                `${withGeo.error.message ?? ''} ${withGeo.error.details ?? ''}`.includes('does not exist') ||
                `${withGeo.error.message ?? ''} ${withGeo.error.details ?? ''}`.includes('create_rental(uuid,uuid,double precision,double precision)')
              );

            const { data: rentalData, error: rentalError } = shouldFallbackToLegacy
              ? await supabase.rpc('create_rental', {
                  p_user_id: user.id,
                  p_station_id: currentStation.id,
                })
              : withGeo;

            if (rentalError) {
              const msg = rentalError.message || '';
              if (msg.includes('MIN_BALANCE')) throw new Error('Du benötigst mindestens 5,00 € Guthaben.');
              if (msg.includes('OUT_OF_RANGE')) throw new Error('Du bist zu weit von der Station entfernt (max. 100 m).');
              if (msg.includes('STATION_NOT_FOUND')) throw new Error('Station nicht gefunden.');
              if (msg.includes('STATION_INACTIVE')) throw new Error('Station ist nicht aktiv.');
              if (msg.includes('NO_UNITS_AVAILABLE')) throw new Error('Keine Powerbanks verfügbar.');
              if (msg.includes('HAS_ACTIVE_RENTAL')) throw new Error('Du hast bereits eine aktive Ausleihe.');
              if (msg.includes('Keine verfügbare Powerbank')) throw new Error('Keine Powerbanks verfügbar.');
              if (msg.includes('bereits eine aktive Powerbank-Ausleihe')) throw new Error('Du hast bereits eine aktive Ausleihe.');
              throw new Error('Fehler beim Erstellen der Ausleihe.');
            }

            if (!rentalData?.success) {
              throw new Error('Ausleihe konnte nicht erstellt werden.');
            }

            logger.dev('Ausleihe erfolgreich erstellt:', rentalData);
            await notifyRentalSuccess(currentStation.name, '/').catch(() => {});
          }}
          onPickupComplete={() => {
            setShowRentalModal(false);
            setScannedStation(null);
            fetchActiveRentalWithRetry();
          }}
          isDarkMode={isDarkMode === true}
        />
      )}
      <SideMenu 
        open={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        isDarkMode={isDarkMode === true}
        onToggleTheme={() => {
          const newTheme = isDarkMode === false ? "dark" : "light";
          if (typeof localStorage !== "undefined") localStorage.setItem("theme", newTheme);
          if (newTheme === "light") document.documentElement.classList.remove("dark");
          else document.documentElement.classList.add("dark");
          const url = new URL(window.location.href);
          url.searchParams.set("theme", newTheme);
          window.location.href = url.toString();
        }}
      />
    </>
  );
}

// Wrapper component that uses useSearchParams
export default function MapViewMapbox() {
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme");
  
  return <MapViewContent initialTheme={themeParam} />;
}
