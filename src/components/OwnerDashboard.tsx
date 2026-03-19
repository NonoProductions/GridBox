"use client";

import React, { useState, useEffect, useMemo, type JSX } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import { Station } from "./StationManager";
import AddStationForm from "./AddStationForm";
import { getAbsoluteStationPhotoUrl } from "@/lib/photoUtils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import AnalyticsDashboard from "./AnalyticsDashboard";
import OwnerDashboardV2Content from "./OwnerDashboardV2Content";

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Rental {
  id: string;
  station_id: string;
  total_price: number | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  powerbank_id?: string | null;
}

interface OwnerDashboardProps {
  isDarkMode: boolean;
  onClose?: () => void;
  variant?: "overlay" | "page";
}

type OwnerDashboardTab = 'overview' | 'stats' | 'stations' | 'users' | 'transactions' | 'analytics';

// Photo Manager Component
function PhotoManager({ station, onUpdate, isDarkMode }: { station: Station; onUpdate: (photos: string[]) => void; isDarkMode: boolean }) {
  const [photos, setPhotos] = useState<string[]>(station.photos || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPhotos(station.photos || []);
  }, [station.photos]);

  // File validation constants
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_FILENAME_LENGTH = 255;

  // Validate file before upload
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Nur JPEG, PNG und WebP Bilder sind erlaubt.' };
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'Datei ist zu groß. Maximum: 5MB.' };
    }
    
    // Check filename length
    if (file.name.length > MAX_FILENAME_LENGTH) {
      return { valid: false, error: 'Dateiname ist zu lang.' };
    }
    
    // Validate filename doesn't contain path traversal
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return { valid: false, error: 'Ungültiger Dateiname.' };
    }
    
    return { valid: true };
  };

  // Sanitize filename - remove dangerous characters
  const sanitizeFilename = (filename: string): string => {
    // Extract extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return 'image.jpg'; // Default extension
    }
    
    // Remove path components and sanitize
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${baseName.slice(0, 50)}.${ext}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check total file count
    if (photos.length + files.length > 3) {
      alert('Sie können maximal 3 Fotos hochladen. Bitte entfernen Sie zuerst einige Fotos.');
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length && photos.length + uploadedUrls.length < 3; i++) {
        const file = files[i];
        
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          alert(validation.error || 'Ungültige Datei.');
          continue;
        }
        
        // Sanitize filename and create unique name
        const sanitizedBaseName = sanitizeFilename(file.name);
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${station.id}/${uniqueId}-${sanitizedBaseName}`;
        
        // Upload to Supabase Storage with security settings
        try {
          const { data, error } = await supabase.storage
            .from('station-photos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type, // Explicit content type
            });

          if (error) {
            logger.error('Upload error:', error);
            throw new Error('Fehler beim Hochladen der Datei.');
          }

          if (!data?.path) {
            throw new Error('Upload fehlgeschlagen: Keine Pfad-Information erhalten.');
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('station-photos')
            .getPublicUrl(data.path);
          
          if (!urlData?.publicUrl) {
            throw new Error('Fehler beim Abrufen der öffentlichen URL.');
          }
          
          uploadedUrls.push(urlData.publicUrl);
        } catch (uploadError) {
          logger.error('Upload error:', uploadError);
          // Don't use Data URL fallback - it's a security risk and can cause memory issues
          alert(`Fehler beim Hochladen: ${uploadError instanceof Error ? uploadError.message : 'Unbekannter Fehler'}`);
          continue;
        }
      }

      if (uploadedUrls.length > 0) {
        const newPhotos = [...photos, ...uploadedUrls].slice(0, 3);
        setPhotos(newPhotos);
        onUpdate(newPhotos);
      }
    } catch (error) {
      logger.error('Error uploading photos:', error);
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
                src={getAbsoluteStationPhotoUrl(photo)}
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
                accept="image/jpeg,image/jpg,image/png,image/webp"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [usersSearchQuery, setUsersSearchQuery] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(20);
  const [usersTotalCount, setUsersTotalCount] = useState<number | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRoleFilter, setUsersRoleFilter] = useState<'all' | 'owner' | 'admin' | 'user'>('all');
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStationFilter, setTxStationFilter] = useState<string>('all');
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updatingStation, setUpdatingStation] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [testDataEnabled, setTestDataEnabled] = useState(false);
  const [useNewDesign, setUseNewDesign] = useState(false);
  const [ownerRentals, setOwnerRentals] = useState<Rental[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsTimeRangeDays, setStatsTimeRangeDays] = useState<7 | 14 | 30 | 90>(14);

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
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
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

  // Lade Stationen (mit useCallback für Realtime-Updates)
  const fetchStations = React.useCallback(async (silent = false, forceRefresh = false) => {
    try {
      // Nur beim initialen Laden den Spinner zeigen
      if (!silent) {
        setLoading(true);
      }
      
      // Debug: Prüfe Authentifizierung (nur beim ersten Mal)
      if (!hasInitialLoad || forceRefresh) {
        const { data: { session } } = await supabase.auth.getSession();
        logger.dev('📊 Lade Stationen... (Session vorhanden:', !!session, ')');
      }
      
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, description, lat, lng, available_units, total_units, address, owner_id, is_active, short_code, created_at, updated_at, photos, battery_voltage, battery_percentage, powerbank_id, slot_1_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage, slot_2_powerbank_id, slot_2_battery_voltage, slot_2_battery_percentage, charge_enabled, opening_hours, last_seen')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('❌ Supabase Fehler beim Laden der Stationen:', error);
        throw error;
      }
      
      const stationsData = data || [];
      if (!silent || !hasInitialLoad) {
        logger.dev('✅ Stationen geladen:', stationsData.length, 'Stationen', silent ? '(silent)' : '');
      }
      
      setStations(stationsData);
      // Aktualisiere auch Original-Stationen wenn Testdaten-Modus aktiv ist
      if (testDataEnabled) {
        setOriginalStations([...stationsData]);
      }
      setSelectedStationId((prev) => {
        if (prev && stationsData.some((station: Station) => station.id === prev)) {
          return prev;
        }
        return stationsData.length > 0 ? stationsData[0].id : null;
      });
      setLastUpdate(new Date());
      setError(null); // Clear any previous errors
      
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
        logger.dev('✅ Initial Load abgeschlossen - Cache aktiviert');
      }
    } catch (err) {
      logger.error('❌ Fehler beim Laden der Stationen:', err);
      // Don't leak specific error details to prevent information disclosure
      if (!silent) {
        setError('Fehler beim Laden der Stationen. Bitte versuchen Sie es erneut.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [hasInitialLoad]);

  // Lade Ausleihen (Rentals) der eigenen Stationen für Einnahmen-Statistiken
  const fetchOwnerRentals = React.useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || stations.length === 0) {
      setOwnerRentals([]);
      return;
    }
    setStatsLoading(true);
    try {
      const stationIds = stations.map((s) => s.id).filter(Boolean) as string[];
      if (stationIds.length === 0) {
        setOwnerRentals([]);
        return;
      }
      const { data, error } = await supabase
        .from("rentals")
        .select("id, station_id, amount_cents, started_at, ended_at, status, powerbank_id")
        .in("station_id", stationIds)
        .order("started_at", { ascending: false });

      if (error) {
        logger.warn("Rentals für Statistiken (optional):", error.message);
        setOwnerRentals([]);
        return;
      }
      const list = (data || []).map((r: any) => ({
        id: r.id,
        station_id: r.station_id,
        total_price: r.amount_cents != null ? r.amount_cents / 100 : null,
        started_at: r.started_at,
        ended_at: r.ended_at ?? null,
        status: r.status ?? "",
        powerbank_id: r.powerbank_id ?? null,
      }));
      setOwnerRentals(list);
    } catch (e) {
      logger.warn("Rentals laden:", e);
      setOwnerRentals([]);
    } finally {
      setStatsLoading(false);
    }
  }, [stations]);

  // Lade Transaktionen über Admin-API (umgeht RLS)
  const fetchTransactionRentals = React.useCallback(async () => {
    try {
      setStatsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return;

      const response = await fetch('/api/admin/rentals', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        logger.warn('Rentals API Fehler:', response.status);
        setOwnerRentals([]);
        return;
      }
      const payload = await response.json();
      const list: Rental[] = (Array.isArray(payload?.rentals) ? payload.rentals : []).map((r: any) => ({
        id: r.id,
        station_id: r.station_id,
        total_price: r.total_price != null ? Number(r.total_price) : null,
        started_at: r.started_at,
        ended_at: r.ended_at ?? null,
        status: r.status ?? '',
        powerbank_id: r.powerbank_id ?? null,
      }));
      setOwnerRentals(list);
    } catch (e) {
      logger.warn('fetchTransactionRentals Fehler:', e);
      setOwnerRentals([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Lade Benutzer (mit Suche und Paginierung)
  const fetchUsers = React.useCallback(async (opts?: { search?: string; page?: number; pageSize?: number; role?: string }) => {
    try {
      setUsersLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Sie müssen eingeloggt sein, um Benutzer zu sehen');
      }

      const search = opts?.search ?? usersSearchQuery;
      const page = opts?.page ?? usersPage;
      const pageSize = opts?.pageSize ?? usersPageSize;
      const role = opts?.role !== undefined ? opts.role : usersRoleFilter;
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (role && role !== 'all') params.set('role', role);

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        let message = 'Fehler beim Laden der Benutzer';
        try {
          const body = await response.json();
          if (body?.message) message = body.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const usersData: UserWithRole[] = Array.isArray(payload?.users) ? payload.users : [];
      const total = typeof payload?.total === 'number' ? payload.total : usersData.length;
      setUsers(usersData);
      setUsersCount(total);
      setUsersTotalCount(total);
      if (opts?.page != null) setUsersPage(opts.page);
      if (opts?.pageSize != null) setUsersPageSize(opts.pageSize);
      if (opts?.search !== undefined) setUsersSearchQuery(opts.search);
      if (opts?.role !== undefined) setUsersRoleFilter(opts.role as 'all' | 'owner' | 'admin' | 'user');
    } catch (err) {
      logger.error('Fehler beim Laden der Benutzer:', err);
      setError('Fehler beim Laden der Benutzer. Bitte versuchen Sie es erneut.');
      setUsers([]);
      setUsersCount(null);
      setUsersTotalCount(null);
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearchQuery, usersPage, usersPageSize, usersRoleFilter]);

  // Lösche Station (with validation and authorization check)
  const deleteStation = async (id: string) => {
    // Wenn Testdaten aktiviert sind, nur lokale Löschung
    if (testDataEnabled) {
      if (!confirm('Sind Sie sicher, dass Sie diese Station löschen möchten? (Testdaten-Modus: Nur lokale Löschung)')) return;
      setStations(prev => prev.filter(station => station.id !== id));
      setSelectedStationId(null);
      logger.dev('⚠️ Testdaten-Modus: Löschung nur lokal (keine DB-Änderung)');
      return;
    }

    // Validate ID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      setError('Ungültige Station-ID');
      return;
    }
    
    if (!confirm('Sind Sie sicher, dass Sie diese Station löschen möchten?')) return;
    
    try {
      // Verify user is owner before deletion
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sie müssen angemeldet sein, um Stationen zu löschen');
        return;
      }

      // Check if user owns this station
      const { data: stationData, error: checkError } = await supabase
        .from('stations')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (checkError || !stationData) {
        setError('Station nicht gefunden');
        return;
      }

      // Verify ownership (if owner_id is set)
      if (stationData.owner_id && stationData.owner_id !== user.id) {
        setError('Sie haben keine Berechtigung, diese Station zu löschen');
        return;
      }

      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Delete error:', error);
        throw error;
      }
      
      // Lokale Aktualisierung für sofortiges Feedback
      setStations(prev => prev.filter(station => station.id !== id));
      setSelectedStationId(null);
      setError(null);
    } catch (err) {
      logger.error('Fehler beim Löschen der Station:', err);
      setError('Fehler beim Löschen der Station. Bitte versuchen Sie es erneut.');
      // Bei Fehler: Hole Daten erneut mit Force-Refresh
      fetchStations(true, true);
    }
  };

  // Aktualisiere Station (with validation and authorization)
  const updateStation = async (id: string, updates: Partial<Station>) => {
    // Wenn Testdaten aktiviert sind, nur lokale Updates (keine DB-Schreibvorgänge)
    if (testDataEnabled) {
      setStations(prev => prev.map(station => 
        station.id === id ? { ...station, ...updates } : station
      ));
      logger.dev('⚠️ Testdaten-Modus: Update nur lokal (keine DB-Änderung)');
      return;
    }

    // Validate ID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      setError('Ungültige Station-ID');
      return;
    }

    // Validate and sanitize updates
    const sanitizedUpdates: Partial<Station> = {};
    
    if (updates.name !== undefined) {
      const name = String(updates.name).trim().slice(0, 100);
      if (name.length === 0) {
        setError('Name darf nicht leer sein');
        return;
      }
      sanitizedUpdates.name = name;
    }
    
    if (updates.description !== undefined) {
      sanitizedUpdates.description = String(updates.description).trim().slice(0, 500);
    }
    
    if (updates.address !== undefined) {
      sanitizedUpdates.address = String(updates.address).trim().slice(0, 200);
    }
    
    if (updates.lat !== undefined) {
      const lat = Number(updates.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError('Ungültiger Breitengrad');
        return;
      }
      sanitizedUpdates.lat = lat;
    }
    
    if (updates.lng !== undefined) {
      const lng = Number(updates.lng);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setError('Ungültiger Längengrad');
        return;
      }
      sanitizedUpdates.lng = lng;
    }
    
    if (updates.total_units !== undefined) {
      const totalUnits = Number(updates.total_units);
      if (isNaN(totalUnits) || totalUnits < 0 || totalUnits > 100) {
        setError('Anzahl der Powerbanks muss zwischen 0 und 100 liegen');
        return;
      }
      sanitizedUpdates.total_units = Math.floor(totalUnits);
    }
    
    // Copy other safe fields
    if (updates.is_active !== undefined) sanitizedUpdates.is_active = Boolean(updates.is_active);
    if (updates.charge_enabled !== undefined) sanitizedUpdates.charge_enabled = Boolean(updates.charge_enabled);
    if (updates.opening_hours !== undefined) {
      sanitizedUpdates.opening_hours = String(updates.opening_hours).trim().slice(0, 200);
    }
    if (updates.photos !== undefined && Array.isArray(updates.photos)) {
      // Validate photo URLs
      sanitizedUpdates.photos = updates.photos
        .slice(0, 3)
        .filter((url): url is string => typeof url === 'string' && url.length > 0 && url.length < 2048);
    }

    try {
      setUpdatingStation(id);
      
      // Verify user is owner before update
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sie müssen angemeldet sein, um Stationen zu aktualisieren');
        setUpdatingStation(null);
        return;
      }

      // Check ownership if owner_id exists
      const { data: stationData } = await supabase
        .from('stations')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (stationData?.owner_id && stationData.owner_id !== user.id) {
        setError('Sie haben keine Berechtigung, diese Station zu aktualisieren');
        setUpdatingStation(null);
        return;
      }
      
      // Optimistische UI-Aktualisierung für sofortiges Feedback
      setStations(prev => prev.map(station => 
        station.id === id ? { ...station, ...sanitizedUpdates } : station
      ));

      const { error } = await supabase
        .from('stations')
        .update(sanitizedUpdates)
        .eq('id', id);

      if (error) {
        logger.error('Supabase Update Fehler:', error);
        throw error;
      }
      
      logger.dev('✅ Station erfolgreich aktualisiert:', id);
      setError(null);
    } catch (err) {
      logger.error('❌ Fehler beim Aktualisieren der Station:', err);
      // Don't leak specific error details
      setError('Fehler beim Aktualisieren der Station. Bitte versuchen Sie es erneut.');
      // Bei Fehler: Stelle alten Zustand wieder her mit Force-Refresh
      fetchStations(true, true);
    } finally {
      setUpdatingStation(null);
    }
  };

  // Füge neue Station hinzu (with validation and error handling)
  const handleAddStation = async (stationData: Omit<Station, 'id' | 'created_at' | 'updated_at'>) => {
    // Wenn Testdaten aktiviert sind, nur lokale Hinzufügung
    if (testDataEnabled) {
      const newStation: Station = {
        ...stationData,
        id: `test-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        battery_voltage: 3.7,
        battery_percentage: 85,
        available_units: 0,
      };
      setStations(prev => [newStation, ...prev]);
      setShowAddStationForm(false);
      logger.dev('⚠️ Testdaten-Modus: Station nur lokal hinzugefügt (keine DB-Änderung)');
      return;
    }

    try {
      setError(null);
      
      // Validate station data
      if (!stationData.name || !stationData.name.trim()) {
        throw new Error('Name ist erforderlich');
      }
      
      if (stationData.lat < -90 || stationData.lat > 90) {
        throw new Error('Ungültiger Breitengrad');
      }
      
      if (stationData.lng < -180 || stationData.lng > 180) {
        throw new Error('Ungültiger Längengrad');
      }
      
      if (stationData.total_units !== undefined && (stationData.total_units < 0 || stationData.total_units > 100)) {
        throw new Error('Anzahl der Powerbanks muss zwischen 0 und 100 liegen');
      }
      
      // Hole den aktuellen Benutzer
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Sie müssen eingeloggt sein, um eine Station hinzuzufügen');
      }
      
      // Sanitize and prepare data
      const sanitizedData = {
        name: String(stationData.name).trim().slice(0, 100),
        description: stationData.description ? String(stationData.description).trim().slice(0, 500) : null,
        lat: Number(stationData.lat),
        lng: Number(stationData.lng),
        address: stationData.address ? String(stationData.address).trim().slice(0, 200) : null,
        total_units: stationData.total_units !== undefined ? Math.max(0, Math.min(100, Math.floor(Number(stationData.total_units)))) : 0,
        available_units: 0,
        is_active: Boolean(stationData.is_active ?? true),
        owner_id: user.id,
        charge_enabled: Boolean(stationData.charge_enabled ?? true),
        opening_hours: stationData.opening_hours ? String(stationData.opening_hours).trim().slice(0, 200) : null,
        photos: Array.isArray(stationData.photos) ? stationData.photos.slice(0, 3) : [],
      };
      
      const { data, error } = await supabase
        .from('stations')
        .insert([sanitizedData])
        .select();

      if (error) {
        logger.error('Supabase Fehler:', error);
        // Don't leak specific database errors
        throw new Error('Fehler beim Hinzufügen der Station. Bitte versuchen Sie es erneut.');
      }
      
      if (!data || data.length === 0) {
        throw new Error('Station konnte nicht erstellt werden');
      }
      
      logger.dev('Station erfolgreich hinzugefügt');
      // Realtime macht das Update automatisch
      setShowAddStationForm(false);
      setError(null);
    } catch (err: unknown) {
      logger.error('Fehler beim Hinzufügen der Station:', err);
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Hinzufügen der Station';
      setError(errorMessage);
      throw err;
    }
  };

  // Weise Benutzerrolle zu (with validation)
  const assignUserRole = async (userId: string, role: 'owner' | 'user') => {
    // Validate inputs
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      setError('Ungültige Benutzer-ID');
      return;
    }
    
    if (role !== 'owner' && role !== 'user') {
      setError('Ungültige Rolle');
      return;
    }

    try {
      // Verify current user is owner
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sie müssen angemeldet sein');
        return;
      }

      // Prevent self-demotion from owner (client-side pre-check)
      if (userId === user.id && role === 'user') {
        setError('Sie können sich nicht selbst die Owner-Rolle entziehen');
        return;
      }

      // Use secure server-side function for role assignment
      const { error } = await supabase.rpc('assign_user_role', {
        p_target_user_id: userId,
        p_new_role: role,
      });

      if (error) {
        logger.error('Role assignment error:', error);
        throw error;
      }
      
      await fetchUsers();
      setError(null);
    } catch (err) {
      logger.error('Fehler beim Zuweisen der Rolle:', err);
      setError('Fehler beim Zuweisen der Rolle. Bitte versuchen Sie es erneut.');
    }
  };

  // Entferne Benutzerrolle (setzt auf 'user')
  const removeUserRole = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('assign_user_role', {
        p_target_user_id: userId,
        p_new_role: 'user',
      });

      if (error) throw error;
      await fetchUsers();
    } catch (err) {
      logger.error('Fehler beim Entfernen der Rolle:', err);
      setError('Fehler beim Entfernen der Rolle');
    }
  };

  // Hole Benutzerstandort
  useEffect(() => {
    if (!navigator.geolocation) {
      logger.warn('Geolocation wird von diesem Browser nicht unterstützt');
      setUserLocation({ lat: 52.52, lng: 13.405 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        logger.dev('Benutzerstandort erhalten:', { lat: latitude, lng: longitude });
      },
      (error) => {
        logger.error('Geolocation Fehler:', error);
        setUserLocation({ lat: 52.52, lng: 13.405 });
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 300000,
        timeout: 10000
      }
    );
  }, []);

  // Initial Load nur einmal beim ersten Öffnen
  useEffect(() => {
    if (!hasInitialLoad) {
      logger.dev('🚀 Initialer Ladevorgang...');
      fetchStations(false, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Nur einmal beim Mount

  // Testdaten-Funktion: Generiert realistische Testdaten für alle Stationen
  const generateTestData = (baseStations: Station[]): Station[] => {
    if (baseStations.length === 0) return [];
    const now = Date.now() / 10000;

    return baseStations.map((station, index) => {
      const baseVoltage = 3.6 + (index % 3) * 0.1;
      const basePercentage = 65 + (index % 5) * 8; // 65% - 97%
      const variation = Math.sin(now + index) * 0.04;
      const batteryPct = Math.max(0, Math.min(100, Math.round(basePercentage + variation * 100)));
      // Unterschiedliche Auslastung: manche Stationen voll, manche leer, manche teilweise
      const totalUnits = station.total_units ?? 2;
      const slot1Occupied = index % 3 !== 1;
      const slot2Occupied = index % 3 === 0;
      const occupied = (slot1Occupied ? 1 : 0) + (slot2Occupied ? 1 : 0);
      const availableUnits = Math.max(0, totalUnits - occupied);

      return {
        ...station,
        battery_voltage: baseVoltage + variation,
        battery_percentage: batteryPct,
        slot_1_battery_voltage: slot1Occupied ? baseVoltage + variation : null,
        slot_1_battery_percentage: slot1Occupied ? batteryPct : null,
        slot_1_powerbank_id: slot1Occupied ? `PB-DEMO-${index * 2 + 1}` : null,
        slot_2_battery_voltage: slot2Occupied ? baseVoltage + variation * 0.9 : null,
        slot_2_battery_percentage: slot2Occupied ? Math.max(0, Math.min(100, batteryPct - 15)) : null,
        slot_2_powerbank_id: slot2Occupied ? `PB-DEMO-${index * 2 + 2}` : null,
        available_units: availableUnits,
        updated_at: new Date().toISOString(),
        is_active: index % 10 !== 2, // eine Station gelegentlich „pausiert“
      };
    });
  };

  // Test-Rentals für Einnahmen-Statistiken (deterministisch, damit Graphen stabil sind)
  const generateTestRentals = (baseStations: Station[]): Rental[] => {
    if (baseStations.length === 0) return [];
    const rentals: Rental[] = [];
    const stationIds = baseStations.map((s) => s.id).filter(Boolean) as string[];
    let id = 0;
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      date.setHours(8 + (dayOffset % 6), (dayOffset * 7) % 60, 0, 0);
      const dayStr = date.toISOString().slice(0, 10);
      const countThisDay = 2 + (dayOffset % 4) + (stationIds.length > 1 ? 1 : 0);
      for (let i = 0; i < countThisDay; i++) {
        const stationIndex = (dayOffset + i) % stationIds.length;
        const price = 1.2 + (stationIndex * 0.5) + (i % 3) * 0.8; // 1.20 € - ca. 5.50 €
        const start = new Date(date);
        start.setMinutes(start.getMinutes() + i * 25);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 15 + (i % 45));
        rentals.push({
          id: `test-rental-${id++}`,
          station_id: stationIds[stationIndex],
          total_price: Math.round(price * 100) / 100,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          status: "finished",
        });
      }
    }
    return rentals;
  };

  // Speichere Original-Stationen für Testdaten-Modus
  const [originalStations, setOriginalStations] = useState<Station[]>([]);

  // Aktiviere/Deaktiviere Testdaten
  const toggleTestData = async () => {
    if (!testDataEnabled) {
      setOriginalStations([...stations]);
      const testStations = generateTestData(stations);
      setStations(testStations);
      setOwnerRentals(generateTestRentals(testStations));
      setTestDataEnabled(true);
      logger.dev('✅ Testdaten aktiviert');
    } else {
      setTestDataEnabled(false);
      setOwnerRentals([]);
      await fetchStations(false, true);
      logger.dev('✅ Testdaten deaktiviert - echte Daten geladen');
    }
  };

  // Aktualisiere Testdaten regelmäßig wenn aktiviert
  useEffect(() => {
    if (!testDataEnabled || originalStations.length === 0) return;
    
    const interval = setInterval(() => {
      setStations(prev => {
        // Verwende Original-Stationen als Basis für konsistente Testdaten
        const testStations = generateTestData(originalStations);
        return testStations;
      });
      setLastUpdate(new Date());
    }, 2000); // Alle 2 Sekunden aktualisieren
    
    return () => clearInterval(interval);
  }, [testDataEnabled, originalStations.length]);
  
  // Lade Users wenn Users-Tab geöffnet wird (erster Besuch oder bei Wechsel)
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]); // fetchUsers nicht in deps, um Endlosschleife zu vermeiden

  // Lade Rentals für Statistiken wenn Statistik-Tab geöffnet wird
  useEffect(() => {
    if (activeTab !== 'stats' || stations.length === 0) return;
    if (testDataEnabled) {
      setStatsLoading(false);
      setOwnerRentals(generateTestRentals(originalStations.length > 0 ? originalStations : stations));
    } else {
      fetchOwnerRentals();
    }
  }, [activeTab, stations.length, testDataEnabled, originalStations, fetchOwnerRentals]);

  // Lade Rentals für Transaktionen-Tab (über Admin-API, umgeht RLS)
  useEffect(() => {
    if (activeTab !== 'transactions') return;
    if (testDataEnabled) {
      setOwnerRentals(generateTestRentals(originalStations.length > 0 ? originalStations : stations));
    } else {
      fetchTransactionRentals();
    }
    setTxPage(1);
  }, [activeTab]); // fetchTransactionRentals nicht in deps

  // Automatische Updates: ROBUSTES System mit Realtime + Polling Backup
  useEffect(() => {
    // Starte Updates nur wenn initial geladen wurde
    if (!hasInitialLoad) {
      return;
    }

    logger.dev('🔄 Aktiviere robuste Hintergrund-Updates...');
    
    let isSubscribed = true;
    let channel: any = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    let pollingInterval: NodeJS.Timeout | null = null;
    let realtimeIsActive = false;

    // Funktion zum Starten/Stoppen des Pollings
    const startPolling = () => {
      if (pollingInterval || realtimeIsActive) return;
      logger.dev('⏱️ Starte Polling-Fallback (alle 30 Sekunden) - Realtime inaktiv');
      pollingInterval = setInterval(() => {
        if (isSubscribed && !realtimeIsActive) {
          logger.dev('🔄 Polling-Update (Realtime inaktiv)...');
          fetchStations(true, true); // Silent refresh
        }
      }, 30000); // 30 Sekunden statt 8 - reduziert Egress um ~87%
    };

    const stopPolling = () => {
      if (pollingInterval) {
        logger.dev('⏸️ Stoppe Polling (Realtime aktiv)');
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    // Funktion zum Starten/Neustarten der Realtime-Verbindung
    const startRealtimeSubscription = () => {
      if (!isSubscribed) return;
      
      // Entferne alte Verbindung falls vorhanden
      if (channel) {
        supabase.removeChannel(channel);
      }

      logger.dev('🔌 Starte Realtime-Subscription...');
      
      // Erstelle neue Realtime-Verbindung
      channel = supabase
        .channel(`stations-updates-${Date.now()}`) // Unique channel name
        .on(
          'postgres_changes' as any,
          {
            event: '*', // Alle Events: INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'stations'
          },
          (payload: { eventType: string; new?: Station | null; old?: Station | null }) => {
            const newStation = payload.new as Station | null | undefined;
            const oldStation = payload.old as Station | null | undefined;
            logger.dev('📡 Realtime Update:', payload.eventType, newStation?.name || oldStation?.name);
            
            // Optimistische Update-Strategie
            if (payload.eventType === 'UPDATE' && newStation) {
              setStations(prev => prev.map(station => {
                if (station.id === newStation.id) {
                  const updated = { ...station, ...newStation };
                  
                  // Debug-Log
                  const changedFields = Object.keys(newStation)
                    .filter(key => key !== 'id' && station[key as keyof Station] !== newStation[key as keyof Station])
                    .map(key => `${key}: ${station[key as keyof Station]} → ${newStation[key as keyof Station]}`);
                  
                  if (changedFields.length > 0) {
                    logger.dev('✅ Station aktualisiert:', updated.name);
                    logger.dev('   Änderungen:', changedFields.join(', '));
                  }
                  
                  return updated;
                }
                return station;
              }));
              setLastUpdate(new Date());
              reconnectAttempts = 0; // Reset bei erfolgreicher Nachricht
            } else if (payload.eventType === 'INSERT' && newStation) {
              logger.dev('➕ Neue Station:', newStation.name);
              setStations(prev => [newStation, ...prev]);
              setLastUpdate(new Date());
              reconnectAttempts = 0;
            } else if (payload.eventType === 'DELETE' && oldStation) {
              logger.dev('➖ Station entfernt:', oldStation.name);
              setStations(prev => prev.filter(s => s.id !== oldStation.id));
              setLastUpdate(new Date());
              reconnectAttempts = 0;
            }
          }
        )
        .subscribe((status) => {
          logger.dev('📡 Realtime Status:', status);
          
          if (status === 'SUBSCRIBED') {
            logger.dev('✅ Realtime aktiv - Polling wird gestoppt');
            realtimeIsActive = true;
            setRealtimeActive(true);
            reconnectAttempts = 0;
            stopPolling(); // Stoppe Polling wenn Realtime aktiv ist
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.warn('⚠️ Realtime Fehler:', status);
            realtimeIsActive = false;
            setRealtimeActive(false);
            startPolling(); // Starte Polling wenn Realtime nicht funktioniert
            
            // Auto-Reconnect mit exponential backoff
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              reconnectAttempts++;
              logger.dev(`🔄 Reconnect Versuch ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
              setTimeout(() => startRealtimeSubscription(), delay);
            } else {
              logger.warn('❌ Max Reconnect-Versuche erreicht, nutze nur Polling');
            }
          } else if (status === 'CLOSED') {
            logger.dev('🔌 Realtime geschlossen');
            realtimeIsActive = false;
            setRealtimeActive(false);
            startPolling(); // Starte Polling wenn Realtime geschlossen ist
          }
        });
    };

    // Starte Realtime
    startRealtimeSubscription();

    // Starte Polling initial als Fallback (wird gestoppt sobald Realtime aktiv ist)
    startPolling();

    // Cleanup
    return () => {
      logger.dev('🛑 Stoppe alle Hintergrund-Updates');
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      stopPolling();
      setRealtimeActive(false);
    };
  }, [hasInitialLoad, fetchStations]);

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
  // Helper-Funktion: Prüfe ob Station verbunden ist (updated_at < 60 Sekunden alt)
  const isStationConnected = (station: Station): boolean => {
    if (!station.updated_at) return false;
    try {
      // Stelle sicher, dass updated_at ein gültiges Datum ist
      const lastContact = new Date(station.updated_at);
      
      // Prüfe ob Datum valid ist
      if (isNaN(lastContact.getTime())) {
        logger.warn('Ungültiges updated_at für Station:', station.name, station.updated_at);
        return false;
      }
      
      const now = new Date();
      const diffSeconds = (now.getTime() - lastContact.getTime()) / 1000;
      
      // 90 Sekunden Toleranz: ESP32 sendet alle 15s; bei kurzen Ausfällen bleibt Station sichtbar
      return diffSeconds < 90;
    } catch (error) {
      logger.error('Fehler beim Prüfen der Station-Verbindung:', error, station.name);
      return false;
    }
  };

  const filteredStations = showOnlyConnected 
    ? stations.filter(isStationConnected) 
    : stations;

  const selectedStation = selectedStationId
    ? stations.find((station) => station.id === selectedStationId) || null
    : null;
  const connectedStationsCount = stations.filter(isStationConnected).length;
  const activeStationsCount = stations.filter((station) => station.is_active).length;
  const inactiveStationsCount = stations.length - activeStationsCount;
  const totalCapacity = stations.reduce((sum, station) => sum + (station.total_units || 0), 0);

  // Prüfe ob ein bestimmter Slot belegt ist
  const isSlotOccupied = (station: Station, slotNumber: number): boolean => {
    if (slotNumber === 1) {
      const hasSlot1Id = typeof station.slot_1_powerbank_id === 'string' && station.slot_1_powerbank_id.trim().length > 0;
      const hasSlot1Battery = station.slot_1_battery_voltage != null && station.slot_1_battery_percentage != null;
      // Fallback auf Legacy-Felder für Slot 1
      const hasLegacy = (typeof station.powerbank_id === 'string' && station.powerbank_id.trim().length > 0) ||
        (station.battery_voltage != null && station.battery_percentage != null);
      return hasSlot1Id || hasSlot1Battery || hasLegacy;
    }
    if (slotNumber === 2) {
      const hasSlot2Id = typeof station.slot_2_powerbank_id === 'string' && station.slot_2_powerbank_id.trim().length > 0;
      const hasSlot2Battery = station.slot_2_battery_voltage != null && station.slot_2_battery_percentage != null;
      return hasSlot2Id || hasSlot2Battery;
    }
    return false;
  };

  // Slot-spezifische Daten abrufen
  const getSlotData = (station: Station, slotNumber: number) => {
    if (slotNumber === 1) {
      return {
        voltage: station.slot_1_battery_voltage ?? station.battery_voltage ?? null,
        percentage: station.slot_1_battery_percentage ?? station.battery_percentage ?? null,
        powerbankId: station.slot_1_powerbank_id ?? station.powerbank_id ?? null,
      };
    }
    if (slotNumber === 2) {
      return {
        voltage: station.slot_2_battery_voltage ?? null,
        percentage: station.slot_2_battery_percentage ?? null,
        powerbankId: station.slot_2_powerbank_id ?? null,
      };
    }
    return { voltage: null, percentage: null, powerbankId: null };
  };

  // Zähle belegte Slots einer Station
  const countOccupiedSlots = (station: Station): number => {
    const totalSlots = station.total_units ?? 0;
    let count = 0;
    for (let i = 1; i <= totalSlots; i++) {
      if (isSlotOccupied(station, i)) count++;
    }
    return count;
  };

  const hasStationPowerbank = (station: Station) => countOccupiedSlots(station) > 0;
  
  // Zähle eingelegte Powerbanks über alle Stationen
  const totalOccupiedUnits = stations.reduce((sum, station) => {
    return sum + countOccupiedSlots(station);
  }, 0);
  
  const totalAvailableUnits = totalCapacity - totalOccupiedUnits;
  
  // Durchschnittliche Batterie über alle belegten Slots
  const allBatteryPercentages: number[] = [];
  stations.forEach(station => {
    const totalSlots = station.total_units ?? 0;
    for (let i = 1; i <= totalSlots; i++) {
      if (isSlotOccupied(station, i)) {
        const data = getSlotData(station, i);
        if (data.percentage != null) allBatteryPercentages.push(data.percentage);
      }
    }
  });
  const averageBattery =
    allBatteryPercentages.length > 0
      ? Math.round(
          (allBatteryPercentages.reduce((sum, p) => sum + p, 0) / allBatteryPercentages.length) * 10
        ) / 10
      : null;
  const utilizationPercentage =
    totalCapacity > 0 ? Math.round((totalOccupiedUnits / totalCapacity) * 100) : 0;

  // Rentals im gewählten Zeitraum (Enddatum innerhalb der letzten N Tage)
  const rentalsInRange = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - statsTimeRangeDays);
    cutoff.setHours(0, 0, 0, 0);
    return ownerRentals.filter((r) => {
      const d = r.ended_at ? new Date(r.ended_at) : new Date(r.started_at);
      return d >= cutoff && r.status === "finished";
    });
  }, [ownerRentals, statsTimeRangeDays]);

  // Einnahmen-Statistiken aus Rentals (nur gewählter Zeitraum)
  const statsRevenue = useMemo(() => {
    const finished = rentalsInRange.filter((r) => r.total_price != null && r.total_price > 0);
    const total = finished.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
    const now = new Date();
    const thisMonth = finished.filter((r) => {
      const d = r.ended_at ? new Date(r.ended_at) : new Date(r.started_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = thisMonth.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
    const count = finished.length;
    const avg = count > 0 ? total / count : 0;
    const avgPerDay = statsTimeRangeDays > 0 && count > 0 ? total / statsTimeRangeDays : 0;
    return { total, monthTotal, count, avg, avgPerDay };
  }, [rentalsInRange, statsTimeRangeDays]);

  const revenueByDayData = useMemo(() => {
    const finished = rentalsInRange.filter((r) => r.total_price != null);
    const byDay: Record<string, number> = {};
    const days = statsTimeRangeDays;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    finished.forEach((r) => {
      const dateStr = (r.ended_at ? new Date(r.ended_at) : new Date(r.started_at)).toISOString().slice(0, 10);
      if (byDay[dateStr] !== undefined) byDay[dateStr] += r.total_price ?? 0;
    });
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date: date.slice(5), revenue: Math.round(value * 100) / 100 }));
  }, [rentalsInRange, statsTimeRangeDays]);

  const revenueByStationData = useMemo(() => {
    const finished = rentalsInRange.filter((r) => r.total_price != null);
    const byStation: Record<string, number> = {};
    finished.forEach((r) => {
      byStation[r.station_id] = (byStation[r.station_id] ?? 0) + (r.total_price ?? 0);
    });
    return Object.entries(byStation).map(([stationId, revenue]) => ({
      name: stations.find((s) => s.id === stationId)?.name ?? stationId.slice(0, 8),
      revenue: Math.round(revenue * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [rentalsInRange, stations]);

  const rentalsByDayData = useMemo(() => {
    const finished = rentalsInRange;
    const byDay: Record<string, number> = {};
    const days = statsTimeRangeDays;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    finished.forEach((r) => {
      const dateStr = (r.ended_at ? new Date(r.ended_at) : new Date(r.started_at)).toISOString().slice(0, 10);
      if (byDay[dateStr] !== undefined) byDay[dateStr] += 1;
    });
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: date.slice(5), anzahl: count }));
  }, [rentalsInRange, statsTimeRangeDays]);

  // Stations-Map für schnelle Lookups in Transaktionen
  const stationMap = useMemo(() => {
    const map = new Map<string, string>();
    stations.forEach((s) => { if (s.id) map.set(s.id, s.name); });
    return map;
  }, [stations]);

  // Transaktionen aus echten Rental-Daten mit Filtern
  const filteredRentals = useMemo(() => {
    let result = ownerRentals;
    if (txStatusFilter === 'active') {
      result = result.filter((r) => r.status === 'active' || !r.ended_at);
    } else if (txStatusFilter === 'completed') {
      result = result.filter((r) => r.status !== 'active' && !!r.ended_at);
    }
    if (txStationFilter !== 'all') {
      result = result.filter((r) => r.station_id === txStationFilter);
    }
    if (txSearchQuery.trim()) {
      const q = txSearchQuery.toLowerCase();
      result = result.filter((r) => {
        const name = stationMap.get(r.station_id ?? '') ?? '';
        return name.toLowerCase().includes(q) || (r.powerbank_id ?? '').toLowerCase().includes(q);
      });
    }
    return result;
  }, [ownerRentals, txStatusFilter, txStationFilter, txSearchQuery, stationMap]);

  const txTotalPages = Math.ceil(filteredRentals.length / txPageSize) || 1;
  const txPagedRentals = filteredRentals.slice((txPage - 1) * txPageSize, txPage * txPageSize);
  const txTotalRevenue = filteredRentals.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
  const txActiveCount = ownerRentals.filter((r) => r.status === 'active' || !r.ended_at).length;

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
    ? "mt-6 rounded-2xl"
    : "my-4 rounded-2xl";

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
          {/* Hamburger Button - nur auf Mobile */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`rounded-xl p-2 transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              aria-label="Menü öffnen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          {/* Rechte Seite des Headers - Design Toggle + Testdaten Switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Design Toggle */}
            <div className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-colors ${
              useNewDesign
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : isDarkMode
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-gray-100 border-gray-200'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useNewDesign}
                  onChange={() => setUseNewDesign(prev => !prev)}
                  className="sr-only"
                />
                <div className={`relative w-10 h-6 rounded-full transition-colors ${
                  useNewDesign ? 'bg-emerald-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    useNewDesign ? 'transform translate-x-4' : ''
                  }`} />
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${
                  useNewDesign
                    ? 'text-emerald-500'
                    : isDarkMode
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}>
                  {useNewDesign ? 'Neu' : 'V2'}
                </span>
              </label>
            </div>
            {/* Testdaten Switch */}
            <div className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-colors ${
              testDataEnabled
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : isDarkMode
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-gray-100 border-gray-200'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testDataEnabled}
                  onChange={toggleTestData}
                  className="sr-only"
                />
                <div className={`relative w-10 h-6 rounded-full transition-colors ${
                  testDataEnabled ? 'bg-yellow-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    testDataEnabled ? 'transform translate-x-4' : ''
                  }`} />
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${
                  testDataEnabled
                    ? 'text-yellow-500'
                    : isDarkMode
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}>
                  {testDataEnabled ? 'Testdaten' : 'Test'}
                </span>
              </label>
            </div>
            {testDataEnabled && (
              <span className={`text-xs px-2 py-1 rounded-full hidden sm:inline ${
                isDarkMode
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                Demo-Modus
              </span>
            )}
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : ''} min-h-0`}>
          {/* Mobile Backdrop */}
          {isMobile && (
            <div
              className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
                mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          {/* Tabs / Navigation */}
          <nav
            className={`flex shrink-0 gap-3 ${
              isMobile
                ? `fixed top-0 left-0 h-full z-50 w-72 flex-col px-3 py-5 overflow-y-auto overscroll-contain
                   transform transition-transform duration-300 ease-in-out
                   ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`
                : 'w-52 flex-col border-r px-2 py-3.5 h-full max-h-full overflow-y-auto min-h-0 overscroll-contain'
            } ${isDarkMode ? 'bg-[#171717] border-gray-800/70' : 'bg-white border-slate-200'}`}
          >
            {/* Schließen-Button nur auf Mobile */}
            {isMobile && (
              <div className="flex items-center justify-between mb-4">
                <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Navigation</p>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl p-2 transition-colors ${
                    isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  aria-label="Menü schließen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
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
                        onClick={() => { setActiveTab(tab.key); if (isMobile) setMobileMenuOpen(false); }}
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
              {testDataEnabled && (
                <div
                  className={`m-4 rounded-2xl border px-4 py-3 ${
                    isDarkMode
                      ? 'border-yellow-900/60 bg-yellow-900/10 text-yellow-300'
                      : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">Testdaten-Modus aktiv</p>
                      <p className="text-sm">Die angezeigten Daten sind simuliert und werden nicht in die Datenbank geschrieben. Alle 2 Sekunden werden neue Testdaten generiert.</p>
                    </div>
                    <button
                      onClick={toggleTestData}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                          : 'bg-yellow-200 text-yellow-700 hover:bg-yellow-300'
                      }`}
                    >
                      Deaktivieren
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div
                  className={`m-4 rounded-2xl border px-4 py-3 ${
                    isDarkMode
                      ? 'border-red-900/60 bg-red-900/10 text-red-300'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">Fehler beim Laden der Daten</p>
                      <p className="text-sm">{error}</p>
                      <details className="mt-3 text-xs opacity-80">
                        <summary className="cursor-pointer hover:opacity-100 font-medium">Fehlerbehebung anzeigen</summary>
                        <div className="mt-2 space-y-2">
                          <p>1. Öffne die Browser-Konsole (F12) und suche nach Fehlermeldungen</p>
                          <p>2. Prüfe ob du eingeloggt bist</p>
                          <p>3. Führe die SQL-Datei &quot;supabase_diagnose_stations.sql&quot; in Supabase aus</p>
                          <p>4. Siehe &quot;DASHBOARD_STATIONEN_FIX.md&quot; für Details</p>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              {/* ── V2 Design: alle Tabs ── */}
              {useNewDesign && (
                <OwnerDashboardV2Content
                  isDarkMode={isDarkMode}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  stations={stations}
                  filteredStations={filteredStations}
                  selectedStation={selectedStation}
                  selectedStationId={selectedStationId}
                  setSelectedStationId={setSelectedStationId}
                  showOnlyConnected={showOnlyConnected}
                  setShowOnlyConnected={setShowOnlyConnected}
                  loading={loading}
                  isStationConnected={isStationConnected}
                  countOccupiedSlots={countOccupiedSlots}
                  isSlotOccupied={isSlotOccupied}
                  getSlotData={getSlotData}
                  updateStation={updateStation}
                  deleteStation={deleteStation}
                  setShowAddStationForm={setShowAddStationForm}
                  updatingStation={updatingStation}
                  utilizationPercentage={utilizationPercentage}
                  totalOccupiedUnits={totalOccupiedUnits}
                  totalCapacity={totalCapacity}
                  totalAvailableUnits={totalAvailableUnits}
                  averageBattery={averageBattery}
                  connectedStationsCount={connectedStationsCount}
                  activeStationsCount={activeStationsCount}
                  inactiveStationsCount={inactiveStationsCount}
                  lastUpdate={lastUpdate}
                  realtimeActive={realtimeActive}
                  statsLoading={statsLoading}
                  statsRevenue={statsRevenue}
                  statsTimeRangeDays={statsTimeRangeDays}
                  setStatsTimeRangeDays={setStatsTimeRangeDays}
                  revenueByDayData={revenueByDayData}
                  rentalsByDayData={rentalsByDayData}
                  revenueByStationData={revenueByStationData}
                  ownerRentals={ownerRentals}
                  txActiveCount={txActiveCount}
                  txTotalRevenue={txTotalRevenue}
                  txPagedRentals={txPagedRentals}
                  txPage={txPage}
                  setTxPage={setTxPage}
                  txPageSize={txPageSize}
                  setTxPageSize={setTxPageSize}
                  txTotalPages={txTotalPages}
                  txStatusFilter={txStatusFilter}
                  setTxStatusFilter={setTxStatusFilter}
                  txSearchQuery={txSearchQuery}
                  setTxSearchQuery={setTxSearchQuery}
                  txStationFilter={txStationFilter}
                  setTxStationFilter={setTxStationFilter}
                  filteredRentals={filteredRentals}
                  stationMap={stationMap}
                  users={users}
                  usersLoading={usersLoading}
                  usersSearchQuery={usersSearchQuery}
                  usersPage={usersPage}
                  usersPageSize={usersPageSize}
                  usersTotalCount={usersTotalCount}
                  usersRoleFilter={usersRoleFilter}
                  fetchUsers={fetchUsers}
                  setUsersSearchQuery={setUsersSearchQuery}
                  setUsersPage={setUsersPage}
                  assignUserRole={assignUserRole}
                  renderStationPhotos={(station) => (
                    <PhotoManager
                      station={station}
                      onUpdate={(photos) => updateStation(station.id, { photos })}
                      isDarkMode={isDarkMode}
                    />
                  )}
                />
              )}

              {/* ── Altes Design ── */}
              {!useNewDesign && activeTab === 'overview' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* Live-Status Hinweis */}
                  {lastUpdate && (
                    <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${realtimeActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      Zuletzt aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}

                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 gap-3">

                    {/* Auslastung – Hauptkarte mit Akzentfarbe */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-emerald-50 border border-emerald-100'
                    }`}>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Auslastung</p>
                      <p className={`text-4xl font-bold mt-1.5 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {utilizationPercentage}<span className="text-xl font-medium">%</span>
                      </p>
                      <div className={`mt-3 h-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-emerald-200/60'}`}>
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${utilizationPercentage}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-2 ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-700/60'}`}>
                        {totalOccupiedUnits} von {totalCapacity} Slots belegt
                      </p>
                    </div>

                    {/* Stationen */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>Stationen</p>
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                          connectedStationsCount > 0
                            ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                            : isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {connectedStationsCount} online
                        </span>
                      </div>
                      <p className={`text-4xl font-bold mt-1.5 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stations.length}</p>
                      <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                        {activeStationsCount} aktiv · {inactiveStationsCount} inaktiv
                      </p>
                    </div>

                    {/* Powerbanks */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>Powerbanks drin</p>
                      <p className={`text-4xl font-bold mt-1.5 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalOccupiedUnits}</p>
                      <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{totalAvailableUnits} Slots frei</p>
                    </div>

                    {/* Ø Batterie */}
                    <div className={`rounded-2xl p-4 ${
                      averageBattery !== null && averageBattery < 30
                        ? isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
                        : isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <p className={`text-xs font-medium ${
                        averageBattery !== null && averageBattery < 30
                          ? isDarkMode ? 'text-red-400' : 'text-red-500'
                          : isDarkMode ? 'text-gray-400' : 'text-slate-400'
                      }`}>Ø Batterie</p>
                      <p className={`text-4xl font-bold mt-1.5 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {averageBattery !== null ? (
                          <>{averageBattery}<span className="text-xl font-medium">%</span></>
                        ) : '—'}
                      </p>
                      <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>über alle Stationen</p>
                    </div>
                  </div>

                  {/* Aktive Ausleihen Banner */}
                  {txActiveCount > 0 && (
                    <div className={`rounded-2xl p-3.5 flex items-center gap-3 ${
                      isDarkMode ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-sky-50 border border-sky-100'
                    }`}>
                      <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                        isDarkMode ? 'bg-sky-500/20' : 'bg-sky-100'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                          <polyline points="13 17 18 12 13 7" /><line x1="6" y1="12" x2="18" y2="12" />
                        </svg>
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                          {txActiveCount} aktive Ausleihe{txActiveCount !== 1 ? 'n' : ''}
                        </p>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-sky-400/60' : 'text-sky-600/70'}`}>Gerade in Benutzung</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className={`shrink-0 text-xs font-medium ${isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700'} transition-colors`}
                      >
                        Details →
                      </button>
                    </div>
                  )}

                  {/* Stationen Liste */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Stationen
                      </h3>
                      <button
                        onClick={() => setActiveTab('stations')}
                        className={`text-xs font-medium transition-colors ${
                          isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        Alle anzeigen →
                      </button>
                    </div>

                    {stations.length === 0 ? (
                      <div className={`rounded-2xl border p-6 text-center ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          Noch keine Stationen – lege deine erste an.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stations.slice(0, 5).map((station) => {
                          const occupied = countOccupiedSlots(station);
                          const total = station.total_units ?? 0;
                          const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                          const connected = isStationConnected(station);
                          const battPercentages: number[] = [];
                          for (let i = 1; i <= total; i++) {
                            if (isSlotOccupied(station, i)) {
                              const d = getSlotData(station, i);
                              if (d.percentage != null) battPercentages.push(d.percentage);
                            }
                          }
                          const avgBatt = battPercentages.length > 0
                            ? Math.round(battPercentages.reduce((a, b) => a + b, 0) / battPercentages.length)
                            : null;
                          return (
                            <div
                              key={station.id}
                              className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                                isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                              }`}
                            >
                              <span className={`shrink-0 w-2 h-2 rounded-full ${
                                connected ? 'bg-emerald-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {station.name}
                                  </p>
                                  {!station.is_active && (
                                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-md ${
                                      isDarkMode ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-500'
                                    }`}>Aus</span>
                                  )}
                                </div>
                                <div className={`mt-1.5 h-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                                  <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className={`text-sm font-medium tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {occupied}/{total}
                                </p>
                                {avgBatt !== null && (
                                  <p className={`text-xs tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>{avgBatt}%</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {!useNewDesign && activeTab === 'stats' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {stations.length === 0 ? (
                    <div className={`rounded-2xl border p-6 text-center text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      Keine Statistiken verfügbar. Bitte füge Stationen hinzu.
                    </div>
                  ) : (
                    <>
                      {/* Zeitraum-Segmented-Control */}
                      <div className={`inline-flex rounded-xl p-1 gap-1 ${isDarkMode ? 'bg-white/8' : 'bg-slate-100'}`}>
                        {([7, 14, 30, 90] as const).map((days) => (
                          <button
                            key={days}
                            onClick={() => setStatsTimeRangeDays(days)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              statsTimeRangeDays === days
                                ? isDarkMode
                                  ? 'bg-white/15 text-white shadow-sm'
                                  : 'bg-white text-slate-900 shadow-sm'
                                : isDarkMode
                                  ? 'text-gray-400 hover:text-gray-300'
                                  : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {days === 7 ? '7T' : days === 14 ? '14T' : days === 30 ? '30T' : '90T'}
                          </button>
                        ))}
                      </div>

                      {/* Hero-Metrik: Gesamteinnahmen */}
                      <div className={`rounded-2xl p-5 ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                        <p className={`text-xs font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Einnahmen – letzte {statsTimeRangeDays} Tage
                        </p>
                        <p className={`text-5xl font-bold mt-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {statsLoading ? <span className="opacity-30">…</span> : `${statsRevenue.total.toFixed(2)} €`}
                        </p>
                        <div className={`mt-4 pt-4 border-t flex gap-6 ${isDarkMode ? 'border-emerald-500/20' : 'border-emerald-200/60'}`}>
                          <div>
                            <p className={`text-xs ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-700/60'}`}>Ø pro Tag</p>
                            <p className={`text-lg font-semibold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {statsLoading ? '…' : `${statsRevenue.avgPerDay.toFixed(2)} €`}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-700/60'}`}>Ausleihen</p>
                            <p className={`text-lg font-semibold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {statsLoading ? '…' : statsRevenue.count}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-700/60'}`}>Ø pro Ausleihe</p>
                            <p className={`text-lg font-semibold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {statsLoading ? '…' : statsRevenue.count > 0 ? `${statsRevenue.avg.toFixed(2)} €` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Chart: Einnahmen im Zeitverlauf */}
                      <div>
                        <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          Einnahmen pro Tag
                        </h3>
                        <div className={`rounded-2xl p-4 ${isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'}`}>
                          {revenueByDayData.some((d) => d.revenue > 0) ? (
                            <div className="h-[200px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueByDayData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke={isDarkMode ? '#6b7280' : '#94a3b8'} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 10 }} stroke={isDarkMode ? '#6b7280' : '#94a3b8'} tickFormatter={(v) => `${v}€`} tickLine={false} axisLine={false} />
                                  <Tooltip
                                    contentStyle={{
                                      borderRadius: '10px',
                                      border: 'none',
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                                      color: isDarkMode ? '#f9fafb' : '#0f172a',
                                      fontSize: 12,
                                    }}
                                    formatter={(value: number | undefined) => [`${value != null ? value.toFixed(2) : '0'} €`, 'Einnahmen']}
                                    labelFormatter={(label) => label}
                                  />
                                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className={`h-[200px] flex items-center justify-center rounded-xl ${isDarkMode ? 'bg-black/10' : 'bg-slate-50'}`}>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Keine Einnahmen im gewählten Zeitraum</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chart: Ausleihen pro Tag */}
                      <div>
                        <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          Ausleihen pro Tag
                        </h3>
                        <div className={`rounded-2xl p-4 ${isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'}`}>
                          {rentalsByDayData.some((d) => d.anzahl > 0) ? (
                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rentalsByDayData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke={isDarkMode ? '#6b7280' : '#94a3b8'} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 10 }} stroke={isDarkMode ? '#6b7280' : '#94a3b8'} allowDecimals={false} tickLine={false} axisLine={false} />
                                  <Tooltip
                                    contentStyle={{
                                      borderRadius: '10px',
                                      border: 'none',
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                                      color: isDarkMode ? '#f9fafb' : '#0f172a',
                                      fontSize: 12,
                                    }}
                                    formatter={(value) => [value ?? 0, 'Ausleihen']}
                                    labelFormatter={(label) => label}
                                  />
                                  <Bar dataKey="anzahl" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={32} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className={`h-[180px] flex items-center justify-center rounded-xl ${isDarkMode ? 'bg-black/10' : 'bg-slate-50'}`}>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Keine Ausleihen im gewählten Zeitraum</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Einnahmen pro Station */}
                      {revenueByStationData.length > 0 && (
                        <div>
                          <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Einnahmen pro Station
                          </h3>
                          <div className="space-y-2">
                            {revenueByStationData.map((entry, idx) => {
                              const max = revenueByStationData[0]?.revenue ?? 1;
                              const pct = max > 0 ? Math.round((entry.revenue / max) * 100) : 0;
                              return (
                                <div
                                  key={idx}
                                  className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                                    isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.name}</p>
                                    <div className={`mt-1.5 h-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                                      <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {entry.revenue.toFixed(2)} €
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Letzte Ausleihen */}
                      {ownerRentals.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Letzte Ausleihen</h3>
                            <button
                              onClick={() => setActiveTab('transactions')}
                              className={`text-xs font-medium transition-colors ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                              Alle anzeigen →
                            </button>
                          </div>
                          <div className="space-y-2">
                            {ownerRentals.slice(0, 5).map((rental) => {
                              const stationName = stations.find((s) => s.id === rental.station_id)?.name ?? 'Unbekannte Station';
                              const date = new Date(rental.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                              const isActive = rental.status === 'active' || !rental.ended_at;
                              return (
                                <div
                                  key={rental.id}
                                  className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                                    isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                                  }`}
                                >
                                  <span className={`shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-sky-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stationName}</p>
                                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                      {date}{rental.powerbank_id ? ` · ${rental.powerbank_id}` : ''}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {rental.total_price != null ? (
                                      <p className={`text-sm font-semibold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {rental.total_price.toFixed(2)} €
                                      </p>
                                    ) : (
                                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                                        aktiv
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!useNewDesign && activeTab === 'stations' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className={`flex items-center gap-1.5 text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stations.length}</span> Stationen
                    <span className="opacity-40">·</span>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${connectedStationsCount > 0 ? 'bg-emerald-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                    {connectedStationsCount} online
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOnlyConnected(!showOnlyConnected)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        showOnlyConnected
                          ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                          : isDarkMode ? 'bg-white/8 text-gray-400 hover:text-gray-300' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {showOnlyConnected ? 'Alle anzeigen' : 'Nur online'}
                    </button>
                    <button
                      onClick={() => setShowAddStationForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Station
                    </button>
                  </div>
                </div>

                {/* Station-Auswahl als Pill-Liste */}
                {filteredStations.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {filteredStations.map((station) => {
                      const connected = isStationConnected(station);
                      const isSelected = selectedStationId === station.id;
                      return (
                        <button
                          key={station.id}
                          onClick={() => setSelectedStationId(station.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            isSelected
                              ? isDarkMode
                                ? 'bg-white/15 text-white border border-white/20'
                                : 'bg-slate-900 text-white border border-transparent'
                              : isDarkMode
                                ? 'bg-white/5 text-gray-300 border border-white/8 hover:bg-white/10'
                                : 'bg-white text-slate-700 border border-slate-100 shadow-sm hover:border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            connected ? 'bg-emerald-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                          }`} />
                          {station.name}
                          {station.short_code && (
                            <span className={`text-xs opacity-50`}>{station.short_code}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Station Details */}
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                  </div>
                ) : !selectedStation ? (
                  <div className={`rounded-2xl border p-10 flex flex-col items-center justify-center text-center ${
                    isDarkMode ? 'bg-white/5 border-white/8' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {filteredStations.length === 0
                        ? (showOnlyConnected ? 'Keine online-Stationen' : 'Noch keine Stationen')
                        : 'Station auswählen'}
                    </p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      {filteredStations.length === 0
                        ? (showOnlyConnected ? 'Schalte den Filter aus oder starte eine Station.' : 'Erstelle deine erste Station.')
                        : 'Wähle oben eine Station aus.'}
                    </p>
                    {filteredStations.length === 0 && !showOnlyConnected && !loading && (
                      <div className={`mt-4 px-4 py-3 rounded-xl text-xs text-left ${
                        isDarkMode ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        Keine Stationen gefunden? Prüfe die Browser-Konsole (F12).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* Station-Header */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {selectedStation.name}
                            </h4>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${
                              isStationConnected(selectedStation)
                                ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                : isDarkMode ? 'bg-white/8 text-gray-400' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isStationConnected(selectedStation) ? 'bg-emerald-500 animate-pulse' : isDarkMode ? 'bg-gray-500' : 'bg-gray-300'
                              }`} />
                              {isStationConnected(selectedStation) ? 'Online' : 'Offline'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              selectedStation.is_active
                                ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                : isDarkMode ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-500'
                            }`}>
                              {selectedStation.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                          <div className={`flex items-center gap-3 mt-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                            {selectedStation.short_code && (
                              <span>Code: <span className={`font-mono font-semibold ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>{selectedStation.short_code}</span></span>
                            )}
                            <span className="font-mono opacity-60 truncate">{selectedStation.id}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updateStation(selectedStation.id, { is_active: !selectedStation.is_active })}
                          disabled={updatingStation === selectedStation.id}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            updatingStation === selectedStation.id ? 'opacity-50 cursor-not-allowed' : ''
                          } ${
                            selectedStation.is_active
                              ? isDarkMode ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-500 hover:bg-red-100'
                              : isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {updatingStation === selectedStation.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                              …
                            </span>
                          ) : (
                            selectedStation.is_active ? 'Deaktivieren' : 'Aktivieren'
                          )}
                        </button>
                      </div>

                      {/* Kapazitäts-Schnellinfo */}
                      <div className={`mt-4 pt-4 border-t flex items-center gap-6 ${isDarkMode ? 'border-white/8' : 'border-slate-100'}`}>
                        <div>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Eingelegt</p>
                          <p className={`text-xl font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {countOccupiedSlots(selectedStation)}<span className={`text-sm font-normal ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>/ {selectedStation.total_units ?? 0}</span>
                          </p>
                        </div>
                        <div className="flex-1">
                          <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{
                                width: `${selectedStation.total_units ? Math.round((countOccupiedSlots(selectedStation) / selectedStation.total_units) * 100) : 0}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0">
                          <label className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Slots max.</label>
                          <input
                            type="number"
                            min="1"
                            max="32"
                            value={selectedStation.total_units ?? 8}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 1;
                              updateStation(selectedStation.id, { total_units: newValue });
                            }}
                            className={`block w-16 mt-0.5 px-2 py-1 rounded-lg border text-sm font-semibold text-center ${
                              isDarkMode
                                ? 'bg-white/10 border-white/15 text-white focus:border-emerald-500'
                                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                            } focus:outline-none focus:ring-1 focus:ring-emerald-500/20`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Slot-Karten Grid */}
                    <div>
                      <h5 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Slots
                      </h5>
                      {selectedStation.total_units && selectedStation.total_units > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {Array.from({ length: selectedStation.total_units }, (_, index) => {
                            const slotNumber = index + 1;
                            const occupied = isSlotOccupied(selectedStation, slotNumber);
                            const slotData = getSlotData(selectedStation, slotNumber);
                            const pct = slotData.percentage;
                            const battColor = pct == null ? null : pct < 20 ? 'red' : pct < 50 ? 'yellow' : 'green';
                            return (
                              <div
                                key={slotNumber}
                                className={`rounded-xl p-3 transition-colors ${
                                  occupied
                                    ? isDarkMode
                                      ? 'bg-white/8 border border-white/12'
                                      : 'bg-white border border-slate-100 shadow-sm'
                                    : isDarkMode
                                      ? 'bg-white/3 border border-white/6'
                                      : 'bg-slate-50 border border-slate-100'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>
                                    Slot {slotNumber}
                                  </span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    occupied
                                      ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                      : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                  }`} />
                                </div>
                                {occupied ? (
                                  <>
                                    {pct != null && (
                                      <>
                                        <div className={`h-1 rounded-full mb-1.5 ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              battColor === 'red' ? 'bg-red-500' :
                                              battColor === 'yellow' ? 'bg-yellow-400' :
                                              'bg-emerald-500'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <p className={`text-sm font-semibold tabular-nums ${
                                          battColor === 'red' ? 'text-red-500' :
                                          battColor === 'yellow' ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600' :
                                          isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                                        }`}>{pct}%</p>
                                      </>
                                    )}
                                    {slotData.voltage != null && (
                                      <p className={`text-xs mt-0.5 tabular-nums ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {slotData.voltage.toFixed(2)} V
                                      </p>
                                    )}
                                    {slotData.powerbankId && (
                                      <p className={`text-xs font-mono mt-1 truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {slotData.powerbankId}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-600' : 'text-slate-300'}`}>Leer</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={`rounded-xl p-4 text-center text-sm ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-50 text-slate-400'}`}>
                          Keine Slots konfiguriert – Kapazität oben einstellen.
                        </div>
                      )}
                    </div>

                    {/* Foto-Verwaltung */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Fotos <span className={`font-normal text-xs ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>max. 3</span>
                      </h5>
                      <PhotoManager
                        station={selectedStation}
                        onUpdate={(photos) => updateStation(selectedStation.id, { photos })}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Öffnungszeiten */}
                    <div className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Öffnungszeiten
                      </h5>
                      <textarea
                        value={selectedStation.opening_hours || ''}
                        onChange={(e) => updateStation(selectedStation.id, { opening_hours: e.target.value })}
                        placeholder="z.B. Mo–Fr: 8:00–18:00, Sa: 9:00–16:00, So: geschlossen"
                        rows={3}
                        className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${
                          isDarkMode
                            ? 'bg-white/8 border-white/12 text-white placeholder-gray-600 focus:border-emerald-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:border-emerald-500'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500/15`}
                      />
                    </div>

                    {/* Aktionen */}
                    <div className={`rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap ${
                      isDarkMode ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-100 shadow-sm'
                    }`}>
                      <button
                        onClick={() => updateStation(selectedStation.id, { charge_enabled: !(selectedStation.charge_enabled ?? true) })}
                        disabled={updatingStation === selectedStation.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          updatingStation === selectedStation.id ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          (selectedStation.charge_enabled ?? true)
                            ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : isDarkMode ? 'bg-white/8 text-gray-400 hover:bg-white/12' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {updatingStation === selectedStation.id ? (
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                        )}
                        Laden {(selectedStation.charge_enabled ?? true) ? 'EIN' : 'AUS'}
                      </button>
                      <button
                        onClick={() => deleteStation(selectedStation.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        Station löschen
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>
            )}

          {!useNewDesign && activeTab === 'transactions' && (
            <div className="h-full flex flex-col">
              {/* Header + Statistiken */}
              <div className={`${sectionHeaderWrapper} p-4 border ${sectionHeaderClasses}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Transaktionen
                        {filteredRentals.length > 0 && (
                          <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            ({filteredRentals.length} {filteredRentals.length === 1 ? 'Eintrag' : 'Einträge'})
                          </span>
                        )}
                      </h3>
                    </div>
                    {/* Statistik-Pills */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        <span className="font-semibold">{txTotalRevenue.toFixed(2)} €</span>
                        <span className={isDarkMode ? 'text-emerald-500/60' : 'text-emerald-600/60'}>Umsatz</span>
                      </div>
                      {txActiveCount > 0 && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDarkMode ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>
                          <span className="font-semibold">{txActiveCount}</span>
                          <span className={isDarkMode ? 'text-yellow-500/60' : 'text-yellow-600/60'}>Aktiv</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Filter-Zeile */}
                  <div className={`flex flex-wrap items-center gap-2 border-t pt-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    {/* Suche */}
                    <div className="relative min-w-[160px] flex-1 sm:flex-initial">
                      <input
                        type="search"
                        value={txSearchQuery}
                        onChange={(e) => { setTxSearchQuery(e.target.value); setTxPage(1); }}
                        placeholder="Station / Powerbank…"
                        className={`w-full sm:w-48 px-3 py-1.5 pl-8 rounded-lg border text-sm ${
                          isDarkMode
                            ? 'bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-emerald-500'
                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                      />
                      <svg className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>

                    {/* Status-Filter */}
                    <div className="flex gap-1">
                      {(['all', 'active', 'completed'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setTxStatusFilter(s); setTxPage(1); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            txStatusFilter === s
                              ? 'bg-emerald-600 text-white'
                              : isDarkMode ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s === 'all' ? 'Alle' : s === 'active' ? 'Aktiv' : 'Abgeschlossen'}
                        </button>
                      ))}
                    </div>

                    {/* Station-Filter */}
                    {stations.length > 1 && (
                      <select
                        value={txStationFilter}
                        onChange={(e) => { setTxStationFilter(e.target.value); setTxPage(1); }}
                        className={`px-2 py-1.5 rounded-lg border text-xs ${
                          isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="all">Alle Stationen</option>
                        {stations.map((s) => s.id && (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}

                    {/* Pagination rechts */}
                    <div className="flex items-center gap-1 ml-auto">
                      <select
                        value={txPageSize}
                        onChange={(e) => { setTxPageSize(Number(e.target.value)); setTxPage(1); }}
                        className={`px-2 py-1.5 rounded-lg border text-xs ${
                          isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage <= 1}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                        aria-label="Vorherige Seite"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                      <span className={`text-xs min-w-[70px] text-center ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        {txPage} / {txTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                        disabled={txPage >= txTotalPages}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                        aria-label="Nächste Seite"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liste */}
              <div className="flex-1 overflow-y-auto p-4">
                {statsLoading ? (
                  <div className="flex items-center justify-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
                  </div>
                ) : txPagedRentals.length === 0 ? (
                  <div className={`rounded-xl border p-8 text-center ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {ownerRentals.length === 0
                      ? 'Noch keine Transaktionen vorhanden.'
                      : 'Keine Transaktionen entsprechen dem Filter.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {txPagedRentals.map((rental) => {
                      const stationName = stationMap.get(rental.station_id ?? '') ?? rental.station_id ?? '–';
                      const isActive = rental.status === 'active' || !rental.ended_at;
                      const startedAt = new Date(rental.started_at);
                      const endedAt = rental.ended_at ? new Date(rental.ended_at) : null;
                      const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : Date.now() - startedAt.getTime();
                      const durationMin = Math.floor(durationMs / 60000);
                      const durationStr = durationMin < 60
                        ? `${durationMin} Min`
                        : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
                      return (
                        <div
                          key={rental.id}
                          className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
                            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Status-Indikator */}
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${
                              isActive
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`} />
                              {isActive ? 'Aktiv' : 'Fertig'}
                            </span>
                          </div>

                          {/* Hauptinfo */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {stationName}
                            </p>
                            {rental.powerbank_id && (
                              <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                PB: {rental.powerbank_id.slice(0, 8)}…
                              </p>
                            )}
                          </div>

                          {/* Zeit */}
                          <div className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            <div>{startedAt.toLocaleDateString('de-DE')} {startedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div>{isActive ? <span className="text-yellow-500">läuft seit {durationStr}</span> : durationStr}</div>
                          </div>

                          {/* Betrag */}
                          <div className={`text-sm font-semibold flex-shrink-0 min-w-[60px] text-right ${
                            rental.total_price != null
                              ? isDarkMode ? 'text-white' : 'text-slate-900'
                              : isDarkMode ? 'text-gray-500' : 'text-slate-400'
                          }`}>
                            {rental.total_price != null ? `${rental.total_price.toFixed(2)} €` : '–'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {!useNewDesign && activeTab === 'users' && (
            <div className="h-full flex flex-col">
              {/* Header + Filter */}
              <div className={`${sectionHeaderWrapper} p-4 border ${sectionHeaderClasses}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Benutzer
                      {usersTotalCount != null && (
                        <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          ({usersTotalCount} {usersTotalCount === 1 ? 'Eintrag' : 'Einträge'})
                        </span>
                      )}
                    </h3>

                    {/* Live-Suche */}
                    <div className="relative flex-1 sm:flex-initial min-w-[200px] sm:max-w-xs">
                      <input
                        type="search"
                        value={usersSearchQuery}
                        onChange={(e) => {
                          setUsersSearchQuery(e.target.value);
                          setUsersPage(1);
                          fetchUsers({ search: e.target.value, page: 1 });
                        }}
                        placeholder="E-Mail durchsuchen…"
                        className={`w-full px-3 py-1.5 pl-8 rounded-lg border text-sm ${
                          isDarkMode
                            ? 'bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-emerald-500'
                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                      />
                      <svg className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                  </div>

                  {/* Rolle-Filter + Pagination */}
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    {/* Rolle-Filter Chips */}
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'user', 'admin', 'owner'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => fetchUsers({ role: r, page: 1 })}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            usersRoleFilter === r
                              ? r === 'owner'
                                ? 'bg-purple-600 text-white'
                                : r === 'admin'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-emerald-600 text-white'
                              : isDarkMode ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {r === 'all' ? 'Alle' : r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={usersPageSize}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          fetchUsers({ pageSize: v, page: 1 });
                        }}
                        className={`px-2 py-1 rounded-lg border text-xs ${
                          isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      {usersTotalCount != null && (
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          {(usersPage - 1) * usersPageSize + 1}–{Math.min(usersPage * usersPageSize, usersTotalCount)} / {usersTotalCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => fetchUsers({ page: usersPage - 1 })}
                        disabled={usersLoading || usersPage <= 1}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                        aria-label="Vorherige Seite"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                      <span className={`text-xs min-w-[50px] text-center ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        {usersPage} / {usersTotalCount != null ? Math.ceil(usersTotalCount / usersPageSize) || 1 : '?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => fetchUsers({ page: usersPage + 1 })}
                        disabled={usersLoading || (usersTotalCount != null && usersPage * usersPageSize >= usersTotalCount)}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                        aria-label="Nächste Seite"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabelle */}
              <div className="flex-1 overflow-y-auto">
                {usersLoading ? (
                  <div className="flex items-center justify-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
                  </div>
                ) : users.length === 0 ? (
                  <div className={`m-4 rounded-xl border p-8 text-center ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {usersSearchQuery.trim() || usersRoleFilter !== 'all'
                      ? 'Keine Benutzer entsprechen dem Filter.'
                      : 'Noch keine Benutzer vorhanden.'}
                  </div>
                ) : (
                  <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    {/* Tabellen-Header */}
                    <div className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      <span>Avatar</span>
                      <span>E-Mail</span>
                      <span className="hidden sm:block">Registriert</span>
                      <span>Rolle &amp; Aktion</span>
                    </div>
                    <div className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                      {users.map((user) => {
                        const initials = (user.email || '?').slice(0, 2).toUpperCase();
                        const avatarColor = user.role === 'owner'
                          ? isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                          : user.role === 'admin'
                            ? isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700';
                        return (
                          <div
                            key={user.user_id}
                            className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-4 px-4 py-2.5 transition-colors ${
                              isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                              {initials}
                            </div>

                            {/* E-Mail + Datum (mobil) */}
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {user.email}
                              </p>
                              <p className={`text-xs sm:hidden ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                {new Date(user.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>

                            {/* Datum (Desktop) */}
                            <span className={`hidden sm:block text-xs flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                              {new Date(user.created_at).toLocaleDateString('de-DE')}
                            </span>

                            {/* Rolle + Aktionen */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                user.role === 'owner'
                                  ? isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                                  : user.role === 'admin'
                                    ? isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                    : isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {user.role}
                              </span>
                              {user.role !== 'owner' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => assignUserRole(user.user_id, 'owner')}
                                    title="Zu Owner befördern"
                                    className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' : 'hover:bg-purple-100 text-purple-600'}`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                  </button>
                                  {user.role !== 'user' && (
                                    <button
                                      onClick={() => assignUserRole(user.user_id, 'user')}
                                      title="Zu User zurücksetzen"
                                      className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-200 text-slate-500'}`}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

          {!useNewDesign && activeTab === 'analytics' && (
            <AnalyticsDashboard isDarkMode={isDarkMode} />
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
