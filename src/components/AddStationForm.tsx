"use client";

import { useState } from "react";
import { Station } from "./StationManager";

interface AddStationFormProps {
  onClose: () => void;
  onSubmit: (stationData: Omit<Station, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  isDarkMode: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

export default function AddStationForm({ onClose, onSubmit, isDarkMode, userLocation }: AddStationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lat: userLocation?.lat || 52.52,
    lng: userLocation?.lng || 13.405,
    available_units: 0,
    total_units: 0,
    address: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      console.error('Fehler beim Hinzufügen der Station:', err);
      setError((err as Error)?.message || 'Fehler beim Hinzufügen der Station. Bitte überprüfen Sie Ihre Berechtigung.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl shadow-xl ${
        isDarkMode 
          ? 'bg-gray-800 text-white' 
          : 'bg-white text-slate-900'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Neue Station hinzufügen</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full hover:bg-opacity-20 ${
                isDarkMode 
                  ? 'hover:bg-white' 
                  : 'hover:bg-slate-900'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                    : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                placeholder="z.B. Hauptbahnhof"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Beschreibung
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                    : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                placeholder="Optionale Beschreibung"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-2">
                Adresse
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                    : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                placeholder="z.B. Europaplatz 1, 10557 Berlin"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lat" className="block text-sm font-medium mb-2">
                  Breitengrad
                </label>
                <input
                  type="number"
                  id="lat"
                  name="lat"
                  value={formData.lat}
                  onChange={handleInputChange}
                  step="any"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                      : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
              </div>
              <div>
                <label htmlFor="lng" className="block text-sm font-medium mb-2">
                  Längengrad
                </label>
                <input
                  type="number"
                  id="lng"
                  name="lng"
                  value={formData.lng}
                  onChange={handleInputChange}
                  step="any"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                      : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="available_units" className="block text-sm font-medium mb-2">
                  Verfügbare Powerbanks
                </label>
                <input
                  type="number"
                  id="available_units"
                  name="available_units"
                  value={formData.available_units}
                  onChange={handleInputChange}
                  min="0"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                      : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
              </div>
              <div>
                <label htmlFor="total_units" className="block text-sm font-medium mb-2">
                  Gesamt Powerbanks
                </label>
                <input
                  type="number"
                  id="total_units"
                  name="total_units"
                  value={formData.total_units}
                  onChange={handleInputChange}
                  min="0"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                      : 'bg-white border-gray-300 text-slate-900 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-slate-600 hover:bg-gray-50'
                } transition-colors`}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Hinzufügen...' : 'Hinzufügen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}