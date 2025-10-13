"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraOverlay({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          el.onloadedmetadata = () => {
            el.play().catch(() => {});
          };
        }
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "Kamera konnte nicht geöffnet werden.");
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      </div>
      {/* Darken outside using giant box-shadow to avoid seams */}
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
        <div className="absolute bottom-4 left-4 right-4 text-center text-sm text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}


