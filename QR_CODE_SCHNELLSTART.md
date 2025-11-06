# QR-Code Feature - Schnellstart

## ✅ Implementiert!

Das QR-Code Feature ist jetzt vollständig in deine GridBox PWA integriert.

## 🚀 Sofort loslegen

### Als Nutzer: Station scannen

1. Öffne die App
2. Klicke auf den **Scan-Button** 📷
3. Scanne den QR-Code einer Station
4. Fertig! Die Station wird automatisch ausgewählt

### Als Betreiber: QR-Codes erstellen

1. Gehe zu **`/qr-test`** in der App
2. Wähle eine Station aus
3. Klicke **"QR-Code herunterladen"**
4. Drucke und platziere ihn an der Station

## 📦 Was wurde hinzugefügt?

### Neue Komponenten

```
src/components/
├── CameraOverlay.tsx      ← QR-Code Scanner (erweitert)
└── StationQRCode.tsx      ← QR-Code Generator (neu)

src/app/
└── qr-test/
    └── page.tsx           ← Test-Seite (neu)
```

### Neue Features

- ✅ **QR-Code Scanning** mit Kamera
- ✅ **QR-Code Generierung** für Stationen
- ✅ **Automatische Station-Erkennung**
- ✅ **Taschenlampen-Funktion** für dunkle Umgebungen
- ✅ **Manuelle Code-Eingabe** als Fallback
- ✅ **Vibrationsfeedback** bei erfolgreichem Scan
- ✅ **Download-Funktion** für QR-Codes (PNG)

## 🔧 Technische Details

### Installierte Pakete

```bash
npm install @zxing/library qrcode.react
```

### QR-Code Format

```
GRIDBOX-STATION-{station-id}
```

### Verwendung in deinem Code

```tsx
// Scanner öffnen
<CameraOverlay
  onClose={() => setScanning(false)}
  onStationScanned={(stationId) => {
    console.log('Station:', stationId);
  }}
/>

// QR-Code erstellen
<StationQRCode
  stationId="..."
  stationName="Hauptbahnhof"
  size={256}
/>
```

## 🎯 Nächste Schritte

### 1. Teste das Feature
```
http://localhost:3000/qr-test
```

### 2. Erstelle QR-Codes
- Gehe zur Test-Seite
- Wähle deine Stationen
- Lade die QR-Codes herunter

### 3. Drucke und platziere
- Drucke die QR-Codes aus
- Laminiere sie (empfohlen)
- Platziere sie an den Stationen

### 4. Teste das Scannen
- Öffne die Haupt-App
- Nutze den Scan-Button
- Scanne deine QR-Codes

## 💡 Tipps

### Für optimales Scannen

- **Größe**: Mindestens 5x5 cm drucken
- **Material**: Wetterfest oder laminiert
- **Platzierung**: Augenhöhe, gut beleuchtet
- **Hintergrund**: Weißer Hintergrund, schwarzer QR-Code

### Bei Problemen

1. **Nicht lesbar?** → Taschenlampe einschalten
2. **Zu dunkel?** → Taschenlampen-Button nutzen
3. **Beschädigt?** → Manuelle Code-Eingabe (Tastatur-Symbol)
4. **Kamera geht nicht?** → HTTPS verwenden, Berechtigungen prüfen

## 📱 Demo-Flow

```
┌─────────────────┐
│  Hauptkarte     │
│  [Scan-Button]  │
└────────┬────────┘
         │ Klick
         ▼
┌─────────────────┐
│  Kamera öffnet  │
│  QR-Scanner     │
└────────┬────────┘
         │ QR-Code erkannt
         ▼
┌─────────────────┐
│  Station wird   │
│  ausgewählt     │
│  Panel öffnet   │
└─────────────────┘
```

## 📖 Vollständige Dokumentation

Siehe `QR_CODE_ANLEITUNG.md` für:
- Detaillierte Erklärungen
- Fehlerbehandlung
- Best Practices
- Beispiel-Code
- Roadmap

## ✨ Features im Detail

### Scanner
- Automatische QR-Code Erkennung
- Kontinuierliches Scanning (alle 300ms)
- Duplikat-Erkennung (verhindert mehrfaches Scannen)
- Vibrations-Feedback
- Taschenlampen-Steuerung
- Manuelle Eingabe-Option

### Generator
- SVG-basierte QR-Codes (skalierbar)
- PNG-Download
- App-Icon im QR-Code (optional)
- Station-Name und ID angezeigt
- Error-Correction Level: High

### Integration
- Nahtlose Integration in MapViewMapbox
- Nahtlose Integration in MapView
- Automatisches Highlighting der Station
- Karten-Zentrierung auf gescannte Station
- Panel öffnet sich automatisch

## 🎉 Viel Erfolg!

Das Feature ist einsatzbereit. Teste es und erstelle deine ersten QR-Codes!

Bei Fragen: Siehe vollständige Anleitung in `QR_CODE_ANLEITUNG.md`

