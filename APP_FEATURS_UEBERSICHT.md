# GridBox App - Feature Uebersicht

Dieses Dokument beschreibt die Funktionen der GridBox PWA im Detail und erklaert den Unterschied zwischen der normalen Nutzer-App und dem Owner-Dashboard.

## 1. Kurzueberblick

GridBox ist eine PWA zur Verwaltung und Nutzung von Powerbank-Stationen. Die App verbindet drei Kernbereiche:

- Nutzer konnen Stationen auf einer Karte finden, scannen, ausleihen, zurueckgeben und ihr Guthaben verwalten.
- Betreiber koennen im Dashboard Stationen, Ausleihen, Nutzer, Auswertungen und die Hilfeseite verwalten.
- Die Stationen selbst kommunizieren ueber ESP32, Realtime und Supabase mit der App.

## 2. Hauptfunktionen der normalen App

Die normale App ist der Bereich fuer Endnutzer. Sie startet im Kern mit der Kartenansicht und fuehrt zu allen Funktionen, die fuer die Ausleihe und Rueckgabe benoetigt werden.

### 2.1 Kartenansicht und Stationssuche

- Anzeige aller aktiven Stationen auf einer interaktiven Karte.
- Darstellung der Stationen mit Standort, Verfugbarkeit und Status.
- Live-Orientierung an der aktuellen Nutzerposition, wenn Standortfreigabe erlaubt ist.
- Zentrierung auf den eigenen Standort, um nahe Stationen schneller zu finden.
- Auswahl einer Station direkt auf der Karte oder aus der Stationsliste.
- Anzeige von Fotos der Stationen, falls vorhanden.
- Unterstuetzung fuer Navigation zu einer Station mit Wegbeschreibung.

### 2.2 QR-Code- und Code-Scan

- Scannen von QR-Codes an Stationen mit der Kamera.
- Erkennen von Stations-IDs aus QR-Links oder stationseigenen Codes.
- Alternative manuelle Eingabe eines Stationscodes.
- Schutz vor mehrfachen Scannerfassungen desselben Codes in kurzer Zeit.
- Kamera-Overlay mit direkter Rueckmeldung beim erfolgreichen Scan.

### 2.3 Ausleihe einer Powerbank

- Ausloesen einer Ausleihe ueber die gewaehlte Station.
- Bestätigung der Ausleihe mit Rueckmeldung ueber Erfolg oder Fehler.
- Verknuepfung mit Wallet und Transaktionssystem.
- Anzeige der aktiven Ausleihe inklusive Startzeit und laufender Kosten.
- Unterstuetzung fuer stationenbezogene Preise und Rueckgabe-Logik.

### 2.4 Rueckgabe einer Powerbank

- Rueckgabe an einer beliebigen GridBox-Station, nicht nur an der Ausleihstation.
- Automatische Erkennung einer Rueckgabe, wenn die Powerbank wieder im Slot erscheint.
- Anzeige einer Rueckgabe-Bestaetigung und Zusammenfassung.
- Unterstuetzung fuer Auto-Return-Logik ueber Datenbank-Trigger.

### 2.5 Wallet

- Anzeigen des aktuellen Guthabens.
- Aufladen des Wallets mit vordefinierten oder freien Betraegen.
- Anzeige der letzten Transaktionen.
- Anzeige einer aktiven Ausleihe inklusive Live-Laufzeit.
- Automatisches Nachladen der Daten, wenn sich der Ausleihstatus aendert.

### 2.6 Verlauf

- Vollstaendige Liste aller Transaktionen des Nutzers.
- Historie von Aufladungen, Ausleihen und Rueckgaben.
- Zeitangaben mit lesbarer Formatierung wie heute, gestern oder vor X Tagen.
- Visuelle Unterscheidung zwischen positiven und negativen Buchungen.

### 2.7 Reservierung

- Reservierung einer Station fuer eine spaetere Nutzung.
- Schrittweise Fuehrung durch Station waehlen, Zeit waehlen und bestaetigen.
- Anzeige verfuegbarer Stationen mit Distanzberechnung zur eigenen Position.
- Kartenansicht zur Visualisierung der reservierten Station.
- Abbruch einer aktiven Reservierung.
- Sperrung eines Slots, wenn der Termin kurzfristig bevorsteht.

### 2.8 Hilfe und Support

- Oeffentliche Hilfeseite mit FAQ und Supportdaten.
- Inhalte koennen dynamisch aus der Datenbank geladen und zentral gepflegt werden.
- Anzeige von Kontaktwegen wie E-Mail, Telefon und Notfallkontakt.
- FAQ-Bereich fuer typische Fragen zur Nutzung.

### 2.9 Authentifizierung und Benutzerkonto

- Login fuer Nutzer mit Authentifizierung ueber Supabase.
- Weiterleitung zu geschuetzten Bereichen nur bei aktiver Anmeldung.
- Onboarding und Callback-Fluss fuer Anmeldung und Rueckkehr in die App.
- Profilseite fuer persoenliche Konten- oder Nutzerdaten.

## 3. Detail: Was die normale App aus Nutzersicht leistet

Die normale App ist fuer die direkte Produktnutzung gedacht. Sie beantwortet fuer den Nutzer vor allem diese Fragen:

- Wo ist die naechste Station?
- Wie scanne ich die Station?
- Wie leihe ich eine Powerbank aus?
- Wie behalte ich mein Guthaben im Blick?
- Wie sehe ich meine Ausgaben und Rueckgaben?
- Wie reserviere ich eine Station im Voraus?
- Wie bekomme ich Hilfe, wenn etwas nicht funktioniert?

Die App ist damit stark auf Bedienung, Mobilitaet, Scan-Prozesse, Karte, Wallet und Kundenfluss ausgelegt.

## 4. Hauptfunktionen des Dashboard

Das Dashboard ist die Betreiber- und Verwaltungsoberflaeche. Es ist nicht fuer die eigentliche Ausleihe gedacht, sondern fuer Kontrolle, Pflege und Auswertung des Systems.

### 4.1 Uebersicht

- Gesamtstatus der Stationen und Auslastung.
- Anzeige von Online- und Offline-Stationen.
- Anzeige der aktuellen Systemverbindung und des letzten Updates.
- Schnellzugriff auf aktive Ausleihen.
- Kennzahlen zu Powerbanks, belegten Slots und durchschnittlicher Batterie.

### 4.2 Stationen verwalten

- Anzeigen aller Stationen mit Filtermoeglichkeiten.
- Stationen anlegen.
- Stationen bearbeiten.
- Stationen deaktivieren oder loeschen.
- Anzeige von Standortdaten, Verfugbarkeit und Statuswerten.
- Unterstuetzung fuer Fotos, Oeffnungszeiten und Short-Codes.
- Umgang mit Dual-Slot-Stationen und Legacy-Daten.

### 4.3 Nutzer verwalten

- Anzeige und Suche nach Nutzern.
- Rollenverwaltung fuer Nutzer.
- Unterscheidung zwischen normalen Nutzern, Ownern und Admins.
- Verwaltung von Zugriffen und Berechtigungen.

### 4.4 Transaktionen und Ausleihen

- Uebersicht ueber aktive und abgeschlossene Ausleihen.
- Filter nach Station, Status und Suchbegriff.
- Umsatz- und Buchungsdaten fuer einzelne Stationen.
- Analyse von offenen und abgeschlossenen Vorgangen.
- Paginierung fuer groeßere Datensaetze.

### 4.5 Analytics und Auswertung

- Diagramme und Kennzahlen zu Umsatz und Nutzung.
- Zeitraeume wie 7, 14, 30 oder 90 Tage.
- Top-Stationen und Verteilung von Ausleihen.
- Umsatz nach Tag, Station und Zeitraum.
- Statistische Betrachtung von Nutzung und Performance.

### 4.6 Hilfeseite verwalten

- Bearbeiten der oeffentlichen Hilfeseite direkt aus dem Dashboard.
- Aendern von Titel, Untertitel und Supportdaten.
- Bearbeiten und Ergaenzen von FAQ-Eintraegen.
- Vorschau der Hilfeseiten-Inhalte vor dem Speichern.
- Zentrale Pflege ohne separates Content-Tool.

### 4.7 Realtime- und Live-Status

- Live-Updates fuer Stationsdaten und Auslastung.
- Anzeigen, ob Realtime aktiv oder nur Offline-Daten vorhanden sind.
- Schneller Wechsel zwischen Tabs ohne wiederholtes Voll-Laden.
- Stabile Aktualisierung der Verwaltungsdaten.

## 5. Unterschied zwischen Dashboard und normaler App

Der wichtigste Unterschied ist die Zielgruppe und der Zweck.

### 5.1 Normale App

Die normale App ist fuer Endnutzer gedacht. Sie ist auf die Bedienung im Alltag ausgerichtet und konzentriert sich auf:

- Station finden
- scannen
- ausleihen
- aufladen
- rueckgeben
- reservationen verwalten
- wallet und verlauf pruefen
- hilfe abrufen

Sie ist damit ein Nutzungs-Frontend fuer das eigentliche Produkt.

### 5.2 Dashboard

Das Dashboard ist fuer Betreiber und Verwaltung gedacht. Es dient dazu, das System im Hintergrund zu steuern und auszuwerten:

- Stationen pflegen
- Nutzer und Rollen verwalten
- Ausleihen und Transaktionen ueberblicken
- Auslastung und Umsatz analysieren
- Hilfeseite bearbeiten
- Realtime-Zustaende beobachten

Es ist damit ein Verwaltungs- und Analyse-Frontend.

### 5.3 Praktischer Unterschied im Ablauf

In der normalen App fragt der Nutzer:

- Wo kann ich eine Powerbank bekommen?
- Wie scanne ich die Station?
- Wie viel Guthaben habe ich?
- Wo kann ich die Powerbank zurueckgeben?

Im Dashboard fragt der Betreiber:

- Welche Station ist online?
- Wie viele Slots sind belegt?
- Welche Stationen brauchen Wartung?
- Welche Nutzer haben welche Rolle?
- Wie hoch ist der Umsatz?
- Welche FAQ sollen auf der Hilfeseite stehen?

## 6. Technische Kernfunktionen im Hintergrund

Auch wenn dies fuer Nutzer nicht direkt sichtbar ist, gehoert es zu den wichtigsten App-Features.

- Supabase als Datenbasis fuer Stationen, Wallets, Transaktionen, Reservierungen und Rollen.
- Realtime-Updates fuer schnellere Statusaenderungen.
- API-Routen fuer die ESP32-Stationen.
- Authentifizierung und Zugriffsschutz fuer geschuetzte Bereiche.
- Kamera-Scan fuer QR-Code-gestuetzte Ausleihe.
- Karten- und Routenfunktion fuer Standort und Navigation.
- Unterstuetzung fuer Dual-Slot-Stationen und automatische Verfuegbarkeitsberechnung.

## 7. Besondere Merkmale der Stationen

Die Stationen selbst sind ein eigener Teil des Systems.

- ESP32-Anbindung fuer Kommunikation mit der App.
- Herzschlag- und Statusdaten zur Online-Erkennung.
- Batterie- und Slot-Daten fuer einzelne Faecher.
- Automatische Erkennung von Powerbank-Status und Verfuegbarkeit.
- Unterstuetzung fuer Ladeaktivierung ueber Relais.
- Automatische Rueckgabe, wenn eine Powerbank wieder eingesetzt wird.
- QR- und Short-Code-Unterstuetzung fuer stationeigenen Zugriff.

## 8. Zusammenfassung

GridBox besteht aus einer Nutzer-App und einem Dashboard. Die Nutzer-App ist fuer die direkte Nutzung der Powerbank-Stationen gedacht und deckt Karte, Scan, Ausleihe, Rueckgabe, Wallet, Verlauf, Reservierung und Hilfe ab. Das Dashboard ist die Verwaltungsoberflaeche fuer Betreiber mit Stationen, Nutzern, Auswertungen, Transaktionen, Realtime-Status und Pflege der Hilfeseite.

Wenn du willst, kann ich dir als Nächstes noch eine zweite Version machen, die eher wie eine saubere Projekt-Dokumentation oder wie eine kurze Bedienungsanleitung formuliert ist.
