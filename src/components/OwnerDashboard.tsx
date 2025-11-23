"use client";

import { useState, useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Station } from "./StationManager";
import AddStationForm from "./AddStationForm";

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface OwnerDashboardProps {
  isDarkMode: boolean;
  onClose?: () => void;
  variant?: "overlay" | "page";
}

type OwnerDashboardTab = 'overview' | 'stats' | 'stations' | 'users' | 'transactions';

// Photo Manager Component
function PhotoManager({ station, onUpdate, isDarkMode }: { station: Station; onUpdate: (photos: string[]) => void; isDarkMode: boolean }) {
  const [photos, setPhotos] = useState<string[]>(station.photos || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPhotos(station.photos || []);
  }, [station.photos]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 3) {
      alert('Sie können maximal 3 Fotos hochladen. Bitte entfernen Sie zuerst einige Fotos.');
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length && photos.length + uploadedUrls.length < 3; i++) {
        const file = files[i];
        
        // Erstelle einen eindeutigen Dateinamen
        const fileExt = file.name.split('.').pop();
        const fileName = `${station.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload zu Supabase Storage
        try {
          const { data, error } = await supabase.storage
            .from('station-photos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            throw error;
          }

          // Hole die öffentliche URL
          const { data: urlData } = supabase.storage
            .from('station-photos')
            .getPublicUrl(fileName);
          
          uploadedUrls.push(urlData.publicUrl);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          // Fallback: Verwende Data URL als temporäre Lösung
          const reader = new FileReader();
          const promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(file);
          });
          const base64data = await promise;
          uploadedUrls.push(base64data);
        }
      }

      if (uploadedUrls.length > 0) {
        const newPhotos = [...photos, ...uploadedUrls].slice(0, 3);
        setPhotos(newPhotos);
        onUpdate(newPhotos);
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Fehler beim Hochladen der Fotos. Bitte versuchen Sie es erneut.');
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onUpdate(newPhotos);
  };

  return (
    <div className="space-y-4">
      {/* Aktuelle Fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Station Foto ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {photos.length < 3 && (
        <label className={`block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
          uploading
            ? 'opacity-50 cursor-not-allowed'
            : isDarkMode
              ? 'border-white/20 hover:border-white/40 bg-white/5'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"></div>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  Wird hochgeladen...
                </span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                  Foto hinzufügen ({photos.length}/3)
                </span>
              </>
            )}
          </div>
        </label>
      )}

      {photos.length >= 3 && (
        <p className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
          Maximum von 3 Fotos erreicht. Entfernen Sie ein Foto, um ein neues hinzuzufügen.
        </p>
      )}
    </div>
  );
}

export default function OwnerDashboard({ isDarkMode, onClose, variant = "overlay" }: OwnerDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<OwnerDashboardTab>('overview');
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStationForm, setShowAddStationForm] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);

  const tabOptions: Array<{
    key: OwnerDashboardTab;
    label: string;
    icon: JSX.Element;
  }> = [
    {
      key: 'overview',
      label: 'Überblick',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    },
    {
      key: 'stats',
      label: 'Statistiken',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M4 21V10" />
          <path d="M10 21V3" />
          <path d="M16 21v-6" />
          <path d="M22 21v-12" />
        </svg>
      )
    },
    {
      key: 'stations',
      label: 'Stationen',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M3 3h18v13H3z"/>
          <path d="M7 21h10"/>
          <path d="M9 16v5"/>
          <path d="M15 16v5"/>
        </svg>
      )
    },
    {
      key: 'users',
      label: 'Benutzer',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/>
        </svg>
      )
    },
    {
      key: 'transactions',
      label: 'Transaktionen',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
          <path d="M19 5H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      )
    }
  ];

  // Responsives Verhalten (Desktop vs. Mobile)
  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth < 1024);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Lade Stationen
  const fetchStations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const stationsData = data || [];
      setStations(stationsData);
      setSelectedStationId((prev) => {
        if (prev && stationsData.some((station: Station) => station.id === prev)) {
          return prev;
        }
        return stationsData.length > 0 ? stationsData[0].id : null;
      });
      
      // Debug: Logge Batteriedaten
      console.log('Geladene Stationen:', stationsData.length);
      stationsData.forEach((station: Station) => {
        console.log(`Station ${station.name}:`, {
          battery_voltage: station.battery_voltage,
          battery_percentage: station.battery_percentage,
          hasBatteryData: !!(station.battery_voltage || station.battery_percentage)
        });
      });
    } catch (err) {
      console.error('Fehler beim Laden der Stationen:', err);
      setError('Fehler beim Laden der Stationen');
    } finally {
      setLoading(false);
    }
  };

  // Lade Benutzer
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Sie müssen eingeloggt sein, um Benutzer zu sehen');
      }

      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        let message = 'Fehler beim Laden der Benutzer';
        try {
          const body = await response.json();
          if (body?.message) {
            message = body.message;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const usersData: UserWithRole[] = Array.isArray(payload?.users) ? payload.users : [];
      setUsers(usersData);
      setUsersCount(usersData.length);
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
      setError((err as Error)?.message || 'Fehler beim Laden der Benutzer');
      setUsers([]);
      setUsersCount(null);
    } finally {
      setLoading(false);
    }
  };

  // Lösche Station
  const deleteStation = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Station löschen möchten?')) return;
    
    try {
      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchStations();
    } catch (err) {
      console.error('Fehler beim Löschen der Station:', err);
      setError('Fehler beim Löschen der Station');
    }
  };

  // Aktualisiere Station
  const updateStation = async (id: string, updates: Partial<Station>) => {
    try {
      const { error } = await supabase
        .from('stations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchStations();
    } catch (err) {
      console.error('Fehler beim Aktualisieren der Station:', err);
      setError('Fehler beim Aktualisieren der Station');
    }
  };

  // Füge neue Station hinzu
  const handleAddStation = async (stationData: Omit<Station, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);
      
      // Hole den aktuellen Benutzer
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Sie müssen eingeloggt sein um eine Station hinzuzufügen');
      }
      
      // Füge owner_id hinzu
      const stationWithOwner = {
        ...stationData,
        owner_id: user.id
      };
      
      const { data, error } = await supabase
        .from('stations')
        .insert([stationWithOwner])
        .select();

      if (error) {
        console.error('Supabase Fehler:', error);
        throw error;
      }
      
      console.log('Station erfolgreich hinzugefügt:', data);
      await fetchStations();
      setShowAddStationForm(false);
    } catch (err: unknown) {
      console.error('Fehler beim Hinzufügen der Station:', err);
      setError((err as Error)?.message || 'Fehler beim Hinzufügen der Station');
      throw err;
    }
  };

  // Weise Benutzerrolle zu
  const assignUserRole = async (userId: string, role: 'owner' | 'user') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) throw error;
      await fetchUsers();
    } catch (err) {
      console.error('Fehler beim Zuweisen der Rolle:', err);
      setError('Fehler beim Zuweisen der Rolle');
    }
  };

  // Entferne Benutzerrolle (setzt auf 'user')
  const removeUserRole = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'user' })
        .eq('id', userId);

      if (error) throw error;
      await fetchUsers();
    } catch (err) {
      console.error('Fehler beim Entfernen der Rolle:', err);
      setError('Fehler beim Entfernen der Rolle');
    }
  };

  // Hole Benutzerstandort
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation wird von diesem Browser nicht unterstützt');
      setUserLocation({ lat: 52.52, lng: 13.405 });
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
        setUserLocation({ lat: 52.52, lng: 13.405 });
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 300000,
        timeout: 10000
      }
    );
  }, []);

  useEffect(() => {
    if (['overview', 'stats', 'stations', 'transactions'].includes(activeTab)) {
      fetchStations();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const getTabBadgeValue = (key: OwnerDashboardTab): string | null => {
    if (key === 'stations' && stations.length > 0) {
      return stations.length > 12 ? '12+' : `${stations.length}`;
    }
    if (key === 'users' && usersCount && usersCount > 0) {
      return usersCount > 12 ? '12+' : `${usersCount}`;
    }
    if (key === 'transactions') {
      const transactionsCount = stations.reduce((sum, station) => sum + (station.total_units ?? 0), 0);
      if (transactionsCount > 0) {
        return transactionsCount > 12 ? '12+' : `${transactionsCount}`;
      }
    }
    return null;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose?.();
    router.push(`/login?theme=${isDarkMode ? "dark" : "light"}`);
  };

  const generalActions = [
    {
      key: 'settings',
      label: 'Einstellungen',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 21.1V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 8 10.6V10a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 5a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 8 1.4V1a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 5a1.65 1.65 0 0 0-.33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33H14a1.65 1.65 0 0 0-1 1.51v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15Z" />
        </svg>
      ),
      onClick: () => {
        onClose?.();
        router.push(`/profile?theme=${isDarkMode ? "dark" : "light"}`);
      },
    },
    {
      key: 'help',
      label: 'Hilfe',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      onClick: () => {
        onClose?.();
        router.push(`/hilfe?theme=${isDarkMode ? "dark" : "light"}`);
      },
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      onClick: handleLogout,
    },
  ];

  const isStandalone = variant === "page";
  const outerClasses = isStandalone
    ? `${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} min-h-screen w-full`
    : `fixed inset-0 z-[2000] px-0 py-0 md:px-8 md:py-8 backdrop-blur-sm ${
        isDarkMode ? 'bg-black/70 text-white' : 'bg-black/30 text-slate-900'
      }`;
  const selectedStation = selectedStationId
    ? stations.find((station) => station.id === selectedStationId) || null
    : null;
  const activeStationsCount = stations.filter((station) => station.is_active).length;
  const inactiveStationsCount = stations.length - activeStationsCount;
  const totalCapacity = stations.reduce((sum, station) => sum + (station.total_units || 0), 0);
  const totalAvailableUnits = stations.reduce((sum, station) => sum + (station.available_units || 0), 0);
  const averageBattery =
    stations.length > 0
      ? Math.round(
          (stations.reduce((sum, station) => sum + (station.battery_percentage ?? 0), 0) / stations.length) * 10
        ) / 10
      : null;
  const utilizationPercentage =
    totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailableUnits) / totalCapacity) * 100) : 0;
  const transactionsData =
    stations.length > 0
      ? stations.slice(0, 8).map((station, index) => ({
          id: station.id ?? `tx-${index}`,
          stationName: station.name,
          amount: station.rental_cost ?? 3.5,
          status: station.is_active ? 'abgeschlossen' : 'wartend',
          timestamp: station.updated_at ? new Date(station.updated_at) : null,
          powerbanksMoved: (station.total_units || 0) - (station.available_units || 0),
        }))
      : [
          {
            id: 'demo-1',
            stationName: 'Demo Station',
            amount: 4.5,
            status: 'wartend',
            timestamp: null,
            powerbanksMoved: 2,
          },
        ];

  const shellClasses = [
    "flex",
    "flex-col",
    isStandalone ? "min-h-screen w-full" : "h-full mx-auto w-full max-w-6xl rounded-3xl border shadow-2xl",
    isDarkMode ? "bg-[#1f1f1f]" : "bg-white",
    !isStandalone ? (isDarkMode ? "border-gray-800/80" : "border-slate-200") : "",
    !isMobile ? "h-screen overflow-hidden" : ""
  ].filter(Boolean).join(" ");
  const headerPadding = isStandalone ? "px-4 py-4 sm:px-6 lg:px-12" : "px-4 py-4 md:px-8";
  const contentPadding = isStandalone ? "px-4 sm:px-6 lg:px-12" : "px-4 md:px-8";
  const sectionHeaderClasses = isDarkMode
    ? "border-white/10 bg-white/5 text-white"
    : "border-slate-200 bg-slate-50 text-slate-900";
  const sectionHeaderWrapper = isStandalone
    ? "mx-4 mt-6 rounded-2xl"
    : "mx-4 my-4 rounded-2xl";

  return (
    <div className={outerClasses}>
      <div className={shellClasses}>
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b ${headerPadding} ${
            isDarkMode ? 'border-gray-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-4">
            {variant === "overlay" && onClose && (
              <button
                onClick={onClose}
                className={`rounded-xl p-2 transition-colors ${
                  isDarkMode
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-label="Zurück"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                  isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                Gridbox
              </p>
              <h2 className="text-2xl font-bold leading-tight">Owner Dashboard</h2>
            </div>
          </div>
          <div
            className={`hidden md:flex items-center gap-2 rounded-2xl px-4 py-2 text-sm ${
              isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Desktop-optimiert
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : ''} min-h-0`}>
          {/* Tabs / Navigation */}
          <nav
            className={`flex shrink-0 gap-3 ${
              isMobile
                ? 'w-full overflow-x-auto border-b px-2.5 py-2'
                : 'w-52 flex-col border-r px-2 py-3.5 h-full max-h-full overflow-y-auto min-h-0 overscroll-contain'
            } ${isDarkMode ? 'bg-[#171717] border-gray-800/70' : 'bg-white border-slate-200'}`}
          >
            <div className="flex w-full flex-1 flex-col gap-6">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Menu
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {tabOptions.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const badge = getTabBadgeValue(tab.key);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? isDarkMode
                              ? 'bg-emerald-500/10 text-white shadow-[0_10px_30px_-22px_rgba(16,185,129,1)]'
                              : 'bg-emerald-50 text-emerald-900 shadow-[0_12px_30px_-24px_rgba(16,185,129,0.8)]'
                            : isDarkMode
                              ? 'text-gray-300 hover:bg-gray-900/40'
                              : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                            isActive
                              ? isDarkMode
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-emerald-100 text-emerald-600'
                              : isDarkMode
                                ? 'bg-gray-900/50 text-gray-400'
                                : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {tab.icon}
                        </span>
                        <span className="flex-1 text-left">{tab.label}</span>
                        {badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isDarkMode ? 'bg-white/10 text-white' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  General
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {generalActions.map((action) => (
                    <button
                      key={action.key}
                      onClick={action.onClick}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'text-gray-300 hover:bg-gray-900/40'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                          isDarkMode ? 'bg-gray-900/40 text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {action.icon}
                      </span>
                      <span className="flex-1 text-left">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
            <div className={`flex h-full flex-col ${isStandalone ? `${contentPadding} pb-8` : ''}`}>
              {error && (
                <div
                  className={`m-4 rounded-2xl border px-4 py-3 ${
                    isDarkMode
                      ? 'border-red-900/60 bg-red-900/10 text-red-300'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {error}
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: 'Stationen',
                        value: stations.length,
                        hint: `${activeStationsCount} aktiv · ${inactiveStationsCount} pausiert`,
                      },
                      {
                        label: 'Verfügbare Powerbanks',
                        value: totalAvailableUnits,
                        hint: `${totalCapacity - totalAvailableUnits} im Einsatz`,
                      },
                      {
                        label: 'Durchschnittliche Batterie',
                        value: averageBattery !== null ? `${averageBattery}%` : '—',
                        hint: 'über alle Stationen',
                      },
                      {
                        label: 'Auslastung',
                        value: `${utilizationPercentage}%`,
                        hint: totalCapacity > 0 ? `${totalCapacity - totalAvailableUnits} von ${totalCapacity}` : 'Keine Daten',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`rounded-2xl border p-4 ${
                          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{card.label}</p>
                        <p className={`mt-2 text-3xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
                        <p className={`text-xs uppercase tracking-[0.2em] mt-3 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{card.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                      <div>
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Highlights</p>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Stationsperformance</h3>
                      </div>
                      <button
                        onClick={() => setActiveTab('stations')}
                        className="px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        Stationen öffnen
                      </button>
                    </div>
                    {stations.length === 0 ? (
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Noch keine Stationen verfügbar – lege deine erste Station an.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {stations.slice(0, 4).map((station) => (
                          <div
                            key={station.id}
                            className={`rounded-xl border p-3 ${
                              isDarkMode ? 'bg-white/5 border-white/10' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{station.name}</p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  station.is_active
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-red-500/10 text-red-500'
                                }`}
                              >
                                {station.is_active ? 'Aktiv' : 'Aus'}
                              </span>
                            </div>
                            <div className={`flex items-center justify-between text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                              <span>{station.available_units ?? 0} / {station.total_units ?? 0} frei</span>
                              <span>
                                {station.battery_percentage !== undefined && station.battery_percentage !== null
                                  ? `${station.battery_percentage}%`
                                  : '–'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <div
                      className={`flex-1 min-w-[220px] rounded-2xl border p-4 ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <p className={`text-xs uppercase tracking-[0.2em] mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Auslastung</p>
                      <div className="flex items-end gap-2">
                        <span className={`text-3xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{utilizationPercentage}%</span>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>genutzt</span>
                      </div>
                      <div className={`mt-3 h-3 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${utilizationPercentage}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`flex-1 min-w-[220px] rounded-2xl border p-4 ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <p className={`text-xs uppercase tracking-[0.2em] mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Durchschnitt Energie</p>
                      <div className={`text-3xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {averageBattery !== null ? `${averageBattery}%` : 'Keine Daten'}
                      </div>
                      <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Batterie aller Stationen</p>
                    </div>
                  </div>

                  {stations.length === 0 ? (
                    <div className={`rounded-2xl border p-6 text-center text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      Keine Statistiken verfügbar. Bitte füge Stationen hinzu.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stations.map((station) => {
                        const utilization =
                          station.total_units && station.total_units > 0
                            ? Math.round(((station.total_units - (station.available_units || 0)) / station.total_units) * 100)
                            : 0;
                        return (
                          <div
                            key={station.id}
                            className={`rounded-2xl border p-4 ${
                              isDarkMode ? 'bg-white/5 border-white/10' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{station.name}</p>
                                <p className={`text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                  {station.available_units ?? 0} / {station.total_units ?? 0} frei
                                </p>
                              </div>
                              <span
                                className={`text-xs px-3 py-1 rounded-full ${
                                  station.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                }`}
                              >
                                {station.is_active ? 'Aktiv' : 'Pausiert'}
                              </span>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Auslastung</p>
                                <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{utilization}%</p>
                                <div className={`mt-1 h-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${utilization}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Batterie</p>
                                <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {station.battery_percentage !== undefined && station.battery_percentage !== null
                                    ? `${station.battery_percentage}%`
                                    : '—'}
                                </p>
                              </div>
                              <div>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Letzte Änderung</p>
                                <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {station.updated_at ? new Date(station.updated_at).toLocaleDateString() : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stations' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Stationen Header & Auswahl */}
                <div className={`${sectionHeaderWrapper} p-5 border ${sectionHeaderClasses}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Stationen ({stations.length})
                      </h3>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Verwalte deine Powerbank-Stationen
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddStationForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Station hinzufügen
                    </button>
                  </div>

                  {stations.length > 0 && (
                    <div className="mt-4">
                      <label className={`block text-xs font-semibold uppercase tracking-[0.15em] mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Station auswählen
                      </label>
                      <select
                        value={selectedStationId ?? ''}
                        onChange={(event) => setSelectedStationId(event.target.value || null)}
                        className={`w-full rounded-xl border px-4 py-3 text-base font-medium transition-colors ${
                          isDarkMode 
                            ? 'bg-white/10 border-white/20 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                        }`}
                      >
                        {stations.map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.name} {station.short_code ? `(${station.short_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Station Details */}
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                  </div>
                ) : !selectedStation ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                      <path d="M3 3h18v13H3z"/>
                      <path d="M7 21h10"/>
                      <path d="M9 16v5"/>
                      <path d="M15 16v5"/>
                    </svg>
                    <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {stations.length === 0 ? 'Noch keine Stationen' : 'Station auswählen'}
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                      {stations.length === 0 
                        ? 'Erstelle deine erste Station, um zu beginnen'
                        : 'Wähle eine Station aus der Liste oben, um Details zu sehen'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Station Info Header */}
                    <div className={`rounded-2xl border p-5 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {selectedStation.name}
                            </h4>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              selectedStation.is_active
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {selectedStation.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            {selectedStation.short_code && (
                              <div className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                <span className="opacity-70">Code:</span>
                                <span className="font-mono font-semibold">{selectedStation.short_code}</span>
                              </div>
                            )}
                            <div className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              <span className="opacity-70">ID:</span>
                              <span className="font-mono text-xs">{selectedStation.id}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => updateStation(selectedStation.id, { is_active: !selectedStation.is_active })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedStation.is_active
                              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                          }`}
                        >
                          {selectedStation.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </div>
                    </div>

                    {/* Slots Übersicht */}
                    <div className={`rounded-2xl border p-5 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Slot-Übersicht
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`rounded-xl p-4 ${
                          isDarkMode ? 'bg-white/5' : 'bg-white'
                        }`}>
                          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            Leere Slots
                          </div>
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {selectedStation.available_units ?? 0}
                          </div>
                        </div>
                        <div className={`rounded-xl p-4 ${
                          isDarkMode ? 'bg-white/5' : 'bg-white'
                        }`}>
                          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            Belegte Slots
                          </div>
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {(selectedStation.total_units ?? 0) - (selectedStation.available_units ?? 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Powerbank Details Tabelle */}
                    <div className={`rounded-2xl border ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`p-5 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <h5 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          Powerbank Details
                        </h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={`border-b ${
                              isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                            }`}>
                              <th className={`text-left py-3 px-5 text-xs font-semibold uppercase tracking-wide ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Slot
                              </th>
                              <th className={`text-left py-3 px-5 text-xs font-semibold uppercase tracking-wide ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Powerbank ID
                              </th>
                              <th className={`text-left py-3 px-5 text-xs font-semibold uppercase tracking-wide ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Akkustand
                              </th>
                              <th className={`text-left py-3 px-5 text-xs font-semibold uppercase tracking-wide ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Temperatur
                              </th>
                              <th className={`text-left py-3 px-5 text-xs font-semibold uppercase tracking-wide ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Health Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedStation.total_units && selectedStation.total_units > 0 ? (
                              Array.from({ length: selectedStation.total_units }, (_, index) => {
                                const slotNumber = index + 1;
                                const isOccupied = (selectedStation.available_units ?? 0) < slotNumber;
                                // TODO: Diese Daten sollten aus der Datenbank kommen
                                const powerbankId = isOccupied ? `PB-${selectedStation.id.slice(0, 8)}-${slotNumber}` : null;
                                const batteryLevel = isOccupied ? Math.floor(Math.random() * 100) : null;
                                const temperature = isOccupied ? (20 + Math.random() * 15).toFixed(1) : null;
                                const healthStatus = isOccupied ? (batteryLevel && batteryLevel > 80 ? 'Gut' : batteryLevel && batteryLevel > 50 ? 'Mittel' : 'Schlecht') : null;

                                return (
                                  <tr
                                    key={slotNumber}
                                    className={`border-b transition-colors ${
                                      isDarkMode 
                                        ? 'border-gray-800 hover:bg-gray-900/50' 
                                        : 'border-gray-100 hover:bg-gray-50'
                                    }`}
                                  >
                                    <td className="py-3 px-5">
                                      <span className={`text-sm font-medium ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                      }`}>
                                        {slotNumber}
                                      </span>
                                    </td>
                                    <td className="py-3 px-5">
                                      {powerbankId ? (
                                        <span className={`text-xs font-mono ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          {powerbankId}
                                        </span>
                                      ) : (
                                        <span className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                          Leer
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-5">
                                      {batteryLevel !== null ? (
                                        <div className="flex items-center gap-2">
                                          <div className={`w-20 h-1.5 rounded-full overflow-hidden ${
                                            isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                                          }`}>
                                            <div
                                              className={`h-full transition-all ${
                                                batteryLevel < 20 ? 'bg-red-500' :
                                                batteryLevel < 50 ? 'bg-yellow-500' :
                                                'bg-emerald-500'
                                              }`}
                                              style={{ width: `${batteryLevel}%` }}
                                            />
                                          </div>
                                          <span className={`text-sm font-medium ${
                                            batteryLevel < 20 ? 'text-red-500' :
                                            batteryLevel < 50 ? 'text-yellow-500' :
                                            'text-emerald-500'
                                          }`}>
                                            {batteryLevel}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-5">
                                      {temperature ? (
                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                          {temperature}°C
                                        </span>
                                      ) : (
                                        <span className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-5">
                                      {healthStatus ? (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          healthStatus === 'Gut' 
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : healthStatus === 'Mittel'
                                            ? 'bg-yellow-500/10 text-yellow-500'
                                            : 'bg-red-500/10 text-red-500'
                                        }`}>
                                          {healthStatus}
                                        </span>
                                      ) : (
                                        <span className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                          —
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-8 px-5 text-center">
                                  <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Keine Slots konfiguriert
                                  </span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Foto-Verwaltung */}
                    <div className={`rounded-2xl border p-5 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Station Fotos (max. 3)
                      </h5>
                      <PhotoManager 
                        station={selectedStation} 
                        onUpdate={(photos) => updateStation(selectedStation.id, { photos })}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Öffnungszeiten */}
                    <div className={`rounded-2xl border p-5 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Öffnungszeiten
                      </h5>
                      <div className="space-y-3">
                        <textarea
                          value={selectedStation.opening_hours || ''}
                          onChange={(e) => {
                            updateStation(selectedStation.id, { opening_hours: e.target.value });
                          }}
                          placeholder="z.B. Mo-Fr: 8:00-18:00, Sa: 9:00-16:00, So: geschlossen"
                          className={`w-full px-3 py-2 rounded-lg border text-sm ${
                            isDarkMode
                              ? 'bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-emerald-500'
                              : 'bg-white border-slate-200 text-slate-900 placeholder-gray-400 focus:border-emerald-500'
                          } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                          rows={3}
                        />
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          Geben Sie die Öffnungszeiten für diese Station ein. Diese werden in der Station-Detailansicht angezeigt.
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={`rounded-2xl border p-5 ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => updateStation(selectedStation.id, { charge_enabled: !(selectedStation.charge_enabled ?? true) })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (selectedStation.charge_enabled ?? true)
                              ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                          {(selectedStation.charge_enabled ?? true) ? 'Laden EIN' : 'Laden AUS'}
                        </button>
                        <button
                          onClick={() => deleteStation(selectedStation.id)}
                          className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

          {activeTab === 'transactions' && (
            <div className="h-full flex flex-col">
              <div className={`${sectionHeaderWrapper} p-4 border ${sectionHeaderClasses}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Transaktionen
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Letzte Bewegungen & Auszahlungen</p>
                  </div>
                  <button
                    onClick={fetchStations}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'bg-white/10 text-white hover:bg-white/20' 
                        : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-9-9v3" />
                      <path d="M21 3v6h-6" />
                    </svg>
                    Aktualisieren
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {transactionsData.map((tx) => (
                    <div
                      key={tx.id}
                      className={`rounded-2xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tx.stationName}</p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          {tx.powerbanksMoved} Powerbanks bewegt
                        </p>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tx.amount.toFixed(2)} €</span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            tx.status === 'abgeschlossen'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-yellow-500/10 text-yellow-500'
                          }`}
                        >
                          {tx.status}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          {tx.timestamp ? tx.timestamp.toLocaleDateString() : 'offene Buchung'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="h-full flex flex-col">
              {/* Benutzer Header */}
              <div className={`${sectionHeaderWrapper} p-4 border ${sectionHeaderClasses}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h3 className={`text-lg font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Benutzer ({users.length})
                  </h3>
                </div>
              </div>

              {/* Benutzer Liste */}
              <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {users.map((user) => (
                        <div
                          key={user.user_id}
                          className={`p-4 rounded-lg border ${
                            isDarkMode
                              ? 'bg-white/5 border-white/10'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.email}</h4>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                Registriert: {new Date(user.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded text-sm ${
                                user.role === 'owner'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                  : user.role === 'admin'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                              }`}>
                                {user.role}
                              </span>
                              {user.role !== 'owner' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => assignUserRole(user.user_id, 'owner')}
                                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
                                  >
                                    Owner
                                  </button>
                                  <button
                                    onClick={() => assignUserRole(user.user_id, 'user')}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                                  >
                                    User
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Add Station Form */}
      {showAddStationForm && (
        <AddStationForm
          onClose={() => setShowAddStationForm(false)}
          onSubmit={handleAddStation}
          isDarkMode={isDarkMode}
          userLocation={userLocation}
        />
      )}
  </div>
);
}
