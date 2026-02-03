"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CameraOverlay from "@/components/CameraOverlay";
import SideMenu from "@/components/SideMenu";
import StationManager, { Station } from "@/components/StationManager";
import RentalConfirmationModal from "@/components/RentalConfirmationModal";
import mapboxgl from "mapbox-gl";
import { notifyRentalSuccess, notifyRentalError } from "@/lib/notifications";
import { getAbsoluteStationPhotoUrl } from "@/lib/photoUtils";

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

  // Debug: Log stations when they change
  useEffect(() => {
    console.log('Stations updated:', stations.length, stations);
  }, [stations]);

  // Read theme from initial prop
  useEffect(() => {
    if (initialTheme === "light") {
      setIsDarkMode(false);
    } else if (initialTheme === "dark") {
      setIsDarkMode(true);
    } else {
      // Default to dark mode if no theme parameter
      setIsDarkMode(true);
    }
  }, [initialTheme]);

  // Get user's current location - nur einmal beim Laden
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      // Fallback to Berlin coordinates
      setUserLocation({ lat: 52.52, lng: 13.405 });
      setLocationLoading(false);
      return;
    }

    // Explizite Berechtigungsanfrage für Standort
    const requestLocationPermission = async () => {
      try {
        console.log('Requesting location permission...');
        
        // Versuche Standort zu erhalten - das triggert die Berechtigungsanfrage
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, heading } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            if (heading !== null && !isNaN(heading)) {
              setUserHeading(heading);
            }
            setLocationLoading(false);
            setLocationPermissionGranted(true);
            setShowPermissionModal(false);
            
            console.log('User location obtained:', { lat: latitude, lng: longitude, heading });
          },
          (error) => {
            console.error('Geolocation error:', error);
            if (error.code === error.PERMISSION_DENIED) {
              console.warn('Location permission denied by user');
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
        console.error('Permission request error:', error);
        setUserLocation({ lat: 52.52, lng: 13.405 });
        setLocationLoading(false);
      }
    };

    requestLocationPermission();
    
    // Kompass-Berechtigung anfragen
    requestCompassPermission();
  }, []);

  // Explizite Berechtigungsanfrage beim ersten Laden
  useEffect(() => {
    if (!permissionRequested && navigator.geolocation) {
      setPermissionRequested(true);
      console.log('Requesting explicit location permission...');
      
      // Explizite Berechtigungsanfrage
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location permission granted');
          setLocationPermissionGranted(true);
          setShowPermissionModal(false);
        },
        (error) => {
          console.log('Location permission denied or error:', error);
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
    
    console.log('Requesting location permission again...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        if (heading !== null && !isNaN(heading)) {
          setUserHeading(heading);
        }
        setLocationPermissionGranted(true);
        setShowPermissionModal(false);
        setLocationLoading(false);
        console.log('Location permission granted:', { lat: latitude, lng: longitude, heading });
      },
      (error) => {
        console.error('Location permission still denied:', error);
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

  // Funktion um Kompass-Berechtigung anzufragen
  const requestCompassPermission = async () => {
    try {
      console.log('Requesting compass permission...');
      
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        console.log('Compass permission response:', response);
        
        if (response === 'granted') {
          setCompassPermissionGranted(true);
          console.log('Compass permission granted');
        } else {
          setCompassPermissionGranted(false);
          console.warn('Compass permission denied');
        }
      } else {
        // Fallback für Browser ohne Permission API
        setCompassPermissionGranted(true);
        console.log('Compass permission not required - using fallback');
      }
    } catch (error) {
      console.error('Compass permission error:', error);
      // Fallback: Versuche trotzdem zu funktionieren
      setCompassPermissionGranted(true);
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
    
    try {
      const map = mapRef.current;
      
      // Beende Following-Modus und Zentrierung wenn Navigation gestartet wird
      setIsCentered(false);
      if (isFollowingLocation) {
        console.log('Navigation started - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      
      // Get Mapbox access token
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.error('Mapbox access token not found');
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
            console.log('Error removing existing walking route:', error instanceof Error ? error.message : String(error));
          }
          routeLayerRef.current = null;
        }
        
        // Remove walking time label if any
        if (walkingTimeLabelRef.current) {
          try {
            walkingTimeLabelRef.current.remove();
          } catch (error) {
            console.log('Error removing walking time label:', error instanceof Error ? error.message : String(error));
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
        console.log('Starting navigation - updating user marker with direction');
        updateUserMarker(userLocation, userHeading || 0, true);
        
        // Also update after a short delay to ensure state is set
        setTimeout(() => {
          console.log('Delayed update of user marker for navigation');
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
        
        console.log('Navigation started to:', station.name);
      }
    } catch (error) {
      console.error('Error starting navigation:', error);
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
          console.log('Error removing existing route:', error instanceof Error ? error.message : String(error));
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
        console.log('Route cleanup - some layers/sources may not exist:', error instanceof Error ? error.message : String(error));
      }
      
      // Get Mapbox access token
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.error('Mapbox access token not found');
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
        
        console.log('Walking route added to map with time:', walkingTimeMinutes, 'minutes');
      }
    } catch (error) {
      console.error('Error adding walking route:', error);
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
      
      console.log('Destination marker added for:', station.name);
    } catch (error) {
      console.error('Error adding destination marker:', error);
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
        console.log('Highlight marker re-added for selected station:', selectedStation.name);
      }
      
      // Force re-render of station markers by triggering the useEffect
      // This ensures all station markers are visible after navigation ends
      setForceStationRerender(prev => prev + 1);
      
      // Ensure the panel is in collapsed state for the selected station
      if (selectedStation) {
        setIsPanelExpanded(false);
        console.log('Panel collapsed for selected station:', selectedStation.name);
        
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
          
          console.log('Map centered on selected station after navigation:', selectedStation.name);
        }
      }
      
      console.log('Navigation cleared');
    } catch (error) {
      console.error('Error clearing navigation:', error);
    }
  };

  // Function to stop navigation
  const stopNavigation = () => {
    clearNavigation();
    // Ensure user marker is updated to normal mode but keep direction
    if (userLocation) {
      updateUserMarker(userLocation, userHeading, false);
    }
    console.log('Navigation stopped');
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
        console.log('Speaking instruction:', text);
      }
    } catch (error) {
      console.error('Error speaking instruction:', error);
    }
  };

  // Function to toggle voice navigation
  const toggleVoiceNavigation = () => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled && currentInstruction) {
      speakInstruction(currentInstruction);
    }
  };

  // Function to start location tracking during navigation
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        // Update user location and heading
        setUserLocation(newLocation);
        
        // Verbesserte Heading-Verarbeitung für mobile Geräte
        let calculatedHeading = userHeading; // Fallback auf aktuellen Heading
        
        if (heading !== null && !isNaN(heading) && heading >= 0) {
          // GPS Heading ist verfügbar
          calculatedHeading = heading;
          setUserHeading(heading);
        } else if (lastLocation && speed && speed > 0.5) {
          // Fallback: Berechne Heading basierend auf Bewegungsrichtung
          const deltaLat = newLocation.lat - lastLocation.lat;
          const deltaLng = newLocation.lng - lastLocation.lng;
          const bearing = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
          calculatedHeading = (bearing + 360) % 360; // Normalisiere auf 0-360°
          setUserHeading(calculatedHeading);
        }
        
        // Kompass-Richtung für Location Tracking - verwende Device Orientation direkt
        if (deviceOrientation !== null && !isNaN(deviceOrientation) && compassPermissionGranted) {
          // Device Orientation Event: alpha = rotation around z-axis (compass heading)
          calculatedHeading = deviceOrientation;
        }
        
        // Update user marker on map with direction - always show direction if available
        updateUserMarker(newLocation, calculatedHeading, isNavigating);
        
        // Update navigation if active
        if (isNavigating && selectedStation) {
          updateNavigationProgress(newLocation, selectedStation);
        }
        
        // Following-Modus: Karte folgt der Position
        if (isFollowingLocation && mapRef.current && !isNavigating) {
          const map = mapRef.current;
          
          // Berechne Bearing basierend auf Geräteausrichtung oder Bewegungsrichtung
          let targetBearing = 0;
          if (is3DFollowing) {
            if (deviceOrientation !== null && !isNaN(deviceOrientation) && compassPermissionGranted) {
              targetBearing = -deviceOrientation + 180;
            } else if (calculatedHeading !== null && !isNaN(calculatedHeading)) {
              targetBearing = -calculatedHeading;
            }
          }
          
          // Einfache Kartenaktualisierung
          map.easeTo({
            center: [newLocation.lng, newLocation.lat],
            bearing: targetBearing,
            pitch: is3DFollowing ? 60 : 0,
            duration: 500,
            essential: true
          });
        }
        
        // Speichere aktuelle Position für nächste Heading-Berechnung
        setLastLocation(newLocation);
        
        console.log('Location updated:', {
          location: newLocation,
          heading: calculatedHeading,
          speed,
          accuracy
        });
      },
      (error) => {
        console.error('Geolocation error during navigation:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500, // Akzeptiere GPS-Daten die bis zu 0.5 Sekunde alt sind
        timeout: 10000
      }
    );
    
    setWatchId(watchId);
    console.log('Location tracking started for navigation');
  };

  // Function to stop location tracking
  const stopLocationTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      console.log('Location tracking stopped');
    }
  };


  // Function to update user marker with direction
  const updateUserMarker = (location: {lat: number, lng: number}, heading?: number | null, forceNavigationMode?: boolean) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Get current map bearing for 3D mode
      const mapBearing = map.getBearing();
      const mapPitch = map.getPitch();
      const isIn3DMode = mapPitch > 30; // Consider 3D mode if pitch > 30 degrees
      
      // Check if marker already exists
      if (userMarkerRef.current) {
        // Just update position - no direction indicator needed
        userMarkerRef.current.setLngLat([location.lng, location.lat]);
        return; // Exit early if marker already exists
      }
      
      // Create new marker
      const userElement = document.createElement('div');
      
      // Always show simple marker - no direction indicator
      userElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="rgba(16,185,129,0.25)" />
          <circle cx="12" cy="12" r="5" fill="#10b981" />
        </svg>
      `;
      userElement.style.width = '28px';
      userElement.style.height = '28px';
      userElement.style.cursor = 'pointer';
      
      // Add user marker
      const userMarker = new mapboxgl.Marker({
        element: userElement,
        anchor: 'center'
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
      
      userMarkerRef.current = userMarker;
      console.log('User marker updated: normal mode', 'heading:', heading);
    } catch (error) {
      console.error('Error updating user marker:', error);
    }
  };

  // Function to center map on user and start following
  const centerMapOnUserAndFollow = () => {
    if (!mapRef.current || !userLocation) return;
    
    try {
      const map = mapRef.current;
      
      // Center map on user location with high zoom
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 19, // High zoom for detailed navigation
        bearing: 0, // Reset rotation for navigation
        essential: true,
        duration: 1500
      });
      
      console.log('Map centered on user location for navigation');
    } catch (error) {
      console.error('Error centering map on user:', error);
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
        
        console.log('Following mode: Map centered on user location');
      } else {
        // In fixed mode, only update the user marker position without moving the map
        console.log('Fixed mode: Map will not follow user movement, only marker updates');
      }
      
      // Check if user is close to destination (within 10 meters)
      if (distance < 10) {
        // User has arrived at destination
        console.log('User has arrived at destination!');
        if (voiceEnabled) {
          speakInstruction('Sie haben Ihr Ziel erreicht!');
        }
        // Optionally stop navigation automatically
        // stopNavigation();
      }
      
    } catch (error) {
      console.error('Error updating navigation progress:', error);
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
          console.log('Error removing existing walking time label:', error instanceof Error ? error.message : String(error));
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
      console.log('Walking time label added:', walkingTimeMinutes, 'minutes');
    } catch (error) {
      console.error('Error adding walking time label:', error);
    }
  };

  // Function to highlight and zoom to a station on the map
  const highlightStation = async (station: Station) => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Beende Following-Modus wenn Station ausgewählt wird
      if (isFollowingLocation) {
        console.log('Station selected - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      // Deaktiviere Station-Following wenn neue Station ausgewählt wird
      setIsStationFollowingActive(false);
      
      // Debug: Log station coordinates and validate them
      console.log('Highlighting station:', station.name, 'Coordinates:', { lat: station.lat, lng: station.lng });
      
      // Validate coordinates
      if (!station.lat || !station.lng || isNaN(station.lat) || isNaN(station.lng)) {
        console.error('Invalid station coordinates:', station);
        return;
      }
      
      // If we're in navigation mode, automatically start navigation to the new station
      if (isNavigating) {
        console.log('Navigation mode active - switching to new station:', station.name);
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
      console.log('✅ Jumping instantly to coordinates:', targetCenter);
      
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
      
      console.log('Station highlighted and map centered on:', { lng: station.lng, lat: station.lat + latOffset });
      console.log('🔍 Panel State:', {
        selectedStation: !!station,
        showStationList: false,
        userLocation: !!userLocation,
        isPanelExpanded: true,
        isClosing: false,
        isFullScreenNavigation: false
      });
      console.log('📋 Station Data:', {
        name: station.name,
        address: station.address || 'NICHT VORHANDEN',
        description: station.description || 'NICHT VORHANDEN',
        opening_hours: station.opening_hours || 'NICHT VORHANDEN',
        photos: station.photos?.length || 0,
        photo_url: station.photo_url || 'NICHT VORHANDEN'
      });
    } catch (error) {
      console.error('Error highlighting station:', error);
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
          console.log('Error removing highlight marker:', error instanceof Error ? error.message : String(error));
        }
        highlightMarkerRef.current = null;
      }
      
      // Remove walking time label
      if (walkingTimeLabelRef.current) {
        try {
          walkingTimeLabelRef.current.remove();
        } catch (error) {
          console.log('Error removing walking time label:', error instanceof Error ? error.message : String(error));
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
        console.log('Route cleanup - some layers/sources may not exist:', error instanceof Error ? error.message : String(error));
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
        console.log('Clearing highlight - deactivating following mode');
        setIsFollowingLocation(false);
        setIs3DFollowing(false);
        stopLocationTracking();
      }
      
      console.log('Station highlight and route cleared');
    } catch (error) {
      console.error('Error clearing highlight:', error);
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

  // Device orientation tracking for map rotation
  useEffect(() => {
    const handleOrientationChange = (event: DeviceOrientationEvent) => {
      console.log('Device Orientation Event:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute
      });
      
      if (event.alpha !== null) {
        // Device Orientation Event: alpha = rotation around z-axis (compass heading)
        // 0° = Norden, 90° = Osten, 180° = Süden, 270° = Westen
        // Für die Karte müssen wir das umkehren: 0° = Norden auf der Karte
        let compassHeading = event.alpha;
        
        // Normalisiere auf 0-360°
        if (compassHeading < 0) {
          compassHeading += 360;
        }
        
        setDeviceOrientation(compassHeading);
        
        // Update user heading with compass data for better accuracy
        setUserHeading(compassHeading);
        
        // Update user marker with new compass orientation
        if (userLocation) {
          updateUserMarker(userLocation, compassHeading, isNavigating);
        }
        
        console.log('Compass heading updated:', compassHeading, 'degrees');
      }
    };

    // Request permission for device orientation
    const requestDeviceOrientationPermission = async () => {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          console.log('Requesting device orientation permission...');
          const response = await (DeviceOrientationEvent as any).requestPermission();
          console.log('Device orientation permission response:', response);
          
          if (response === 'granted') {
            setCompassPermissionGranted(true);
            window.addEventListener('deviceorientation', handleOrientationChange);
            console.log('Device orientation permission granted - listener added');
          } else {
            console.warn('Device orientation permission denied - trying fallback');
            setCompassPermissionGranted(false);
            // Versuche trotzdem den Listener hinzuzufügen
            window.addEventListener('deviceorientation', handleOrientationChange);
          }
        } else {
          // Fallback for browsers that don't require permission
          console.log('Device orientation permission not required - adding listener');
          setCompassPermissionGranted(true);
          window.addEventListener('deviceorientation', handleOrientationChange);
        }
      } catch (error) {
        console.error('Device orientation permission error:', error);
        // Fallback: try to add listener anyway
        setCompassPermissionGranted(true);
        window.addEventListener('deviceorientation', handleOrientationChange);
      }
    };

    requestDeviceOrientationPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientationChange);
    };
  }, [isNavigating, isLocationFixed]);

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
          console.error('Mapbox access token not found. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables.');
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
        console.log('Mapbox map initialized successfully:', map);
        console.log('Map center set to:', center);

        // Add event listeners for map interactions
        map.on('dragstart', () => {
          // Wenn Benutzer die Karte manuell bewegt, beende Following-Modus komplett
          console.log('User drag detected - deactivating following mode');
          setIsCentered(false);
          setIsStationFollowingActive(false);
          setIsFollowingLocation(false);
          setIs3DFollowing(false);
          
          if (watchId !== null) {
            stopLocationTracking();
          }
          
          // Zurück zur normalen Ansicht
          if (map.getPitch() > 30) {
            map.easeTo({
              pitch: 0,
              duration: 500
            });
          }
        });

        map.on('pitchstart', () => {
          // Nur deaktivieren wenn Following aktiv ist (um programmatische Pitch-Änderungen zu ignorieren)
          if (!isFollowingLocation) return;
          
          console.log('User pitch detected - deactivating following mode');
          setIsCentered(false);
          setIsStationFollowingActive(false);
          setIsFollowingLocation(false);
          setIs3DFollowing(false);
          
          if (watchId !== null) {
            stopLocationTracking();
          }
        });

        // Update user marker when map bearing changes in 3D mode
        map.on('rotate', () => {
          if (userLocation && map.getPitch() > 30) {
            // Update marker direction in 3D mode when map rotates
            updateUserMarker(userLocation, userHeading, false);
          }
        });

        // Add user location marker if we have the location
        if (userLocation) {
          // Use updateUserMarker function to get proper direction display
          updateUserMarker(userLocation, userHeading, false);
          console.log('User marker added at:', userLocation, 'with heading:', userHeading);
        }

        // Force map to invalidate size and render
        setTimeout(() => {
          map.resize();
          console.log('Map resized and should be visible now');
        }, 100);

        return () => {
          if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing Mapbox map:', error);
      }
    };

    initMap();
  }, [center, isDarkMode, locationLoading, userLocation]);

  // Cleanup beim Component Unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
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
        console.log("Switching to Mapbox style:", newStyle);
        
        map.setStyle(newStyle);
      } catch (error) {
        console.error('Error changing map style:', error);
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
        console.log('Following mode activated - starting location tracking');
        startLocationTracking();
      }
      
      // Setze Pitch basierend auf 2D/3D-Modus
      const map = mapRef.current;
      if (is3DFollowing) {
        // 3D-Ansicht
        map.easeTo({
          pitch: 60,
          bearing: deviceOrientation !== 0 ? -deviceOrientation + 180 : map.getBearing(),
          duration: 800,
          essential: true
        });
      } else {
        // 2D-Ansicht
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 800,
          essential: true
        });
      }
    } else if (!isFollowingLocation && !isNavigating && watchId !== null) {
      // Following-Modus deaktiviert - stoppe Location Tracking nur wenn es läuft
      console.log('Following mode deactivated - stopping location tracking');
      stopLocationTracking();
      
      // Zurück zur 2D-Ansicht
      if (mapRef.current) {
        const map = mapRef.current;
        map.easeTo({
          pitch: 0,
          duration: 800,
          essential: true
        });
      }
    }
  }, [isFollowingLocation, is3DFollowing, isNavigating]);

  // Stationen auf Karte anzeigen
  useEffect(() => {
    if (!mapRef.current || stations.length === 0) {
      console.log('Map not ready or no stations available');
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
          
          const marker = new mapboxgl.Marker({
            element: stationElement,
            anchor: 'bottom'
          })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          
          // Add click handler to open info panel
          marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            console.log('Marker clicked:', s.name);
            highlightStation(s);
          });
          
          stationsLayerRef.current.push(marker);
        });
        
        console.log(`Successfully added ${stations.length} station markers to map`);
      } catch (error) {
        console.error('Error adding markers to map:', error);
      }
    };
    
    addMarkers();
  }, [stations, mapRef.current, userLocation, selectedStation, isNavigating, forceStationRerender]);

  async function locateMe() {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    // Explizite Berechtigungsanfrage für Standort
    try {
      console.log('Requesting location permission for locateMe...');
      
      // Prüfe ob Permission API verfügbar ist
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('Geolocation permission status in locateMe:', permission.state);
        
        if (permission.state === 'denied') {
          console.warn('Geolocation permission denied in locateMe');
          alert('Standortberechtigung wurde verweigert. Bitte erlauben Sie den Zugriff auf Ihren Standort in den Browser-Einstellungen.');
          return;
        }
      }
    } catch (error) {
      console.error('Permission check error in locateMe:', error);
    }
    
    if (isFollowingLocation && is3DFollowing) {
      // Zustand 3: Following 3D ist aktiv -> Deaktiviere Following komplett
      console.log('Deactivating 3D following mode');
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
        
        console.log('Following mode deactivated');
      }
    } else if (isFollowingLocation && !is3DFollowing) {
      // Zustand 2: Following 2D ist aktiv -> Wechsel zu Following 3D
      console.log('Switching to 3D following mode');
      setIs3DFollowing(true);
      
      if (userLocation) {
        // Aktiviere 3D-Ansicht
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 19,
          bearing: deviceOrientation !== 0 ? -deviceOrientation + 180 : 0,
          pitch: 60, // 3D-Ansicht
          essential: true,
          duration: 800
        });
        
        console.log('3D following mode activated');
      }
    } else if (isCentered && !isFollowingLocation) {
      // Zustand 1b: Bereits zentriert -> Aktiviere 2D Following
      console.log('Activating 2D following mode from centered state');
      
      if (userLocation) {
        setIsFollowingLocation(true);
        setIs3DFollowing(false);
        setIsCentered(false); // Reset centered state when activating following
        // Location Tracking wird automatisch durch useEffect gestartet
        
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 18,
          bearing: 0,
          pitch: 0, // 2D-Ansicht
          essential: true,
          duration: 800
        });
        
        console.log('2D following mode activated');
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
              
              map.flyTo({
                center: [longitude, latitude],
                zoom: 18,
                bearing: 0,
                pitch: 0, // 2D-Ansicht
                essential: true,
                duration: 800
              });
              
              // Update user marker with direction
              updateUserMarker({ lat: latitude, lng: longitude }, heading, false);
              console.log('2D following mode activated');
            } catch (error) {
              console.error('Error updating user location:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
          }
        );
      } catch (error) {
        console.error('Error with geolocation:', error);
      }
    } else {
      // Zustand 1a: Standort einfach zentrieren (ohne Following zu aktivieren)
      console.log('Centering on user location');
      
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
        
        console.log('Location centered');
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
              console.log('Location centered');
            } catch (error) {
              console.error('Error updating user location:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
          }
        );
      } catch (error) {
        console.error('Error with geolocation:', error);
      }
    }
  }

  // Funktion für den Button beim Station-Panel: Zentriert auf Station und aktiviert Following-Modus
  async function centerOnStationAndFollow() {
    if (!mapRef.current || !selectedStation || !userLocation) return;
    const map = mapRef.current;
    
    console.log('Centering on station and activating following mode');
    
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
      
      console.log('Station-following mode activated');
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
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-105 pointer-events-auto ${
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
                  : '90vh'
                : dragOffset > 0
                  ? `calc(17rem + ${dragOffset}px)`
                  : '17rem',
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="5 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                      <path d="M13 11h3l-4 6v-4H9l4-6v4z"/>
                    </svg>
                    <span className="text-base -ml-2">
                      <span className="font-semibold">{panelStation?.available_units ?? 0}</span> verfügbar
                    </span>
                  </div>

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
                  {/* FOTO-CAROUSEL BEREICH */}
                  <div className="w-full">
                    {(() => {
                      // Kombiniere photos Array und photo_url (für Rückwärtskompatibilität)
                      const allPhotos: string[] = [];
                      if (panelStation?.photos && Array.isArray(panelStation.photos)) {
                        allPhotos.push(...panelStation.photos.filter((url): url is string => typeof url === 'string' && url.length > 0));
                      }
                      // Falls photo_url existiert und noch nicht in photos enthalten ist
                      if (panelStation?.photo_url && !allPhotos.includes(panelStation.photo_url)) {
                        allPhotos.unshift(panelStation.photo_url);
                      }
                      const displayPhotos = allPhotos
                        .slice(0, 3)
                        .map(getAbsoluteStationPhotoUrl)
                        .filter(Boolean) as string[];
                      
                      // Zeige Foto-Carousel immer an
                      if (displayPhotos.length > 0) {
                        return <PhotoCarousel photos={displayPhotos} isDarkMode={isDarkMode === true} />;
                      } else {
                        return (
                          <div className={`w-full h-64 rounded-xl flex items-center justify-center border-2 border-dashed ${
                            isDarkMode === true ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-300'
                          }`}>
                            <div className="text-center">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`mx-auto mb-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Noch keine Fotos vorhanden
                              </p>
                              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                Fotos können im Dashboard hinzugefügt werden
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

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
                onClick={() => {
                  // TODO: Reservierungs-Logik
                  console.log('Reservierung für Station:', selectedStation.name);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3.5 shadow-md active:scale-95 transition-transform"
              >
                <span className="text-lg font-semibold">Reservieren</span>
                <span className="text-base opacity-80">· kostenlos für 10 Min</span>
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
            console.log('Button clicked! Current state:', showStationList, 'Nearby stations:', nearbyStations.length);
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
                        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {station.available_units} verfügbar
                        </div>
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

      {/* Scannen Button - nur anzeigen wenn keine Station ausgewählt */}
      {!selectedStation && !isFullScreenNavigation && (
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
                        console.log('Switching from FIXED to FOLLOWING mode');
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
                        console.log('Now in FOLLOWING mode - map will follow user');
                      } else {
                        // Currently following - switch to fixed mode
                        console.log('Switching from FOLLOWING to FIXED mode');
                        setIsLocationFixed(true);
                        // Center map perfectly on user location
                        map.flyTo({
                          center: [userLocation.lng, userLocation.lat],
                          zoom: 19,
                          bearing: 0, // Reset rotation for fixed mode
                          essential: true,
                          duration: 1000
                        });
                        console.log('Now in FIXED mode - map will NOT follow user');
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
            console.log('📍 QR-Code/Code gescannt:', stationId);
            
            // Schließe Scanner sofort
            setScanning(false);
            
            // Prüfe ob es ein 4-stelliger Code ist (z.B. A3B7)
            const isShortCode = /^[A-Z0-9]{4}$/i.test(stationId);
            
            // Suche die Station in der Liste
            let station = isShortCode 
              ? stations.find(s => s.short_code?.toUpperCase() === stationId.toUpperCase())
              : stations.find(s => s.id === stationId);
            
            if (station) {
              // Station gefunden - zeige Ausleih-Bestätigungsmodal
              setScannedStation(station);
              setShowRentalModal(true);
              
              // Haptisches Feedback
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
              }
            } else {
              // Station nicht in der Liste - suche in Datenbank
              try {
                const { supabase } = await import('@/lib/supabaseClient');
                let query = supabase.from('stations').select('*').eq('is_active', true);
                
                if (isShortCode) {
                  query = query.ilike('short_code', stationId);
                } else {
                  query = query.eq('id', stationId);
                }
                
                const { data, error } = await query.single();
                
                if (error || !data) {
                  console.error('Station nicht gefunden:', error);
                  alert(isShortCode 
                    ? `Station mit Code "${stationId.toUpperCase()}" nicht gefunden`
                    : 'Station nicht gefunden'
                  );
                  return;
                }
                
                if (data) {
                  setScannedStation(data);
                  setShowRentalModal(true);
                  
                  if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                  }
                }
              } catch (err) {
                console.error('Fehler beim Laden der Station:', err);
                alert('Station konnte nicht geladen werden');
              }
            }
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
          onConfirm={async (userEmail?: string, userName?: string) => {
            const currentStation = stations.find((s) => s.id === scannedStation.id) ?? scannedStation;
            console.log('✅ Ausleihe bestätigt:', { 
              stationId: scannedStation.id, 
              stationName: currentStation.name,
              userEmail, 
              userName 
            });
            
            try {
              // 🚨 SIGNAL AN ESP32 SENDEN! 🚨
              // Setze dispense_requested Flag in der Datenbank
              const { error: updateError } = await supabase
                .from('stations')
                .update({ 
                  dispense_requested: true,
                  available_units: Math.max(0, (currentStation.available_units ?? 1) - 1)
                })
                .eq('id', scannedStation.id);
              
              if (updateError) {
                console.error('❌ Fehler beim Senden des Signals:', updateError);
                throw updateError;
              }
              
              console.log('🎉 Signal an ESP32 gesendet! LED sollte jetzt blinken.');
              
              // TODO: Hier die tatsächliche Ausleih-Logik implementieren
              // z.B. Ausleihe in der Datenbank speichern, Powerbank reservieren, etc.
              
              // Push-Benachrichtigung senden
              await notifyRentalSuccess(scannedStation.name, '/');
              
              // Erfolgsmeldung
              alert(`Powerbank erfolgreich an Station "${scannedStation.name}" ausgeliehen!\n\n💡 Die LED an der Station blinkt jetzt für 5 Sekunden.${!userName ? '' : `\n\nBestätigung wurde an ${userEmail} gesendet.`}`);
              
              // Stationen werden automatisch durch StationManager aktualisiert
              
            } catch (error) {
              console.error('Fehler bei der Ausleihe:', error);
              const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Ausleihe. Bitte versuchen Sie es erneut.';
              await notifyRentalError(errorMessage);
              alert('Fehler bei der Ausleihe. Bitte versuchen Sie es erneut.');
            }
            
            // Modal schließen und Station auf Karte anzeigen
            setShowRentalModal(false);
            highlightStation(scannedStation);
            setScannedStation(null);
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
