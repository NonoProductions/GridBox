"use client";

import { useState, useEffect } from 'react';
import CameraOverlay from '@/components/CameraOverlay';
import StationQRCode from '@/components/StationQRCode';
import { supabase } from '@/lib/supabaseClient';
import { Station } from '@/components/StationManager';

export default function QRTestPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [scannedStationId, setScannedStationId] = useState<string | null>(null);
  const [scannedStation, setScannedStation] = useState<Station | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Lade Stationen
  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStations(data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Stationen:', err);
    } finally {
      setLoading(false);
    }
  };

  // Verarbeite gescannten QR-Code
  const handleStationScanned = async (stationId: string) => {
    console.log('Station gescannt:', stationId);
    setScannedStationId(stationId);
    setShowCamera(false);

    // Lade Station-Details aus der Datenbank
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('id', stationId)
        .single();

      if (error) {
        console.error('Station nicht gefunden:', error);
        alert(`Station mit ID ${stationId} wurde nicht gefunden.`);
        return;
      }

      setScannedStation(data);
      alert(`Station gefunden: ${data.name}`);
    } catch (err) {
      console.error('Fehler beim Laden der Station:', err);
      alert('Fehler beim Laden der Station-Details');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          QR-Code Test
        </h1>

        {/* Scanner Section */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            QR-Code Scanner
          </h2>
          
          <button
            onClick={() => setShowCamera(true)}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-lg font-medium"
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <rect x="7" y="7" width="3" height="3"/>
              <rect x="14" y="7" width="3" height="3"/>
              <rect x="7" y="14" width="3" height="3"/>
              <rect x="14" y="14" width="3" height="3"/>
            </svg>
            Station scannen
          </button>

          {scannedStation && (
            <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                Zuletzt gescannte Station:
              </h3>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {scannedStation.name}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                ID: {scannedStation.id}
              </p>
              {scannedStation.address && (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  📍 {scannedStation.address}
                </p>
              )}
            </div>
          )}
        </section>

        {/* QR-Code Generator Section */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            QR-Code Generator
          </h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Stationen...</p>
            </div>
          ) : stations.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <p>Keine Stationen gefunden.</p>
              <p className="text-sm mt-2">Erstelle zuerst eine Station im Dashboard.</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Station auswählen:
                </label>
                <select
                  value={selectedStation?.id || ''}
                  onChange={(e) => {
                    const station = stations.find(s => s.id === e.target.value);
                    setSelectedStation(station || null);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">-- Station wählen --</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} {station.address ? `(${station.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStation && (
                <div className="flex justify-center">
                  <StationQRCode
                    stationId={selectedStation.id}
                    stationName={selectedStation.name}
                    size={256}
                    showDownload={true}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* Info Section */}
        <section className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            ℹ️ Wie funktioniert es?
          </h3>
          <ol className="space-y-2 text-blue-800 dark:text-blue-200">
            <li><strong>1.</strong> Wähle eine Station aus der Liste</li>
            <li><strong>2.</strong> Lade den QR-Code herunter und drucke ihn aus</li>
            <li><strong>3.</strong> Platziere den QR-Code an der Station</li>
            <li><strong>4.</strong> Nutzer können den Code scannen, um die Station zu erkennen</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Format:</strong> QR-Codes enthalten die Station-ID im Format 
              <code className="mx-1 px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded">
                GRIDBOX-STATION-{'{id}'}
              </code>
            </p>
          </div>
        </section>
      </div>

      {/* Camera Overlay */}
      {showCamera && (
        <CameraOverlay
          onClose={() => setShowCamera(false)}
          onStationScanned={handleStationScanned}
        />
      )}
    </div>
  );
}

