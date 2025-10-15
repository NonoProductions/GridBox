"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isOwner } from "@/lib/userRoles";
import { Station } from "@/components/StationManager";
import AddStationForm from "@/components/AddStationForm";

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'stations' | 'users'>('stations');
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStationForm, setShowAddStationForm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean | null>(null);
  const [userIsOwner, setUserIsOwner] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Theme aus URL-Parameter lesen
  useEffect(() => {
    const themeParam = searchParams.get("theme");
    if (themeParam === "light") {
      setIsDarkMode(false);
    } else if (themeParam === "dark") {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(true); // Default zu dark mode
    }
  }, [searchParams]);

  // Hole Benutzerstandort - verwende gecachte Position
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
        enableHighAccuracy: false, // Reduziert wiederholte Anfragen
        maximumAge: 600000, // 10 Minuten - nutze gecachte Position
        timeout: 10000
      }
    );
  }, []);

  // Prüfe Owner-Status
  useEffect(() => {
    const checkOwnerStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Nicht eingeloggt - weiterleiten zur Login-Seite
          router.push('/login');
          return;
        }

        const ownerStatus = await isOwner();
        setUserIsOwner(ownerStatus);
        
        if (!ownerStatus) {
          setError('Sie haben keine Berechtigung für das Owner-Dashboard');
        }
      } catch (err) {
        console.error('Fehler beim Prüfen der Berechtigung:', err);
        setError('Fehler beim Laden der Berechtigung');
      } finally {
        setAuthLoading(false);
      }
    };

    checkOwnerStatus();
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
      setStations(data || []);
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data?.map(profile => ({
        user_id: profile.id,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at
      })) || []);
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
      setError('Fehler beim Laden der Benutzer');
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

  useEffect(() => {
    if (userIsOwner && activeTab === 'stations') {
      fetchStations();
    } else if (userIsOwner && activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, userIsOwner]);

  // Loading State
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode === true ? 'text-white' : 'bg-white text-slate-900'
      }`} style={isDarkMode === true ? { backgroundColor: '#282828' } : {}}>
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
          <span className="text-lg font-medium">Lade Dashboard...</span>
        </div>
      </div>
    );
  }

  // Nicht autorisiert
  if (!userIsOwner) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode === true ? 'text-white' : 'bg-white text-slate-900'
      }`} style={isDarkMode === true ? { backgroundColor: '#282828' } : {}}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Zugriff verweigert</h1>
          <p className={`mb-4 ${
            isDarkMode === true ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Sie haben keine Berechtigung für das Owner-Dashboard
          </p>
          <button
            onClick={() => {
              router.push(`/?theme=${isDarkMode === true ? "dark" : "light"}`);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Zurück zur Karte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      isDarkMode === true ? 'text-white' : 'bg-white text-slate-900'
    }`} style={isDarkMode === true ? { backgroundColor: '#282828' } : {}}>
      {/* Header */}
      <div className={`border-b ${
        isDarkMode === true ? 'border-gray-600' : 'border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  router.push(`/?theme=${isDarkMode === true ? "dark" : "light"}`);
                }}
                className={`p-2 rounded-lg hover:bg-opacity-20 ${
                  isDarkMode === true ? 'hover:bg-white' : 'hover:bg-slate-900'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-2xl font-bold">Owner Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newTheme = isDarkMode === false ? "dark" : "light";
                  router.push(`/dashboard?theme=${newTheme}`);
                }}
                className={`p-2 rounded-lg hover:bg-opacity-20 ${
                  isDarkMode === true ? 'hover:bg-white' : 'hover:bg-slate-900'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isDarkMode ? (
                    // Sonne (um zu Light Mode zu wechseln)
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>
                  ) : (
                    // Mond (um zu Dark Mode zu wechseln)
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex border-b ${
          isDarkMode === true ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <button
            onClick={() => setActiveTab('stations')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'stations'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : isDarkMode === true
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Stationen verwalten
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'users'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : isDarkMode === true
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Benutzer verwalten
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            isDarkMode === true
              ? 'bg-red-900 text-red-300 border-red-700'
              : 'bg-red-100 text-red-700 border-red-200'
          }`}>
            {error}
          </div>
        )}

        {activeTab === 'stations' && (
          <div>
            {/* Stationen Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Stationen ({stations.length})</h2>
              <button
                onClick={() => setShowAddStationForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                + Neue Station
              </button>
            </div>

            {/* Stationen Liste */}
            <div className="grid gap-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                </div>
              ) : (
                stations.map((station) => (
                  <div
                    key={station.id}
                    className={`p-6 rounded-lg border ${
                      isDarkMode === true
                        ? 'border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    }`} style={isDarkMode === true ? { backgroundColor: '#1f1f1f' } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{station.name}</h3>
                        <p className={`text-sm ${
                          isDarkMode === true ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Koordinaten: {station.lat}, {station.lng}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStation(station.id, { is_active: !station.is_active })}
                          className={`px-3 py-1 rounded text-sm ${
                            station.is_active
                              ? isDarkMode === true
                                ? 'bg-green-900 text-green-300'
                                : 'bg-green-100 text-green-700'
                              : isDarkMode === true
                                ? 'bg-red-900 text-red-300'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {station.is_active ? 'Aktiv' : 'Inaktiv'}
                        </button>
                        <button
                          onClick={() => deleteStation(station.id)}
                          className={`px-3 py-1 rounded text-sm ${
                            isDarkMode === true
                              ? 'bg-red-900 text-red-300 hover:bg-red-800'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            {/* Benutzer Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Benutzer ({users.length})</h2>
            </div>

            {/* Benutzer Liste */}
            <div className="grid gap-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.user_id}
                    className={`p-6 rounded-lg border ${
                      isDarkMode === true
                        ? 'border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    }`} style={isDarkMode === true ? { backgroundColor: '#1f1f1f' } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{user.email}</h3>
                        <p className={`text-sm ${
                          isDarkMode === true ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Registriert: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded text-sm ${
                          user.role === 'owner'
                            ? isDarkMode === true 
                              ? 'bg-purple-900 text-purple-300'
                              : 'bg-purple-100 text-purple-700'
                            : isDarkMode === true
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                        {user.role !== 'owner' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => assignUserRole(user.user_id, 'owner')}
                              className={`px-2 py-1 rounded text-xs ${
                                isDarkMode === true
                                  ? 'bg-purple-900 text-purple-300 hover:bg-purple-800'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              }`}
                            >
                              Owner
                            </button>
                            <button
                              onClick={() => assignUserRole(user.user_id, 'user')}
                              className={`px-2 py-1 rounded text-xs ${
                                isDarkMode === true
                                  ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Station Form */}
      {showAddStationForm && (
        <AddStationForm
          onClose={() => setShowAddStationForm(false)}
          onSubmit={handleAddStation}
          isDarkMode={isDarkMode === true}
          userLocation={userLocation}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

