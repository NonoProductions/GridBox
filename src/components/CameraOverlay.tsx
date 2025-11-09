"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from '@zxing/library';

interface CameraOverlayProps {
  onClose: () => void;
  onStationScanned?: (stationId: string) => void;
}

export default function CameraOverlay({ onClose, onStationScanned }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [useCanvasFallback, setUseCanvasFallback] = useState(false);
  const qrCodeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scanControlRef = useRef<{ stop: () => void } | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasScannedRef = useRef(false);
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

        // Erweiterte Kamera-Constraints für bessere mobile Kompatibilität und schnelleres Scannen
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" }, // Rückkamera bevorzugen, aber nicht erzwingen
            // Hohe Auflösung für bessere QR-Code-Erkennung, aber flexibel für Kompatibilität
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            aspectRatio: { ideal: 16/9 },
            frameRate: { ideal: 30, min: 10, max: 60 },
          },
          audio: false
        };

        console.log('📱 Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          // Komponente wurde bereits unmountet
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        // Prüfe Kamera-Capabilities und aktiviere erweiterte Funktionen
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        
        if (capabilities) {
          console.log('📷 Camera capabilities:', capabilities);
          
          // Aktiviere Taschenlampe wenn unterstützt
          if ('torch' in capabilities) {
            setTorchSupported(true);
            console.log('✅ Torch/Flashlight is supported');
          }
          
          // Versuche erweiterte Constraints anzuwenden für bessere QR-Code-Erkennung
          const constraintsToApply: any = { advanced: [{}] };
          let hasAdvancedConstraints = false;
          
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            constraintsToApply.advanced[0].focusMode = 'continuous';
            hasAdvancedConstraints = true;
            console.log('🎯 Continuous autofocus available');
          }
          
          if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
            constraintsToApply.advanced[0].exposureMode = 'continuous';
            hasAdvancedConstraints = true;
            console.log('☀️ Continuous exposure available');
          }
          
          if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
            constraintsToApply.advanced[0].whiteBalanceMode = 'continuous';
            hasAdvancedConstraints = true;
            console.log('🌈 Continuous white balance available');
          }
          
          if (hasAdvancedConstraints) {
            try {
              await track.applyConstraints(constraintsToApply);
              console.log('✅ Advanced camera constraints applied successfully');
            } catch (constraintError) {
              console.log('ℹ️ Could not apply all advanced constraints:', constraintError);
            }
          }
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
      
      // Stoppe zuerst den QR-Scanner
      if (scanControlRef.current) {
        console.log('Stopping QR scanner controls');
        scanControlRef.current.stop();
        scanControlRef.current = null;
      }
      
      // Dann stoppe die Kamera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          console.log('Stopping camera track');
          t.stop();
        });
        streamRef.current = null;
      }
      
      // Resette den Code-Reader
      if (qrCodeReaderRef.current) {
        qrCodeReaderRef.current.reset();
        qrCodeReaderRef.current = null;
      }
    };
  }, []);

  // QR-Code Scanning - Optimierte kontinuierliche Scan-Methode mit Canvas-Fallback
  useEffect(() => {
    if (!scanningActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    
    // Warte bis Video bereit ist
    if (video.readyState < 2) {
      console.log('⏳ Waiting for video to be ready...');
      const onMetadataLoaded = () => {
        console.log('✅ Video metadata loaded, ready to scan');
      };
      video.addEventListener('loadeddata', onMetadataLoaded, { once: true });
      return;
    }

    const codeReader = new BrowserQRCodeReader();
    qrCodeReaderRef.current = codeReader;
    
    // Hole das Video-Device von der aktuellen Stream
    const videoTrack = streamRef.current.getVideoTracks()[0];
    const deviceId = videoTrack.getSettings().deviceId || null;

    console.log('🚀 Starting continuous QR code scanning...');
    console.log('📹 Video ready state:', video.readyState);
    console.log('📐 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    console.log('🎥 Video track settings:', videoTrack.getSettings());
    
    // Gemeinsame Callback-Funktion für QR-Code-Erkennung
    const handleDecode = (result: any, error: any) => {
      if (result) {
        const scannedText = result.getText();
        const now = Date.now();
        
        console.log('🔍 QR Code detected:', scannedText);
        hasScannedRef.current = true;
        
        // Verhindere mehrfaches Scannen desselben Codes innerhalb von 1 Sekunde
        if (scannedText !== lastScannedCode || now - lastScanTime > 1000) {
          console.log('✅ QR Code erfolgreich gescannt:', scannedText);
          
          setLastScannedCode(scannedText);
          setLastScanTime(now);
          
          // Visueller Erfolgsindikator
          setScanSuccess(true);
          setTimeout(() => setScanSuccess(false), 1000);
          
          // Versuche Station-ID zu extrahieren
          // Format: "GRIDBOX-STATION-{stationId}" oder direkt die Station-ID
          let stationId = scannedText;
          if (scannedText.startsWith('GRIDBOX-STATION-')) {
            stationId = scannedText.replace('GRIDBOX-STATION-', '');
          }
          
          console.log('📍 Extracted Station ID:', stationId);
          
          // Callback mit Station-ID
          if (onStationScanned) {
            onStationScanned(stationId);
          }
          
          // Haptisches Feedback für erfolgreichen Scan
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]); // Doppel-Vibration
          }
        }
      }
      
      // Log nur echte Fehler, nicht "NotFoundException" (kein QR-Code im Bild)
      if (error && !error.message?.includes('NotFoundException')) {
        console.debug('QR scan attempt:', error.message);
      }
    };
    
    // Methode 1: Versuche kontinuierliches Scanning (bevorzugt)
    try {
      console.log('Using direct video scanning method');
      const controls = codeReader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        handleDecode
      );
      
      scanControlRef.current = controls;
      
      // Falls nach 2 Sekunden kein Scan funktioniert, wechsle zu Canvas-Fallback
      // (nur wenn noch kein erfolgreicher Scan stattgefunden hat)
      fallbackTimeoutRef.current = setTimeout(() => {
        if (!hasScannedRef.current && !useCanvasFallback) {
          console.log('⚠️ Direct video scan not detecting codes, switching to canvas fallback');
          setUseCanvasFallback(true);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Error starting direct video scan:', err);
      setUseCanvasFallback(true);
    }

    return () => {
      console.log('Stopping QR code scanning...');
      if (scanControlRef.current) {
        scanControlRef.current.stop();
        scanControlRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      codeReader.reset();
    };
  }, [scanningActive, onStationScanned, lastScannedCode, lastScanTime, useCanvasFallback]);

  // Canvas-Fallback für Geräte, wo direkte Video-Decodierung nicht funktioniert
  // Dieser Modus läuft ZUSÄTZLICH zum direkten Video-Scanning für höhere Erfolgsrate
  useEffect(() => {
    if (!useCanvasFallback || !scanningActive || !videoRef.current) return;

    console.log('🔄 Starting canvas-based QR code scanning (fallback method)...');
    
    const codeReader = new BrowserQRCodeReader();
    const video = videoRef.current;
    
    // Erstelle ein verstecktes Canvas für Frame-Captures
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvasRef.current = canvas;
    
    if (!context) {
      console.error('Could not get canvas context');
      return;
    }

    // Scan-Funktion die regelmäßig ein Frame vom Video nimmt und analysiert
    const scanFrame = async () => {
      if (!video.videoWidth || !video.videoHeight) return;
      
      // Setze Canvas-Größe auf Video-Größe
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Zeichne aktuelles Video-Frame auf Canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        // Versuche QR-Code vom Canvas zu lesen
        const result = await codeReader.decodeFromCanvas(canvas);
        
        if (result) {
          const scannedText = result.getText();
          const now = Date.now();
          
          console.log('🔍 QR Code detected (canvas method):', scannedText);
          hasScannedRef.current = true;
          
          // Verhindere mehrfaches Scannen desselben Codes
          if (scannedText !== lastScannedCode || now - lastScanTime > 1000) {
            console.log('✅ QR Code erfolgreich gescannt (canvas):', scannedText);
            
            setLastScannedCode(scannedText);
            setLastScanTime(now);
            
            // Visueller Erfolgsindikator
            setScanSuccess(true);
            setTimeout(() => setScanSuccess(false), 1000);
            
            // Station-ID extrahieren
            let stationId = scannedText;
            if (scannedText.startsWith('GRIDBOX-STATION-')) {
              stationId = scannedText.replace('GRIDBOX-STATION-', '');
            }
            
            console.log('📍 Extracted Station ID:', stationId);
            
            if (onStationScanned) {
              onStationScanned(stationId);
            }
            
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
          }
        }
      } catch (err: any) {
        // Ignoriere NotFoundException (kein QR-Code im Frame)
        if (!err?.message?.includes('NotFoundException')) {
          console.debug('Canvas scan error:', err?.message);
        }
      }
    };

    // Scanne alle 150ms (~6-7x pro Sekunde) für schnellere Erkennung
    scanIntervalRef.current = setInterval(scanFrame, 150);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      codeReader.reset();
    };
  }, [useCanvasFallback, scanningActive, onStationScanned, lastScannedCode, lastScanTime]);

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
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
          <div
            className="rounded-2xl relative overflow-hidden"
            style={{
              width: "70vw",
              maxWidth: "320px",
              aspectRatio: "1 / 1",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
              border: `2px solid ${scanSuccess ? 'rgba(34,197,94,1)' : 'rgba(16,185,129,0.8)'}`,
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              transition: "border-color 0.3s ease",
            }}
          >
            {/* Erfolgs-Overlay */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center animate-pulse">
                <div className="bg-white rounded-full p-4">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    width="48" 
                    height="48" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            )}
            
            {/* Animierte Scan-Linie */}
            {scanningActive && !scanSuccess && (
              <div 
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan"
                style={{
                  boxShadow: '0 0 10px rgba(16,185,129,0.8)',
                }}
              />
            )}
          </div>
        </div>
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
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {scanningActive && (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
            <span className="text-base md:text-lg font-semibold tracking-wide text-white drop-shadow-lg">
              {scanningActive ? 'Scanne QR-Code...' : 'Scanne, um zu Laden'}
            </span>
          </div>
          {useCanvasFallback && scanningActive && (
            <span className="text-xs text-emerald-300/80 drop-shadow">
              Fallback-Modus aktiv
            </span>
          )}
        </div>
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
