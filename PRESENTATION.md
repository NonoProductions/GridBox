# GridBox - Powerbank Sharing System

## Das Problem

- Handy-Akku leer, keine Lademöglichkeit unterwegs
- Ladekabel vergessen oder kein passendes dabei
- Lange Wartezeiten an festen Ladestationen

---

## Die Lösung: GridBox

Eine **Progressive Web App (PWA)** für ein verteiltes Powerbank-Verleihsystem.  
Nutzer können Powerbanks an beliebigen Stationen ausleihen und zurückgeben - flexibel, schnell und unkompliziert.

---

## Zielgruppen

| Zielgruppe | Beschreibung |
|---|---|
| **Endnutzer** | Menschen, die unterwegs Strom fuer ihr Handy brauchen |
| **Stationsbetreiber** | Geschaefte und Standorte, die Stationen betreiben moechten |
| **Administratoren** | Systembetreiber, die das gesamte Netzwerk verwalten |

---

## Features - Endnutzer

### Interaktive Karte
- Echtzeit-Karte mit allen verfuegbaren Powerbank-Stationen
- Farbcodierte Marker: Gruen = verfuegbar, Rot = belegt, Grau = offline
- GPS-Ortung fuer den eigenen Standort
- Mapbox GL mit Dark/Light Kartendesign

### Powerbank ausleihen
- **QR-Code Scanner** - Station scannen und sofort ausleihen
- **Manuelle Code-Eingabe** - 4-stelliger Kurzcode als Alternative
- Echtzeit-Verfuegbarkeitsanzeige
- Live-Kostenberechnung waehrend der Ausleihe

### Wallet & Bezahlung
- Digitales Guthaben aufladen
- Transaktionshistorie einsehen
- Automatische Abrechnung bei Rueckgabe

### Weitere Nutzer-Features
- **Reservierungen** - Powerbank fuer spaeter reservieren
- **Ausleih-Verlauf** - Alle vergangenen Ausleihen mit Kosten und Zeitstempel
- **Rueckgabe-Zusammenfassung** - Sofortiges Feedback nach Rueckgabe
- **Profilverwaltung** - Name und Einstellungen aendern
- **Dark/Light Mode** - Persistenter Theme-Wechsel
- **Hilfe/FAQ** - In-App Support auf Deutsch
- **Push-Benachrichtigungen** - Updates zu Ausleihen

---

## Features - Stationsbetreiber

### Owner Dashboard
- Umfassende Verwaltungsoberflaeche fuer alle eigenen Stationen
- Stationen erstellen, bearbeiten und deaktivieren
- Bis zu 3 Fotos pro Station hochladen (JPEG, PNG, WebP)
- Oeffnungszeiten festlegen

### Echtzeit-Analytik
- Umsatzstatistiken und Miethistorie
- Aktive Sessions und Auslastung
- Diagramme und Charts (Recharts)
- Filterung und Paginierung

### Akku-Ueberwachung
- Live-Batteriestatus aller Powerbanks
- Spannung und Ladestand pro Slot
- Online/Offline-Erkennung der Stationen

### Nutzerverwaltung
- Alle registrierten Nutzer einsehen
- Rollenbasierte Zugriffskontrolle (Nutzer / Betreiber)

---

## Tech Stack

### Frontend
| Technologie | Version | Zweck |
|---|---|---|
| Next.js | 16 | React Framework mit App Router |
| React | 19 | UI-Bibliothek |
| TypeScript | 5 | Typsichere Entwicklung |
| Tailwind CSS | 4 | Utility-First Styling |
| Mapbox GL | 3.16 | Interaktive Karten |
| Recharts | 3.7 | Diagramme & Analytik |
| ZXing | 0.21 | QR-Code Scanning |

### Backend
| Technologie | Zweck |
|---|---|
| Next.js API Routes | Serverless Backend |
| Supabase | PostgreSQL Datenbank + Auth + Storage |
| JWT | Token-basierte Authentifizierung |
| Row Level Security | Datenbankebene Zugriffskontrolle |

### Hardware
| Technologie | Zweck |
|---|---|
| ESP32 | Mikrocontroller pro Station |
| C++ (Arduino) | Firmware fuer Stationssteuerung |
| REST API | Kommunikation Station <-> Server |

### Deployment
| Technologie | Zweck |
|---|---|
| Vercel | Hosting & Deployment |
| Turbopack | Schneller Build-Prozess |
| Service Worker | Offline-Faehigkeit & Caching |

---

## Architektur

```
+------------------+       +------------------+       +------------------+
|                  |       |                  |       |                  |
|   Nutzer (PWA)   | <---> | Next.js Backend  | <---> |    Supabase      |
|   React/TS       |       | API Routes       |       |   PostgreSQL     |
|   Mapbox         |       | JWT Auth         |       |   Auth / Storage |
|                  |       |                  |       |                  |
+------------------+       +--------+---------+       +------------------+
                                    |
                                    | REST API
                                    |
                           +--------+---------+
                           |                  |
                           |   ESP32 Station  |
                           |   2x Powerbank   |
                           |   Slots          |
                           |                  |
                           +------------------+
```

---

## Hardware - ESP32 Station

- **2 unabhaengige Powerbank-Slots** pro Station
- Echtzeit-Batterieueberwachung (Spannung + Prozent)
- Automatischer Powerbank-Auswurf per API-Befehl
- Heartbeat-System zur Online/Offline-Erkennung
- Eigene Geraete-Authentifizierung (32+ Zeichen API-Key)
- Rollback-Mechanismus bei fehlgeschlagenen Transaktionen

---

## Sicherheit

| Massnahme | Beschreibung |
|---|---|
| **Email OTP + PKCE** | Sichere Authentifizierung ohne Passwort |
| **Row Level Security** | Datenzugriff auf Datenbankebene eingeschraenkt |
| **Rate Limiting** | 30 Anfragen/Min pro IP, 120/Min pro Station |
| **CSP Headers** | Content Security Policy gegen XSS |
| **HSTS** | HTTPS erzwungen |
| **Input Validation** | Eingaben werden validiert und bereinigt |
| **JWT Verifizierung** | Token-Pruefung auf allen geschuetzten Routen |
| **X-Frame-Options** | Schutz gegen Clickjacking (DENY) |

---

## UX & Design

- **Mobile-First** - Optimiert fuer Smartphones
- **PWA** - Installierbar auf dem Homescreen, offline-faehig
- **44x44px Touch-Targets** - iOS Accessibility Guidelines
- **Echtzeit-Updates** - Live-Daten via Supabase Subscriptions
- **Foto-Karussell** - Swipe-Gesten fuer Stationsbilder
- **Smooth Animations** - Uebergaenge mit 0.3s ease-in-out
- **Deutsche Lokalisierung** - Gesamte App auf Deutsch

---

## Datenbank-Modell

### Haupttabellen
- **stations** - Stationen mit Standort, Verfuegbarkeit, Batterie-Daten, Fotos
- **profiles** - Nutzerprofile mit Rollen (user/owner)
- **rentals** - Ausleihvorgaenge mit Status, Zeitstempel, Kosten
- **transactions** - Wallet-Transaktionen (Aufladung, Abbuchung)
- **reservations** - Powerbank-Reservierungen
- **charging_sessions** - Ladevorgaenge

---

## Authentifizierungs-Flow

```
1. Nutzer gibt E-Mail ein
2. 6-stelliger OTP-Code wird per E-Mail gesendet
3. Nutzer gibt Code ein
4. PKCE-Flow generiert sicheren Token
5. JWT wird im localStorage gespeichert
6. Automatische Token-Erneuerung
7. Geschuetzte Routen pruefen Session
```

---

## API-Endpunkte

### Nutzer-APIs
- Stations-Abfrage und Detailansicht
- Ausleihe starten und beenden
- Wallet-Operationen
- Profilverwaltung

### Admin-APIs (geschuetzt)
- Stationen erstellen, bearbeiten, deaktivieren
- Nutzer und Rollen verwalten
- Analytik-Daten abrufen
- Miethistorie mit Filterung

### ESP32-APIs (Geraete-Auth)
- `GET /api/esp/station` - Stationskonfiguration abrufen
- `PATCH /api/esp/battery` - Batteriestatus melden
- `PATCH /api/esp/dispense-ack` - Auswurf bestaetigen
- `POST /api/esp/token` - JWT fuer Admin-Operationen

---

## Projektstruktur

```
GridBox/
├── src/
│   ├── app/              # Next.js App Router (Seiten & API)
│   │   ├── api/          # Backend API Routes
│   │   ├── app/          # Hauptseite mit Karte
│   │   ├── dashboard/    # Betreiber-Dashboard
│   │   ├── login/        # OTP Login
│   │   ├── wallet/       # Guthaben-Verwaltung
│   │   ├── rent/         # Ausleih-Seite
│   │   ├── verlauf/      # Transaktionsverlauf
│   │   └── hilfe/        # FAQ & Hilfe
│   ├── components/       # Wiederverwendbare UI-Komponenten
│   └── lib/              # Hilfsfunktionen & Clients
├── public/               # Statische Assets & PWA
├── ESP32_Gridbox_Station/ # Hardware-Firmware (C++)
└── package.json
```

---

## Live-Demo Ablauf

1. **App oeffnen** - PWA im Browser starten
2. **Karte anzeigen** - Stationen in der Umgebung sehen
3. **Station auswaehlen** - Details und Verfuegbarkeit pruefen
4. **QR-Code scannen** - Ausleihe starten
5. **Powerbank entnehmen** - Station gibt Powerbank aus
6. **Kosten live sehen** - Echtzeit-Berechnung
7. **Rueckgabe** - An beliebiger Station zurueckgeben
8. **Dashboard zeigen** - Betreiber-Ansicht mit Analytik

---

## Ausblick

- Erweiterung des Stationsnetzwerks
- Zahlungsintegration (Stripe, PayPal)
- Mehrsprachigkeit (EN, FR, ...)
- Treueprogramm und Rabatte
- Erweiterte Analytik mit KI-Vorhersagen
- Native App (React Native)
