"use client";

import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';

interface StationQRCodeProps {
  stationId: string;
  stationName: string;
  shortCode?: string;
  size?: number;
  showDownload?: boolean;
}

export default function StationQRCode({ 
  stationId, 
  stationName,
  shortCode,
  size = 256,
  showDownload = true 
}: StationQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // QR-Code Daten: URL mit Short-Code (kurz und funktioniert mit Handy-Kamera)
  // Verwendet automatisch die richtige URL (localhost oder production)
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://gridbox-app.vercel.app';
  const code = shortCode || stationId;
  const qrValue = `${baseUrl}/rent/${code}`;

  const downloadQRCode = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Konvertiere SVG zu PNG und lade herunter
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = size;
    canvas.height = size;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `station-${stationName.replace(/\s+/g, '-')}-qr.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        ref={qrRef}
        className="bg-white p-4 rounded-xl shadow-lg"
      >
        <QRCodeSVG
          value={qrValue}
          size={size}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: "/icon-192x192.png",
            x: undefined,
            y: undefined,
            height: size * 0.2,
            width: size * 0.2,
            excavate: true,
          }}
        />
      </div>
      
      <div className="text-center">
        <p className="font-semibold text-lg">{stationName}</p>
        {shortCode && (
          <p className="text-2xl text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-1">
            {shortCode}
          </p>
        )}
      </div>

      {showDownload && (
        <button
          onClick={downloadQRCode}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="20" 
            height="20" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          QR-Code herunterladen
        </button>
      )}
    </div>
  );
}

