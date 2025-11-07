"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface CameraOverlayProps {
  onClose: () => void;
  onStationScanned?: (stationId: string) => void;
}

export default function CameraOverlay({ onClose, onStationScanned }: CameraOverlayProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState(["", "", "", ""]);
  const [scanFeedback, setScanFeedback] = useState<string>("Bereit zum Scannen...");
  const [scanCount, setScanCount] = useState(0);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerDivRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    let mounted = true;
    
    const startScanner = async () => {
      if (!readerDivRef.current) return;
      
      try {
        // Erstelle Html5Qrcode Instanz
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        // Ultra-aggressive Scan-Konfiguration für maximale Geschwindigkeit
        const config = {
          fps: 30, // Maximale Frame-Rate
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false
        };

        // Starte Scanner
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Erfolgreicher Scan!
            if (hasScannedRef.current) return; // Verhindere Doppel-Scans
            
            hasScannedRef.current = true;
            console.log("✅ QR-Code gescannt:", decodedText);
            
            setScanFeedback("✅ Erkannt!");
            
            // Vibrieren
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            
            // Extrahiere Station-ID
            let stationId = decodedText.trim();
            if (stationId.startsWith('GRIDBOX-STATION-')) {
              stationId = stationId.replace('GRIDBOX-STATION-', '');
            }
            
            // Callback
            if (onStationScanned) {
              onStationScanned(stationId);
            }
            
            // Kurze Verzögerung vor dem Schließen für Feedback
            setTimeout(() => {
              if (mounted) {
                onClose();
              }
            }, 500);
          },
          (errorMessage) => {
            // Kein QR-Code gefunden - das ist normal beim Scannen
            setScanCount(prev => {
              const newCount = prev + 1;
              if (newCount % 30 === 0) {
                setScanFeedback("Richte die Kamera auf den QR-Code...");
              }
              return newCount;
            });
          }
        );

        // Prüfe Taschenlampen-Support
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        streamRef.current = stream;
        
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (capabilities && 'torch' in capabilities) {
          setTorchSupported(true);
        }

        if (mounted) {
          setLoading(false);
          setScanFeedback("Scanne QR-Code...");
        }
      } catch (err) {
        console.error("Scanner-Fehler:", err);
        if (!mounted) return;
        
        const error = err as Error;
        if (error.name === 'NotAllowedError') {
          setError("Kamera-Zugriff verweigert. Bitte erlaube den Zugriff.");
        } else if (error.name === 'NotFoundError') {
          setError("Keine Kamera gefunden.");
        } else {
          setError("Kamera konnte nicht gestartet werden.");
        }
        setLoading(false);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      
      // Stoppe Scanner
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => {
          console.log("Fehler beim Stoppen:", err);
        });
      }
      
      // Stoppe Stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose, onStationScanned]);

  // Taschenlampe ein/ausschalten
  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchEnabled;
      
      await track.applyConstraints({
        // @ts-ignore - torch is not in TypeScript types yet
        advanced: [{ torch: newTorchState }]
      });
      
      setTorchEnabled(newTorchState);
    } catch (err) {
      console.error('Taschenlampen-Fehler:', err);
    }
  };

  // Manuellen Code verarbeiten
  const handleManualCodeSubmit = () => {
    const code = manualCode.join("");
    if (code.length === 4) {
      const normalized = code.toUpperCase();
      setScanFeedback('✅ Code übernommen');
      
      if (onStationScanned) {
        onStationScanned(normalized);
      }
      
      setShowManualInput(false);
      setManualCode(["", "", "", ""]);
      onClose();
    }
  };

  // Handler für Input-Änderungen
  const handleInputChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (/^[A-Z0-9]?$/.test(upperValue)) {
      const newCode = [...manualCode];
      newCode[index] = upperValue;
      setManualCode(newCode);

      // Automatisch zum nächsten Feld springen
      if (upperValue && index < 3) {
        inputRefs[index + 1].current?.focus();
      }
    }
  };

  // Handler für Backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !manualCode[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Handler für Paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').toUpperCase().slice(0, 4);
    if (/^[A-Z0-9]{1,4}$/.test(pastedData)) {
      const newCode = [...manualCode];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setManualCode(newCode);
      const nextIndex = Math.min(pastedData.length, 3);
      inputRefs[nextIndex].current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black text-white">
      {/* QR Reader Container */}
      <div 
        id="qr-reader" 
        ref={readerDivRef}
        className="absolute inset-0"
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* Overlay mit Scan-Rahmen */}
      {!loading && !error && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Dunkler Overlay mit Loch in der Mitte */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, transparent 25%, rgba(0,0,0,0.75) 50%)'
            }}
          />
          
          {/* Scan-Rahmen */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="relative rounded-2xl"
              style={{
                width: '70vw',
                maxWidth: '320px',
                aspectRatio: '1 / 1',
                border: '3px solid rgba(16,185,129,1)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 20px rgba(16,185,129,0.5), inset 0 0 20px rgba(16,185,129,0.3)'
              }}
            >
              {/* Ecken-Indikatoren */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
              
              {/* Pulsierender Glow-Effekt */}
              <div 
                className="absolute inset-0 rounded-2xl animate-pulse"
                style={{
                  boxShadow: 'inset 0 0 30px rgba(16,185,129,0.3)'
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Starte Scanner...</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div
        className="absolute inset-x-0 px-4 flex items-center justify-between z-[1001] pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="grid place-items-center h-12 w-12 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 active:scale-95 pointer-events-auto shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        
        <div className="flex-1 text-center">
          <span className="text-xl font-bold text-white drop-shadow-lg">
            QR-Code Scannen
          </span>
        </div>
        
        <div className="w-12"></div>
      </div>
      
      {/* Scan Feedback */}
      {!loading && !error && scanFeedback && (
        <div 
          className="absolute z-[1002] pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, calc(-35vw - 4rem))",
            maxWidth: "min(80vw, 400px)",
          }}
        >
          <div className={`text-center px-6 py-3 rounded-xl backdrop-blur-xl font-semibold transition-all shadow-lg ${
            scanFeedback.includes('✅') 
              ? 'bg-emerald-500/95 text-white text-lg scale-110 animate-pulse' 
              : 'bg-black/70 text-emerald-300 text-base'
          }`}>
            {scanFeedback}
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
          <div className="max-w-md mx-4 bg-red-900/50 border-2 border-red-500/50 rounded-2xl p-6 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-xl text-red-200 font-semibold mb-3">Kamera-Fehler</p>
            <p className="text-red-300 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!error && !loading && (
        <div 
          className="absolute flex justify-center gap-6 z-[1001]"
          style={{ 
            left: '50%',
            top: '50%',
            transform: `translate(-50%, calc(35vw + 2.5rem))`,
            maxWidth: 'min(70vw, 320px)',
            width: 'auto'
          }}
        >
          {/* Manueller Code-Button */}
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="grid place-items-center h-16 w-16 rounded-full backdrop-blur-2xl bg-white/30 text-white shadow-2xl hover:bg-white/40 transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
            </svg>
          </button>

          {/* Taschenlampen-Button */}
          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`grid place-items-center h-16 w-16 rounded-full backdrop-blur-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl ${
                torchEnabled 
                  ? 'bg-amber-400/70 shadow-amber-400/40 ring-2 ring-amber-300/50' 
                  : 'bg-white/30 text-white hover:bg-white/40'
              }`}
              style={{
                backdropFilter: torchEnabled ? 'blur(40px) saturate(200%) brightness(120%)' : 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: torchEnabled ? 'blur(40px) saturate(200%) brightness(120%)' : 'blur(40px) saturate(180%)',
              }}
            >
              {torchEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#1f2937">
                  <path d="M8 2h8l2 4v2c0 .5-.2 1-.6 1.4L17 10v9c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-9l-.4-.6c-.4-.4-.6-.9-.6-1.4V6l2-4zm4 10c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2h8l2 4v2c0 .5-.2 1-.6 1.4L17 10v9c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-9l-.4-.6c-.4-.4-.6-.9-.6-1.4V6l2-4z"/>
                  <line x1="12" y1="12" x2="12" y2="18" strokeWidth="2.5"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Manual Input Modal */}
      {showManualInput && (
        <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center p-6 z-[1300] bg-black/50">
          <div className="bg-gray-900/95 rounded-2xl p-6 max-w-sm w-full border border-emerald-500/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Stations-Code</h3>
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setManualCode(["", "", "", ""]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-300 text-sm mb-6">
              Gib den 4-stelligen Code von der Station ein
            </p>
            
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="text"
                  value={manualCode[index]}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  maxLength={1}
                  className="w-16 h-16 rounded-xl bg-gray-800 border-2 border-gray-600 text-white text-center text-2xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus={index === 0}
                  placeholder="·"
                />
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setManualCode(["", "", "", ""]);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleManualCodeSubmit}
                disabled={manualCode.join("").length !== 4}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
