"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraOverlay({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
            className="rounded-2xl"
            style={{
              width: "70vw",
              maxWidth: "320px",
              aspectRatio: "1 / 1",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
              border: "2px solid rgba(16,185,129,0.8)",
            }}
          />
        </div>
      )}
      
      <div
        className="absolute inset-x-0 px-4 flex items-center justify-center"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 40px)" }}
      >
        <span className="text-base md:text-lg font-semibold tracking-wide text-white drop-shadow-lg">
          Scanne, um zu Laden
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute right-4 grid place-items-center h-10 w-10 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/40 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
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
    </div>
  );
}


