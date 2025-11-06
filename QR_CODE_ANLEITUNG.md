# QR-Code Feature Anleitung

## Übersicht

Die GridBox PWA unterstützt jetzt QR-Codes für Stationen! Nutzer können QR-Codes scannen, um Stationen automatisch zu erkennen und auszuwählen.

## Features

### 1. **QR-Code Scannen**
- Öffne die Kamera-Funktion in der App
- Richte die Kamera auf einen QR-Code einer Station
- Die Station wird automatisch erkannt und auf der Karte angezeigt
- Vibrationsfeedback bei erfolgreichem Scan (auf unterstützten Geräten)

### 2. **QR-Code Generieren**
- Erstelle QR-Codes für deine Stationen
- Lade sie als PNG-Datei herunter
- Drucke sie aus und platziere sie an den Stationen

## Verwendung

### Für Nutzer: Station scannen

1. Öffne die GridBox App
2. Tippe auf den **Scan-Button** (Kamera-Symbol) auf der Hauptkarte
3. Erlaube der App den Kamera-Zugriff (falls noch nicht geschehen)
4. Richte die Kamera auf den QR-Code der Station
5. Die Station wird automatisch erkannt und ausgewählt
6. Das Stations-Panel öffnet sich mit allen Details

**Alternative: Manuelle Code-Eingabe**
- Falls der QR-Code nicht lesbar ist, tippe auf das Tastatur-Symbol
- Gib den 4-stelligen Code der Station manuell ein

### Für Station-Betreiber: QR-Codes erstellen

1. Navigiere zu `/qr-test` in der App
2. Wähle eine Station aus der Dropdown-Liste
3. Der QR-Code wird automatisch generiert
4. Klicke auf **"QR-Code herunterladen"**
5. Drucke den QR-Code aus
6. Platziere ihn gut sichtbar an der Station

**Empfohlene QR-Code-Platzierung:**
- Wetterfeste Umgebung oder Schutzfolie verwenden
- Gut sichtbar und zugänglich
- Gute Beleuchtung
- Höhe: ca. 1,20m - 1,60m (Augenhöhe)

## Technische Details

### QR-Code Format

QR-Codes enthalten die Station-ID im folgenden Format:

```
GRIDBOX-STATION-{station-id}
```

Beispiel:
```
GRIDBOX-STATION-123e4567-e89b-12d3-a456-426614174000
```

### Komponenten

**1. CameraOverlay (`src/components/CameraOverlay.tsx`)**
- Kamera-Zugriff
- QR-Code Scanning mit @zxing/library
- Manuelle Code-Eingabe als Fallback
- Taschenlampen-Funktion (auf unterstützten Geräten)

**2. StationQRCode (`src/components/StationQRCode.tsx`)**
- QR-Code Generierung mit qrcode.react
- Download-Funktion
- Anzeige von Station-Details

**3. QR-Test Seite (`src/app/qr-test/page.tsx`)**
- Test-Umgebung für QR-Code Features
- Generator für alle Stationen
- Scanner-Test

### Integration in bestehende Komponenten

Die QR-Code Scanner-Funktionalität wurde in folgende Komponenten integriert:
- `MapViewMapbox.tsx` - Hauptkarte mit Mapbox
- `MapView.tsx` - Alternative Karte mit Leaflet

### Verwendete Bibliotheken

```json
{
  "@zxing/library": "^0.x.x",  // QR-Code Scanning
  "qrcode.react": "^4.x.x"      // QR-Code Generierung
}
```

## Workflow

### Station-Scanning Ablauf

```
1. Nutzer öffnet Scanner
   ↓
2. Kamera wird aktiviert
   ↓
3. QR-Code wird erkannt
   ↓
4. Station-ID wird extrahiert
   ↓
5. Station wird in der Datenbank gesucht
   ↓
6. Station wird auf der Karte hervorgehoben
   ↓
7. Stations-Panel öffnet sich
```

### Fehlerbehandlung

- **QR-Code nicht lesbar**: Manuelle Code-Eingabe verfügbar
- **Station nicht gefunden**: Fehler-Meldung + Alert
- **Kamera-Zugriff verweigert**: Hilfreiche Fehlermeldung mit Anleitung
- **Schlechte Beleuchtung**: Taschenlampen-Funktion verfügbar

## Best Practices

### Für Entwickler

1. **Callback immer bereitstellen**: Stelle sicher, dass `onStationScanned` implementiert ist
2. **Fehlerbehandlung**: Behandle Fälle, wo Stationen nicht gefunden werden
3. **User Feedback**: Nutze Vibrationen oder visuelle Hinweise für Scan-Erfolg
4. **Performance**: QR-Scanning läuft in Intervallen (300ms) um Akku zu schonen

### Für Nutzer

1. **Kamera sauber halten**: Schmutz kann das Scannen beeinträchtigen
2. **Gute Beleuchtung**: Bei Dunkelheit Taschenlampe verwenden
3. **Abstand halten**: 10-30cm Abstand zum QR-Code ideal
4. **Ruhig halten**: Bewegungen erschweren das Scannen

### Für Station-Betreiber

1. **Hochwertige QR-Codes**: Mindestens 256x256px verwenden
2. **Wetterschutz**: Laminieren oder wetterfeste Aufkleber verwenden
3. **Regelmäßige Kontrolle**: QR-Codes auf Lesbarkeit prüfen
4. **Ersatz-QR-Codes**: Bei Beschädigung neue QR-Codes anbringen
5. **Backup-Code**: 4-stelligen Code zusätzlich gut sichtbar anbringen

## Fehlerbehebung

### QR-Code wird nicht erkannt

**Problem**: Kamera erkennt den QR-Code nicht

**Lösungen**:
1. Taschenlampe einschalten (Button in der Scanner-Ansicht)
2. Abstand zum QR-Code variieren (10-30cm)
3. Kamera-Linse reinigen
4. Manuelle Code-Eingabe verwenden (Tastatur-Button)

### Station wird nicht gefunden

**Problem**: QR-Code wird gescannt, aber Station wird nicht angezeigt

**Ursachen**:
1. Station ist nicht aktiv (`is_active = false`)
2. Station existiert nicht in der Datenbank
3. QR-Code enthält falsche Station-ID

**Lösung**: Station-Details in der Datenbank überprüfen

### Kamera startet nicht

**Problem**: Kamera-Zugriff funktioniert nicht

**Lösungen**:
1. Browser-Berechtigungen prüfen
2. HTTPS verwenden (HTTP blockiert Kamera-Zugriff)
3. Browser-Cache leeren
4. Andere Apps mit Kamera-Zugriff schließen

## Beispiel-Code

### QR-Code Scanner verwenden

```tsx
import CameraOverlay from '@/components/CameraOverlay';

function MyComponent() {
  const [scanning, setScanning] = useState(false);

  return (
    <>
      <button onClick={() => setScanning(true)}>
        Station scannen
      </button>
      
      {scanning && (
        <CameraOverlay
          onClose={() => setScanning(false)}
          onStationScanned={(stationId) => {
            console.log('Station gefunden:', stationId);
            // Deine Logik hier...
          }}
        />
      )}
    </>
  );
}
```

### QR-Code generieren

```tsx
import StationQRCode from '@/components/StationQRCode';

function MyComponent() {
  return (
    <StationQRCode
      stationId="123e4567-e89b-12d3-a456-426614174000"
      stationName="Hauptbahnhof"
      size={256}
      showDownload={true}
    />
  );
}
```

## Roadmap / Zukünftige Features

- [ ] Bulk QR-Code Generierung für alle Stationen
- [ ] QR-Code mit Logo/Branding
- [ ] Statistiken: Wie oft wurde eine Station gescannt?
- [ ] Deep-Links in QR-Codes (direkt App öffnen)
- [ ] NFC-Unterstützung als Alternative
- [ ] QR-Code-Historie im Nutzerprofil

## Support

Bei Fragen oder Problemen:
1. Prüfe diese Dokumentation
2. Schaue in die Test-Seite `/qr-test`
3. Kontaktiere den Support

## Changelog

### Version 1.0.0 (Aktuell)
- ✅ QR-Code Scanning implementiert
- ✅ QR-Code Generierung implementiert
- ✅ Integration in Hauptkarte (MapViewMapbox & MapView)
- ✅ Taschenlampen-Funktion
- ✅ Manuelle Code-Eingabe als Fallback
- ✅ Test-Seite erstellt
- ✅ Vibrationsfeeback
- ✅ Fehlerbehandlung

