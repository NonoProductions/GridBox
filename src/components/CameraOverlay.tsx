"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserQRCodeReader, DecodeHintType, NotFoundException } from '@zxing/library';

interface CameraOverlayProps {
  onClose: () => void;
  onStationScanned?: (stationId: string) => void;
}

export default function CameraOverlay({ onClose, onStationScanned }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState(["", "", "", ""]);
  const [scanningActive, setScanningActive] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  const [scanFeedback, setScanFeedback] = useState<string>("");
  const qrCodeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");
  const scanCooldownRef = useRef(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        // Prüfe ob MediaDevices API verfügbar ist
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Kamera-API wird von diesem Browser nicht unterstützt");
        }

        // Erweiterte Kamera-Constraints für bessere mobile Kompatibilität
        const constraints = {
          video: {
            facingMode: { ideal: "environment" }, // Rückkamera bevorzugen, aber nicht erzwingen
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          // Komponente wurde bereits unmountet
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        // Prüfe ob Taschenlampe unterstützt wird
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (capabilities && 'torch' in capabilities) {
          setTorchSupported(true);
          console.log('Torch/Flashlight is supported');
        }
        
        const el = videoRef.current;
        
        if (el) {
          el.srcObject = stream;
          
          // Warte auf Metadaten und starte dann das Video
          el.onloadedmetadata = () => {
            console.log('Camera metadata loaded');
            el.play()
              .then(() => {
                console.log('Camera started successfully');
                setLoading(false);
                setScanningActive(true);
              })
              .catch((playError) => {
                console.error('Error playing video:', playError);
                setError("Video konnte nicht gestartet werden");
                setLoading(false);
              });
          };
          
          el.onerror = (e) => {
            console.error('Video element error:', e);
            setError("Fehler beim Laden des Kamera-Streams");
            setLoading(false);
          };
        } else {
          setLoading(false);
        }
      } catch (e: unknown) {
        console.error('Camera access error:', e);
        
        if (!mounted) return;
        
        // Bessere Fehlermeldungen
        const error = e as Error;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setError("Kamera-Zugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.");
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setError("Keine Kamera gefunden.");
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setError("Kamera wird bereits von einer anderen App verwendet.");
        } else if (error.name === 'OverconstrainedError') {
          setError("Kamera unterstützt die geforderten Einstellungen nicht.");
        } else if (error.name === 'SecurityError') {
          setError("Kamera-Zugriff aus Sicherheitsgründen blockiert. Nutze HTTPS.");
        } else {
          setError(error?.message ?? "Kamera konnte nicht geöffnet werden.");
        }
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          console.log('Stopping camera track');
          t.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  // QR-Code Scanning - Optimiert für mobile Geräte
  useEffect(() => {
    if (!scanningActive || !videoRef.current) return;

    const codeReader = new BrowserQRCodeReader(0);
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    codeReader.hints = hints;
    codeReader.timeBetweenDecodingAttempts = 0;
    qrCodeReaderRef.current = codeReader;
    lastScannedRef.current = lastScannedCode;
    scanCooldownRef.current = false;
    
    // Erstelle Canvas für Frame-Capturing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvasRef.current = canvas;
    
    let isScanning = true;
    let scanAttempts = 0;

    const scanFrame = async () => {
      if (!isScanning || !videoRef.current || !ctx) return;
      
      const video = videoRef.current;
      
      // Warte bis Video bereit ist
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanIntervalRef.current = window.setTimeout(scanFrame, 100);
        return;
      }
      
      try {
        const minDimension = Math.min(video.videoWidth, video.videoHeight);
        if (!minDimension) {
          scanIntervalRef.current = window.setTimeout(scanFrame, 120);
          return;
        }

        const regionSize = Math.max(200, Math.floor(minDimension * 0.7));
        const sx = Math.max(0, Math.floor((video.videoWidth - regionSize) / 2));
        const sy = Math.max(0, Math.floor((video.videoHeight - regionSize) / 2));

        const targetSize = 480;
        canvas.width = targetSize;
        canvas.height = targetSize;

        ctx.save();
        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.drawImage(
          video,
          sx,
          sy,
          regionSize,
          regionSize,
          0,
          0,
          targetSize,
          targetSize,
        );
        ctx.restore();
        
        // Versuche QR-Code zu dekodieren
        try {
          const result = await codeReader.decodeFromCanvas(canvas);
          
          if (result && result.getText()) {
            const scannedText = result.getText();
            console.log('✅ QR Code erfolgreich gescannt:', scannedText);
            
            // Verhindere mehrfaches Scannen desselben Codes
            const normalizedText = scannedText.trim();
            if (!normalizedText) {
              scanIntervalRef.current = window.setTimeout(scanFrame, 120);
              return;
            }

            if (normalizedText !== lastScannedRef.current && !scanCooldownRef.current) {
              isScanning = false; // Stoppe weitere Scans
              lastScannedRef.current = normalizedText;
              scanCooldownRef.current = true;
              setLastScannedCode(normalizedText);
              setScanFeedback('✅ Erkannt!');
              
              // Versuche Station-ID zu extrahieren
              let stationId = normalizedText;
              if (normalizedText.startsWith('GRIDBOX-STATION-')) {
                stationId = normalizedText.replace('GRIDBOX-STATION-', '');
              }
              
              // Starkes Vibrationsfeedback
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 200]);
              }
              
              // Callback mit Station-ID
              if (onStationScanned) {
                onStationScanned(stationId);
              }
              
              return; // Beende Scanning
            }
          }
        } catch (err) {
          if (!(err instanceof NotFoundException)) {
            console.error('Decoder error:', err);
          }
          scanAttempts++;
          if (scanAttempts % 15 === 0) {
            setScanFeedback(scanAttempts >= 60 ? 'Bitte näher an den QR-Code gehen' : 'Suche...');
          }
        }
        
        // Nächster Scan-Versuch nach sehr kurzer Pause (50ms für bessere Performance)
        if (isScanning) {
          scanIntervalRef.current = window.setTimeout(scanFrame, 60);
        }
      } catch (error) {
        console.error('Frame scanning error:', error);
        if (isScanning) {
          scanIntervalRef.current = window.setTimeout(scanFrame, 100);
        }
      }
    };

    // Starte Scanning
    console.log('🔍 QR-Code Scanner gestartet');
    setScanFeedback('Suche QR-Code...');
    scanFrame();

    return () => {
      console.log('🛑 QR-Code Scanner gestoppt');
      isScanning = false;
      if (scanIntervalRef.current) {
        clearTimeout(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      scanCooldownRef.current = false;
      lastScannedRef.current = "";
      codeReader.reset();
    };
  }, [scanningActive, onStationScanned]);

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
      console.log('Torch toggled:', newTorchState);
    } catch (err) {
      console.error('Error toggling torch:', err);
    }
  };

  // Manuellen Code verarbeiten
  const handleManualCodeSubmit = () => {
    const code = manualCode.join("");
    if (code.length === 4) {
      console.log('Manual code entered:', code);
      const normalized = code.toUpperCase();
      setLastScannedCode(normalized);
      lastScannedRef.current = normalized;
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
      // Fokus auf das nächste leere Feld oder das letzte Feld
      const nextIndex = Math.min(pastedData.length, 3);
      inputRefs[nextIndex].current?.focus();
    }
  };

  // Verhindere Scrollen wenn Modal offen ist
  useEffect(() => {
    if (showManualInput) {
      // Speichere aktuelle Scroll-Position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Stelle Scroll-Position wieder her
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
  }, [showManualInput]);

  useEffect(() => {
    function updateBox() {
      if (!boxRef.current) return;
      setBoxSize(boxRef.current.offsetWidth);
    }
    updateBox();
    const ro = new ResizeObserver(updateBox);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", updateBox);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateBox);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1200] bg-black/90 text-white">
      <div className="absolute inset-0">
        <video 
          ref={videoRef} 
          className="h-full w-full object-cover" 
          playsInline 
          muted 
          autoPlay
          webkit-playsinline="true"
        />
      </div>
      
      {/* Loading Indicator */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-sm">Kamera wird gestartet...</p>
          </div>
        </div>
      )}
      
      {/* Darken outside using giant box-shadow to avoid seams */}
      {!loading && !error && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
            <div
              className="rounded-2xl relative overflow-hidden"
              style={{
                width: "70vw",
                maxWidth: "320px",
                aspectRatio: "1 / 1",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
                border: scanFeedback.includes('Erkannt') ? "3px solid rgba(16,185,129,1)" : "2px solid rgba(16,185,129,0.8)",
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* Animierte Scan-Linie */}
              {!scanFeedback.includes('Erkannt') && scanningActive && (
                <div 
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                  style={{
                    animation: "scanLine 2s ease-in-out infinite",
                    boxShadow: "0 0 10px rgba(16,185,129,0.8)",
                  }}
                />
              )}
              
              {/* Ecken-Indikatoren für bessere Zielführung */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
            </div>
          </div>
          
          {/* CSS Animation für Scan-Linie */}
          <style jsx>{`
            @keyframes scanLine {
              0% {
                top: 0%;
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              90% {
                opacity: 1;
              }
              100% {
                top: 100%;
                opacity: 0;
              }
            }
          `}</style>
          
          {/* Scan Feedback - direkt über dem QR-Code-Rahmen */}
          {scanFeedback && (
            <div 
              className="absolute z-[1002] pointer-events-none"
              style={{
                left: "50%",
                top: "50%",
                transform: "translate(-50%, calc(-35vw - 3rem))",
                maxWidth: "min(70vw, 320px)",
              }}
            >
              <div className={`text-center px-4 py-2 rounded-xl backdrop-blur-xl font-medium transition-all ${
                scanFeedback.includes('Erkannt') 
                  ? 'bg-emerald-500/90 text-white text-lg scale-110' 
                  : 'bg-black/60 text-emerald-400 text-sm'
              }`}>
                {scanFeedback}
              </div>
            </div>
          )}
        </>
      )}
      
      <div
        className="absolute inset-x-0 px-4 flex items-center justify-center z-[1001]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 40px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute left-4 grid place-items-center h-10 w-10 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/40 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="text-base md:text-lg font-semibold tracking-wide text-white drop-shadow-lg">
          Scanne, um zu Laden
        </span>
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div
          ref={boxRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] max-w-xs aspect-square rounded-2xl"
        />
      </div>
      {error && (
        <div className="absolute inset-x-0 bottom-0 p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-4 text-center">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm text-red-200 font-medium mb-2">Kamera-Fehler</p>
            <p className="text-xs text-red-300">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Liquid Glass Buttons unter dem QR-Code-Rahmen */}
      {!error && !loading && (
        <div 
          className="absolute flex justify-center gap-5"
          style={{ 
            left: '50%',
            top: '50%',
            transform: `translate(-50%, calc(35vw + 2rem))`,
            maxWidth: 'min(70vw, 320px)',
            width: 'auto'
          }}
        >
          {/* Manueller Code-Button (LINKS) */}
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="grid place-items-center h-16 w-16 rounded-full backdrop-blur-2xl bg-white/25 text-white shadow-2xl shadow-black/40 hover:bg-white/35 transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            }}
            aria-label="Code manuell eingeben"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="26" 
              height="26" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01"/>
              <path d="M10 8h.01"/>
              <path d="M14 8h.01"/>
              <path d="M18 8h.01"/>
              <path d="M8 12h.01"/>
              <path d="M12 12h.01"/>
              <path d="M16 12h.01"/>
              <path d="M7 16h10"/>
            </svg>
          </button>

          {/* Taschenlampen-Button (RECHTS) */}
          <button
            type="button"
            onClick={toggleTorch}
            className={`relative grid place-items-center h-16 w-16 rounded-full backdrop-blur-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl ${
              torchEnabled 
                ? 'bg-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.4)] ring-2 ring-amber-300/40' 
                : 'bg-white/25 text-white shadow-black/40 hover:bg-white/35'
            }`}
            style={{
              backdropFilter: torchEnabled ? 'blur(40px) saturate(180%) brightness(110%)' : 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: torchEnabled ? 'blur(40px) saturate(180%) brightness(110%)' : 'blur(40px) saturate(180%)',
            }}
            aria-label={torchEnabled ? "Taschenlampe ausschalten" : "Taschenlampe einschalten"}
          >
            {torchEnabled ? (
              // AN: Gefüllte leuchtende Taschenlampe mit Strahlen
              <>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  width="32" 
                  height="32" 
                  fill="#1f2937"
                  stroke="none"
                  className="relative z-10"
                >
                  <path d="M8 2h8l2 4v2c0 .5-.2 1-.6 1.4L17 10v9c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-9l-.4-.6c-.4-.4-.6-.9-.6-1.4V6l2-4zm4 10c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z"/>
                </svg>
                {/* Lichtstrahlen Animation */}
                <div className="absolute inset-0 rounded-full animate-pulse">
                  <div className="absolute inset-0 rounded-full bg-yellow-200/50"></div>
                </div>
              </>
            ) : (
              // AUS: Durchgestrichene Taschenlampe
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                width="30" 
                height="30" 
                fill="none"
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M8 2h8l2 4v2c0 .5-.2 1-.6 1.4L17 10v9c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2v-9l-.4-.6c-.4-.4-.6-.9-.6-1.4V6l2-4z"/>
                <line x1="12" y1="12" x2="12" y2="18" strokeWidth="2.5"/>
                {/* Durchstreichungs-Linie */}
                <line x1="4" y1="4" x2="20" y2="20" strokeWidth="3" stroke="currentColor"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Modal für manuelle Code-Eingabe */}
      {showManualInput && (
        <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center p-6 z-[1300]" 
          style={{
            background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(0, 0, 0, 0.95) 70%)'
          }}
        >
          <div className="bg-gray-900/95 rounded-2xl p-6 max-w-sm w-full border border-emerald-500/20 shadow-2xl"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px rgba(16, 185, 129, 0.1)'
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Stations-Code</h3>
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setManualCode(["", "", "", ""]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Schließen"
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


