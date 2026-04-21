"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Powerbank {
  id: string;
  name: string;
  battery_level: number; // 0-100
  status: 'available' | 'rented' | 'charging' | 'maintenance';
}

export interface Station {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  available_units?: number;
  total_units?: number;
  address?: string;
  owner_id?: string;
  is_active: boolean;
  short_code?: string; // 4-stelliger Code für manuelle Eingabe
  created_at?: string;
  updated_at?: string; // Letzter Kontakt mit ESP32 (aktualisiert bei jedem ESP32-Update)
  photo_url?: string; // Legacy: wird für Rückwärtskompatibilität beibehalten
  photos?: string[]; // Array von bis zu 3 Foto-URLs
  rental_cost?: number; // Kosten pro Stunde in Euro
  powerbanks?: Powerbank[]; // Liste der Powerbanks an dieser Station
  battery_voltage?: number; // Batteriespannung in Volt (bester Slot)
  battery_percentage?: number; // Batterieprozente (0-100, bester Slot)
  powerbank_id?: string | null; // Eindeutige ID der aktuell erkannten Powerbank (bester Slot)
  // Dual-Slot Daten
  slot_1_powerbank_id?: string | null;
  slot_1_battery_voltage?: number | null;
  slot_1_battery_percentage?: number | null;
  slot_2_powerbank_id?: string | null;
  slot_2_battery_voltage?: number | null;
  slot_2_battery_percentage?: number | null;
  charge_enabled?: boolean; // Relais-Steuerung: Laden aktiviert/deaktiviert
  opening_hours?: string; // Öffnungszeiten (z.B. "Mo-Fr: 8:00-18:00, Sa: 9:00-16:00")
  last_seen?: string; // Letzter Heartbeat vom ESP32 (ISO-Zeitstempel)
}

/**
 * Prüft, ob eine Station aktuell online/verbunden ist.
 * Eine Station gilt als online, wenn last_seen weniger als 60 Sekunden alt ist.
 */
export function isStationOnline(station: { last_seen?: string | null; updated_at?: string | null }): boolean {
  const timestamp = station.last_seen ?? station.updated_at;
  if (!timestamp) return false;
  const lastSeenDate = new Date(timestamp);
  const now = new Date();
  const diffSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000;
  return diffSeconds < 60;
}

export type StationSlotShape = {
  powerbank_id?: string | null;
  battery_voltage?: number | null;
  battery_percentage?: number | null;
  slot_1_powerbank_id?: string | null;
  slot_1_battery_voltage?: number | null;
  slot_1_battery_percentage?: number | null;
  slot_2_powerbank_id?: string | null;
  slot_2_battery_voltage?: number | null;
  slot_2_battery_percentage?: number | null;
  last_seen?: string | null;
  updated_at?: string | null;
};

function slotHasEepromId(id: unknown): boolean {
  return typeof id === 'string' && id.trim().length > 0;
}

function slotHasBattery(voltage: unknown, percentage: unknown): boolean {
  return voltage != null && percentage != null;
}

/**
 * Zählt, wie viele Slots aktuell physisch eine Powerbank haben (unabhängig von EEPROM).
 * Genutzt für Pickup-Detektion: wir wollen wissen, ob SICH der Bestand verringert hat,
 * auch wenn die entnommene Powerbank keinen lesbaren EEPROM hatte.
 */
export function countPhysicallyPresentSlots(station: StationSlotShape): number {
  let count = 0;
  const slot1Present =
    slotHasEepromId(station.slot_1_powerbank_id) ||
    slotHasBattery(station.slot_1_battery_voltage, station.slot_1_battery_percentage);
  if (slot1Present) count++;
  const slot2Present =
    slotHasEepromId(station.slot_2_powerbank_id) ||
    slotHasBattery(station.slot_2_battery_voltage, station.slot_2_battery_percentage);
  if (slot2Present) count++;

  if (count === 0) {
    const legacyPresent =
      slotHasEepromId(station.powerbank_id) ||
      slotHasBattery(station.battery_voltage, station.battery_percentage);
    if (legacyPresent) count = 1;
  }
  return count;
}

/**
 * Berechnet die tatsächlich AUSLEIHBAREN Powerbanks (mit lesbarer EEPROM-ID).
 * Powerbanks ohne lesbare EEPROM-ID werden nicht als verfügbar gezählt,
 * damit nur verifizierte Powerbanks ausgeliehen werden können.
 * Gibt 0 zurück, wenn die Station offline ist.
 */
export function computeRealAvailability(station: StationSlotShape): number {
  if (!isStationOnline(station)) return 0;

  let count = 0;

  // Per-Slot: nur Slots mit lesbarer EEPROM-ID zählen
  if (slotHasEepromId(station.slot_1_powerbank_id)) count++;
  if (slotHasEepromId(station.slot_2_powerbank_id)) count++;

  // Legacy-Fallback nur für Stationen ohne Per-Slot-Daten:
  // Wenn weder slot_1_* noch slot_2_* irgendeinen Wert haben, verlasse dich auf powerbank_id.
  const hasAnyPerSlotData =
    station.slot_1_powerbank_id != null ||
    station.slot_1_battery_voltage != null ||
    station.slot_1_battery_percentage != null ||
    station.slot_2_powerbank_id != null ||
    station.slot_2_battery_voltage != null ||
    station.slot_2_battery_percentage != null;

  if (!hasAnyPerSlotData && count === 0) {
    if (slotHasEepromId(station.powerbank_id)) count = 1;
  }

  return count;
}

interface StationManagerProps {
  onStationsUpdate: (stations: Station[]) => void;
  isDarkMode: boolean;
}

export default function StationManager({ onStationsUpdate, isDarkMode }: StationManagerProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lade Stationen aus der Datenbank
  const fetchStations = async (): Promise<Station[]> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, description, lat, lng, available_units, total_units, address, owner_id, is_active, short_code, created_at, updated_at, photos, battery_voltage, battery_percentage, powerbank_id, slot_1_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage, slot_2_powerbank_id, slot_2_battery_voltage, slot_2_battery_percentage, charge_enabled, opening_hours, last_seen')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const result = data || [];
      // Stelle sicher, dass photos als Array geparst wird, falls es ein JSON-String ist
      const processedResult = result.map((station: any) => {
        if (station.photos && typeof station.photos === 'string') {
          try {
            station.photos = JSON.parse(station.photos);
          } catch (e) {
            console.warn('Fehler beim Parsen von photos:', e);
            station.photos = [];
          }
        }
        return station;
      });
      setStations(processedResult);
      onStationsUpdate(processedResult);
      return processedResult;
    } catch (err) {
      console.error('Fehler beim Laden der Stationen:', err);
      setError('Fehler beim Laden der Stationen');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Füge eine neue Station hinzu
  const addStation = async (stationData: Omit<Station, 'id' | 'created_at'>) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('stations')
        .insert([stationData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Aktualisiere die lokale Liste
      setStations(prev => {
        const updated = [data, ...prev];
        onStationsUpdate(updated);
        return updated;
      });
      
      return data;
    } catch (err) {
      console.error('Fehler beim Hinzufügen der Station:', err);
      setError('Fehler beim Hinzufügen der Station');
      throw err;
    }
  };

  // Aktualisiere eine Station
  const updateStation = async (id: string, updates: Partial<Station>) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('stations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Aktualisiere die lokale Liste
      setStations(prev => {
        const updated = prev.map(station => station.id === id ? data : station);
        onStationsUpdate(updated);
        return updated;
      });
      
      return data;
    } catch (err) {
      console.error('Fehler beim Aktualisieren der Station:', err);
      setError('Fehler beim Aktualisieren der Station');
      throw err;
    }
  };

  // Lösche eine Station (deaktiviere sie)
  const deleteStation = async (id: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('stations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Entferne aus der lokalen Liste
      setStations(prev => {
        const updated = prev.filter(station => station.id !== id);
        onStationsUpdate(updated);
        return updated;
      });
    } catch (err) {
      console.error('Fehler beim Löschen der Station:', err);
      setError('Fehler beim Löschen der Station');
      throw err;
    }
  };

  // Lade Stationen beim ersten Laden
  useEffect(() => {
    fetchStations();
  }, []);

  return {
    stations,
    loading,
    error,
    addStation,
    updateStation,
    deleteStation,
    refreshStations: fetchStations
  };
}
