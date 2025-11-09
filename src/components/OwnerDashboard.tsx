"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Station } from "./StationManager";
import AddStationForm from "./AddStationForm";
import StationQRCode from "./StationQRCode";

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface OwnerDashboardProps {
  isDarkMode: boolean;
  onClose: () => void;
}

export default function OwnerDashboard({ isDarkMode, onClose }: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'stations' | 'users' | 'qrcodes'>('stations');
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddStationForm, setShowAddStationForm] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

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
    if (activeTab === 'stations' || activeTab === 'qrcodes') {
      fetchStations();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  return (
    <div className={`fixed inset-0 z-[2000] ${
      isDarkMode 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        } shadow-sm`}>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Zurück"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h2 className="text-2xl font-bold">Owner Dashboard</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => setActiveTab('stations')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'stations'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Stationen verwalten
          </button>
          <button
            onClick={() => setActiveTab('qrcodes')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'qrcodes'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            QR-Codes
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'users'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Benutzer verwalten
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error && (
            <div className={`m-4 p-3 rounded-lg border ${
              isDarkMode
                ? 'bg-red-900/20 text-red-400 border-red-800'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {error}
            </div>
          )}

          {activeTab === 'stations' && (
            <div className="h-full flex flex-col">
              {/* Stationen Header */}
              <div className={`p-4 border-b ${
                isDarkMode 
                  ? 'border-gray-700 bg-gray-800/50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Stationen ({stations.length})
                  </h3>
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
              </div>

              {/* Stationen Liste */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                            : 'bg-white border-gray-200 hover:shadow-md'
                        }`}
                      >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{station.name}</h4>
                                {station.short_code && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded text-xs font-mono font-bold">
                                    {station.short_code}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {station.lat}, {station.lng}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {station.available_units} / {station.total_units} verfügbar
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateStation(station.id, { is_active: !station.is_active })}
                                className={`px-3 py-1 rounded text-sm ${
                                  station.is_active
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                }`}
                              >
                                {station.is_active ? 'Aktiv' : 'Inaktiv'}
                              </button>
                              <button
                                onClick={() => deleteStation(station.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          {activeTab === 'qrcodes' && (
            <div className="h-full flex flex-col">
              {/* QR-Codes Header */}
              <div className={`p-4 border-b ${
                isDarkMode 
                  ? 'border-gray-700 bg-gray-800/50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      QR-Codes generieren
                    </h3>
                    <p className={`text-sm mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Erstelle QR-Codes für deine Stationen zum Ausdrucken
                    </p>
                  </div>
                </div>
              </div>

              {/* QR-Codes Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Lade Stationen...
                      </p>
                    </div>
                  </div>
                ) : stations.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          width="64" 
                          height="64" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.5" 
                          className="mx-auto mb-4 text-gray-400"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <rect x="7" y="7" width="3" height="3"/>
                          <rect x="14" y="7" width="3" height="3"/>
                          <rect x="7" y="14" width="3" height="3"/>
                          <rect x="14" y="14" width="3" height="3"/>
                        </svg>
                      <p className={`text-lg font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Keine Stationen vorhanden
                      </p>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-600'
                      }`}>
                        Erstelle zuerst eine Station unter "Stationen verwalten"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className={`p-6 rounded-xl border transition-all ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 hover:shadow-2xl hover:shadow-emerald-500/10'
                            : 'bg-white border-gray-200 hover:shadow-xl'
                        }`}
                      >
                          <div className="flex flex-col items-center">
                            <StationQRCode
                              stationId={station.id}
                              stationName={station.name}
                              shortCode={station.short_code}
                              size={200}
                              showDownload={true}
                            />
                            <div className="mt-4 w-full text-center">
                              <h4 className="font-semibold text-lg mb-1">{station.name}</h4>
                              {station.short_code && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Manueller Code: </span>
                                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded font-mono font-bold text-lg">
                                    {station.short_code}
                                  </span>
                                </div>
                              )}
                              {station.address && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                  📍 {station.address}
                                </p>
                              )}
                              <div className="flex items-center justify-center gap-2 mt-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  station.is_active
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                                }`}>
                                  {station.is_active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                  {station.available_units}/{station.total_units} verfügbar
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Info Box */}
                  {stations.length > 0 && (
                    <div className={`mt-8 p-4 rounded-xl border ${
                      isDarkMode
                        ? 'bg-blue-900/20 border-blue-800'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          width="20" 
                          height="20" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="16" x2="12" y2="12"/>
                          <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Verwendungshinweise
                      </h4>
                      <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                        <li className="flex items-start gap-2">
                          <span className="font-bold">1.</span>
                          <span>Klicke auf "QR-Code herunterladen" unter dem gewünschten QR-Code</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">2.</span>
                          <span>Drucke den QR-Code in guter Qualität aus (mindestens 10x10 cm)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">3.</span>
                          <span>Laminiere den QR-Code oder verwende wetterfeste Aufkleber</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">4.</span>
                          <span>Platziere den QR-Code gut sichtbar an der Station (Augenhöhe 1,2-1,6m)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold">5.</span>
                          <span>Nutzer können den QR-Code scannen, um direkt die Ausleihbestätigung zu sehen</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

          {activeTab === 'users' && (
            <div className="h-full flex flex-col">
              {/* Benutzer Header */}
              <div className={`p-4 border-b ${
                isDarkMode 
                  ? 'border-gray-700 bg-gray-800/50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between">
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
                              ? 'bg-gray-700 border-gray-600'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{user.email}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
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
