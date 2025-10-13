"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CameraOverlay from "@/components/CameraOverlay";
import SideMenu from "@/components/SideMenu";
import StationManager, { Station } from "@/components/StationManager";

// Legacy Station type for backward compatibility
type LegacyStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  availableUnits: number;
};

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
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const highlightMarkerRef = useRef<L.Marker | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);

  // Station Manager Hook - verwende die Stationen direkt vom StationManager
  const stationManager = StationManager({ 
    onStationsUpdate: () => {}, // Leere Funktion, wir verwenden stationManager.stations direkt
    isDarkMode: isDarkMode === true 
  });

  // Verwende die Stationen direkt vom StationManager
  const stations = stationManager.stations;

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

  // Get user's current location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      // Fallback to Berlin coordinates
      setUserLocation({ lat: 52.52, lng: 13.405 });
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationLoading(false);
        console.log('User location obtained:', { lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Fallback to Berlin coordinates
        setUserLocation({ lat: 52.52, lng: 13.405 });
        setLocationLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 300000, // 5 minutes
        timeout: 10000 // 10 seconds
      }
    );
  }, []);

  const center = useMemo(() => userLocation || { lat: 52.52, lng: 13.405 }, [userLocation]);

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

  // Function to highlight and zoom to a station on the map
  const highlightStation = async (station: Station) => {
    if (!mapRef.current) return;
    
    try {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      
      // Remove existing highlight marker if any
      if (highlightMarkerRef.current) {
        map.removeLayer(highlightMarkerRef.current);
      }
      
      // Create a larger, more prominent highlight marker with pulsing ring
      const highlightIcon = new L.Icon({
        iconUrl:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="64" viewBox="0 0 32 40">
              <!-- Main marker pin body -->
              <path fill="#10b981" stroke="#10b981" stroke-width="1.5" d="M16 38s-10-6.2-10-14.3a10 10 0 1 1 20 0C26 31.8 16 38 16 38z"/>
              <!-- Lightning bolt - centered at x=16, y=24 -->
              <path d="M16.5 24h3l-4 6v-4h-3l4-6v4z" fill="white" stroke="white" stroke-width="1"/>
            </svg>`
          ),
        iconSize: [56, 64],
        iconAnchor: [28, 64],
        popupAnchor: [0, -60],
      });
      
      // Add highlight marker (in addition to the normal marker)
      const highlightMarker = L.marker([station.lat, station.lng], { 
        icon: highlightIcon,
        zIndexOffset: 1000 // Make sure it appears above other markers
      }).addTo(map);
      
      highlightMarkerRef.current = highlightMarker;
      
      // Calculate offset to show station in visible area above the bottom panel
      // We shift the map view downward so the station appears in the upper visible portion
      const latOffset = -0.003; // Negative to shift view down, keeping station visible above panel
      
      // Set view with offset so station appears in visible top portion
      map.setView([station.lat + latOffset, station.lng], 16, { animate: true });
      
      // Set selected station
      setSelectedStation(station);
      setShowStationList(false);
      
      console.log('Station highlighted:', station.name);
    } catch (error) {
      console.error('Error highlighting station:', error);
    }
  };

  // Function to clear station highlight
  const clearHighlight = async () => {
    if (!mapRef.current) return;
    
    try {
      const map = mapRef.current;
      
      // Remove highlight marker
      if (highlightMarkerRef.current) {
        map.removeLayer(highlightMarkerRef.current);
        highlightMarkerRef.current = null;
      }
      
      // Re-center map to user location when closing panel
      if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      }
      
      // Reset selected station
      setSelectedStation(null);
      
      console.log('Station highlight cleared');
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

  useEffect(() => {
    if (mapRef.current || !mapElRef.current || isDarkMode === null || locationLoading) return;
    
    // Dynamically import Leaflet only on client side
    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        
        // Import Leaflet CSS dynamically
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        
        // Ensure map container has proper dimensions
        const mapContainer = mapElRef.current!;
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
        
        const map = L.map(mapContainer, {
          center: L.latLng(center.lat, center.lng), // Use current user location
          zoom: 17, // Same zoom level as the "locate me" button
          zoomControl: false, // Disable zoom controls
          preferCanvas: true,
          renderer: L.canvas()
        });

        mapRef.current = map;
        console.log('Map initialized successfully:', map);
        console.log('Map center set to:', center);

        // Add initial tile layer - always use light mode
        const initialTileLayer = L.tileLayer(
          'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          }
        );
        initialTileLayer.addTo(map);
        currentTileLayerRef.current = initialTileLayer;
        
        console.log('Initial tile layer added: Light mode');
        
        // Add user location marker if we have the location
        if (userLocation) {
          const userIcon = new L.Icon({
            iconUrl:
              "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(16,185,129,0.25)" /><circle cx="12" cy="12" r="5" fill="#10b981" /></svg>'
              ),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          
          const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
          userMarkerRef.current = userMarker;
          console.log('User marker added at:', userLocation);
        }

        // Force map to invalidate size and render
        setTimeout(() => {
          map.invalidateSize();
          console.log('Map invalidated and should be visible now');
        }, 100);

        return () => {
          if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();
  }, [center, isDarkMode, locationLoading, userLocation]);

  // Effect to change tile layer when theme changes
  useEffect(() => {
    if (!mapRef.current || isDarkMode === null) {
      // Map not initialized yet or theme not detected yet, wait for it
      return;
    }
    
    // Skip if this is the initial load (map was just initialized with correct theme)
    if (!currentTileLayerRef.current) {
      return;
    }
    
    const changeTileLayer = async () => {
      try {
        const L = (await import("leaflet")).default;
        
        // Remove current tile layer
        if (currentTileLayerRef.current && mapRef.current) {
          mapRef.current.removeLayer(currentTileLayerRef.current);
        }
        
        // Add new tile layer - always use light mode
        console.log("Switching to CartoDB Voyager map");
        const newTileLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        });
        
        if (mapRef.current) {
          newTileLayer.addTo(mapRef.current);
          currentTileLayerRef.current = newTileLayer;
        }
      } catch (error) {
        console.error('Error changing tile layer:', error);
      }
    };
    
    changeTileLayer();
  }, [isDarkMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const addMarkers = async () => {
      try {
        const L = (await import("leaflet")).default;
        
        // Remove existing stations layer if any
        if (stationsLayerRef.current) {
          map.removeLayer(stationsLayerRef.current);
        }
        
        const greenIcon = new L.Icon({
          iconUrl:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="#10b981" stroke="#10b981" d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/><path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="white" stroke="white"/></svg>'
            ),
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -28],
        });
        
        const layerGroup = L.layerGroup();
        stations.forEach((s) => {
          const marker = L.marker([s.lat, s.lng], { icon: greenIcon });
          
          // Add click handler to open info panel
          marker.on('click', () => {
            console.log('Marker clicked:', s.name);
            highlightStation(s);
          });
          
          marker.addTo(layerGroup);
        });
        
        layerGroup.addTo(map);
        stationsLayerRef.current = layerGroup;
        
        console.log(`Added ${stations.length} station markers to map`);
      } catch (error) {
        console.error('Error adding markers to map:', error);
      }
    };
    
    addMarkers();
  }, [stations]);

  async function locateMe() {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }
    
    try {
      const L = (await import("leaflet")).default;
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            // Update user location state
            setUserLocation({ lat: latitude, lng: longitude });
            map.setView([latitude, longitude], 17, { animate: true });
            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([latitude, longitude]);
            } else {
              const m = L.marker([latitude, longitude], {
                icon: new L.Icon({
                  iconUrl:
                    "data:image/svg+xml;charset=UTF-8," +
                    encodeURIComponent(
                      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(16,185,129,0.25)" /><circle cx="12" cy="12" r="5" fill="#10b981" /></svg>'
                    ),
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                }),
              }).addTo(map);
              userMarkerRef.current = m;
            }
          } catch (error) {
            console.error('Error updating user location:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } catch (error) {
      console.error('Error loading Leaflet for geolocation:', error);
    }
  }

  return (
    <>
      <div 
        ref={mapElRef} 
        className="fixed inset-0 z-0" 
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

      {/* Selected Station Info Panel - Slides up from bottom */}
      {selectedStation && !showStationList && userLocation && (
        <div className="fixed bottom-0 left-0 right-0 z-[999] animate-slide-up">
          <div className={`mx-3 mb-4 rounded-3xl shadow-2xl backdrop-blur-md border ${
            isDarkMode === true
              ? 'bg-gray-800/98 text-white border-gray-700' 
              : 'bg-white/98 text-slate-900 border-gray-200'
          }`}>
            <div className="p-6">
              {/* Header with close button */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <h3 className="text-2xl font-bold">{selectedStation.name}</h3>
                  </div>
                  <div className="text-base opacity-75">
                    {(() => {
                      const distance = calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        selectedStation.lat,
                        selectedStation.lng
                      );
                      return distance < 1000 
                        ? `${Math.round(distance)}m entfernt` 
                        : `${(distance / 1000).toFixed(1)}km entfernt`;
                    })()}
                  </div>
                </div>
                <button
                  onClick={clearHighlight}
                  className={`p-2 rounded-full transition-colors ${
                    isDarkMode === true ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  aria-label="Schließen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Available Powerbanks - Big Display */}
              <div className={`mb-5 p-6 rounded-2xl text-center ${
                isDarkMode === true ? 'bg-emerald-900/30 border border-emerald-700/30' : 'bg-emerald-50 border border-emerald-200/50'
              }`}>
                <div className="text-base opacity-75 mb-3">Verfügbare Powerbanks</div>
                <div className="text-6xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  {selectedStation.available_units || 0}
                </div>
                <div className="text-sm opacity-60">
                  {selectedStation.total_units && `von ${selectedStation.total_units} insgesamt`}
                </div>
              </div>

              {/* Info Box - How to rent */}
              <div className={`mb-5 p-3 rounded-xl border ${
                isDarkMode === true 
                  ? 'bg-blue-900/20 border-blue-600/30' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="text-lg">ℹ️</div>
                  <div className={`text-sm ${
                    isDarkMode === true ? 'text-blue-200' : 'text-blue-800'
                  }`}>
                    QR-Code an der Station scannen zum Ausleihen
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {selectedStation.address && (
                <div className={`mb-4 p-3 rounded-xl ${
                  isDarkMode === true ? 'bg-gray-700/50' : 'bg-gray-50'
                }`}>
                  <div className="text-xs opacity-75 mb-1">📍 Adresse</div>
                  <div className="text-sm">{selectedStation.address}</div>
                </div>
              )}

              {selectedStation.description && (
                <div className={`mb-4 p-3 rounded-xl ${
                  isDarkMode === true ? 'bg-gray-700/50' : 'bg-gray-50'
                }`}>
                  <div className="text-xs opacity-75 mb-1">ℹ️ Information</div>
                  <div className="text-sm">{selectedStation.description}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setScanning(true);
                  }}
                  className="w-full px-5 py-4 rounded-xl text-base font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center gap-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                  </svg>
                  <span>QR-Code Scannen</span>
                </button>
                <button
                  onClick={() => openExternalNavigation(selectedStation)}
                  className={`w-full px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    isDarkMode === true
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  } flex items-center justify-center gap-2`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  Navigation zur Station
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nearby stations text */}
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

      {/* Station list */}
      {showStationList && userLocation && nearbyStations.length > 0 && (
        <div className="fixed left-1/2 top-16 z-[999] transform -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)]">
          <div className={`rounded-2xl shadow-xl backdrop-blur-md border ${
            isDarkMode === true
              ? 'bg-gray-800/95 text-white border-gray-600' 
              : 'bg-white/95 text-slate-900 border-gray-200'
          }`}>
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
                          ? 'bg-gray-700/50 hover:bg-gray-700/70 active:bg-gray-600/70' 
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

      {/* Scannen Button - nur anzeigen wenn keine Station ausgewählt */}
      {!selectedStation && (
        <button
          type="button"
          onClick={() => {
            setScanning(true);
          }}
          className="fixed bottom-5 left-4 right-4 z-[1000] flex items-center justify-center gap-3 rounded-xl bg-emerald-600 text-white px-6 h-14 shadow-lg active:scale-95 border border-emerald-500"
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
      
      {/* Standort zentrieren Button - nur anzeigen wenn keine Station ausgewählt */}
      {!selectedStation && (
        <button
          type="button"
          onClick={locateMe}
          className={`fixed bottom-24 right-5 z-[1000] grid place-items-center rounded-full w-12 h-12 backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 ${
            isDarkMode === true
              ? 'bg-black/20 text-white border border-white/20 hover:bg-black/30' 
              : 'bg-white/20 text-slate-900 border border-slate-300/30 hover:bg-white/30 shadow-lg'
          }`}
          aria-label="Standort zentrieren"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>
      )}
      
      {scanning && <CameraOverlay onClose={() => setScanning(false)} />}
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
export default function MapView() {
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme");
  
  return <MapViewContent initialTheme={themeParam} />;
}