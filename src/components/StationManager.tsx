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
  created_at?: string;
  updated_at?: string;
  photo_url?: string;
  rental_cost?: number; // Kosten pro Stunde in Euro
  powerbanks?: Powerbank[]; // Liste der Powerbanks an dieser Station
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
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const result = data || [];
      setStations(result);
      onStationsUpdate(result);
      return result;
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
