"use client";

import { useState, useEffect } from "react";
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
  onClose: () => void;
}

export default function OwnerDashboard({ isDarkMode, onClose }: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'stations' | 'users'>('stations');
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
    if (activeTab === 'stations') {
      fetchStations();
    } else {
      fetchUsers();
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-6xl h-[90vh] rounded-2xl shadow-xl ${
        isDarkMode 
          ? 'bg-gray-800 text-white' 
          : 'bg-white text-slate-900'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold">Owner Dashboard</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full hover:bg-opacity-20 ${
                isDarkMode 
                  ? 'hover:bg-white' 
                  : 'hover:bg-slate-900'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('stations')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'stations'
                  ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Stationen verwalten
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'users'
                  ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Benutzer verwalten
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="m-4 p-3 rounded-lg bg-red-100 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            {activeTab === 'stations' && (
              <div className="h-full flex flex-col">
                {/* Stationen Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Stationen ({stations.length})</h3>
                    <button
                      onClick={() => setShowAddStationForm(true)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      + Neue Station
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
                          className={`p-4 rounded-lg border ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{station.name}</h4>
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

            {activeTab === 'users' && (
              <div className="h-full flex flex-col">
                {/* Benutzer Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Benutzer ({users.length})</h3>
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
