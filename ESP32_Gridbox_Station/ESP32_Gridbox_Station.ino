#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== WLAN Konfiguration =====
const char* WIFI_SSID = "FRITZ!Box Lamborelle";
const char* WIFI_PASSWORD = "88929669398610508392";

// ===== Supabase Konfiguration =====
const char* SUPABASE_URL = "https://igrsoizvjyniuefyzzro.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncnNvaXp2anluaXVlZnl6enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjA1NzUsImV4cCI6MjA3NDEzNjU3NX0.Y-i6R1JSCLzLwVB07VNIb8pxmzmDoyRKzcFbk5bmups";

#define USE_SHORT_CODE true

const char* STATION_SHORT_CODE = "88SH";       // ← Dein 4-stelliger Station Code
const char* STATION_ID = "3cf6fe8a-a9af-4e73-8b42-4fc81f2c5500";  // ← UUID deiner Station (nur wenn USE_SHORT_CODE = false)

// ===== SENSOR KONFIGURATION =====
// SENSOREN DEAKTIVIERT - Nicht benötigt
#define USE_SENSORS false         // Alle Sensoren deaktiviert
#define TOTAL_SLOTS 8            // Anzahl Slots (für Zukunft)

// LED Pins
#define LED_PIN 2           // Eingebaute LED (wird bei Ausgabe aktiviert)
#define STATUS_LED_PIN 23   // Externe Status-LED (optional)

// LED Konfiguration
#define ENABLE_STATUS_BLINK false    // false = Kein Status-Blinken (nur bei Ausgabe), true = Normales Blinken
#define DISPENSE_LED_DURATION 5000   // LED leuchtet 5 Sekunden bei Ausgabe
#define DISPENSE_POLL_INTERVAL 2000  // Prüfe alle 2 Sekunden auf Ausgabe-Anfrage

// Update-Intervall
const unsigned long UPDATE_INTERVAL = 30000;  // 30 Sekunden

// ===== ENDE KONFIGURATION =====

// Globale Variablen
unsigned long lastUpdate = 0;
unsigned long lastDispenseCheck = 0;
unsigned long lastDispenseTime = 0;
int currentAvailableUnits = 0;
bool isConnected = false;
bool dispenseLEDActive = false;
unsigned long dispenseLEDStartTime = 0;

void setup() {
  // Serielle Kommunikation starten
  Serial.begin(115200);
  delay(2000);  // Längere Wartezeit für Serielle Verbindung
  
  Serial.println("\n\n╔═════════════════════════════════════════╗");
  Serial.println("║  Gridbox ESP32 Station Controller  ║");
  Serial.println("╚═════════════════════════════════════════╝");
  Serial.println();
  
  // LED-Konfiguration anzeigen
  Serial.println("LED-Konfiguration:");
  Serial.println("  Pin: " + String(LED_PIN));
  #if ENABLE_STATUS_BLINK
    Serial.println("  Status-Blinken: EIN (alle 1s)");
  #else
    Serial.println("  Status-Blinken: AUS (nur bei Ausgabe)");
  #endif
  Serial.println("  Ausgabe-Dauer: " + String(DISPENSE_LED_DURATION/1000) + " Sekunden");
  Serial.println();
  
  // Pins konfigurieren - SICHER initialisieren
  Serial.println("→ Initialisiere Pins...");
  
  // Nur LED_PIN am Anfang (sicher!)
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.println("✓ LED Pin " + String(LED_PIN) + " OK");
  delay(100);
  
  // Status-LED nur wenn nicht problematischer Pin
  if (STATUS_LED_PIN != 23) {  // Pin 23 kann problematisch sein
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("✓ Status LED Pin " + String(STATUS_LED_PIN) + " OK");
  } else {
    Serial.println("⚠️ Pin 23 übersprungen (kann problematisch sein)");
  }
  delay(100);
  
  // LED-Test
  Serial.println("→ LED Test...");
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("✓ LED Test erfolgreich");
  
  // Sensoren deaktiviert - Nicht benötigt
  Serial.println("ℹ️ Sensoren: DEAKTIVIERT (nicht benötigt)");
  
  // WLAN verbinden
  connectWiFi();
  
  // Initiale Station-Daten abrufen
  if (isConnected) {
    getStationData();
    
    // Synchronisiere total_units mit TOTAL_SLOTS Konfiguration
    syncTotalUnits();
  }
  
  Serial.println("\n=================================");
  Serial.println("Setup abgeschlossen!");
  Serial.println("=================================\n");
}

void loop() {
  // Prüfe WLAN-Verbindung
  if (WiFi.status() != WL_CONNECTED) {
    isConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("WLAN-Verbindung verloren. Versuche Reconnect...");
    connectWiFi();
    return;
  }
  
  // === DISPENSE LED STEUERUNG ===
  if (dispenseLEDActive) {
    // LED blinken während Ausgabe aktiv ist
    unsigned long elapsed = millis() - dispenseLEDStartTime;
    
    if (elapsed < DISPENSE_LED_DURATION) {
      // Schnelles Blinken (200ms an, 200ms aus)
      bool ledState = (millis() / 200) % 2;
      digitalWrite(LED_PIN, ledState);
      
      // Debug alle 2 Sekunden
      static unsigned long lastDispenseDebug = 0;
      if (millis() - lastDispenseDebug > 2000) {
        Serial.println("💡 LED blinkt... (noch " + String((DISPENSE_LED_DURATION - elapsed)/1000) + " Sekunden)");
        lastDispenseDebug = millis();
      }
    } else {
      // Zeit abgelaufen, LED ausschalten und Flag zurücksetzen
      digitalWrite(LED_PIN, LOW);
      dispenseLEDActive = false;
      Serial.println("✓ Ausgabe-LED deaktiviert nach " + String(DISPENSE_LED_DURATION/1000) + " Sekunden");
      Serial.println("→ LED ist jetzt AUS");
    }
  } else {
    // Normales Status-Blinken (nur wenn aktiviert)
    #if ENABLE_STATUS_BLINK
      static unsigned long lastBlink = 0;
      static bool blinkDebugShown = false;
      
      if (millis() - lastBlink > 1000) {
        digitalWrite(LED_PIN, HIGH);
        delay(50);
        digitalWrite(LED_PIN, LOW);
        lastBlink = millis();
        
        // Debug nur einmal anzeigen
        if (!blinkDebugShown) {
          Serial.println("ℹ️ Status-LED: Normales Blinken (alle 1s)");
          Serial.println("   Hinweis: Deaktiviere mit ENABLE_STATUS_BLINK = false");
          blinkDebugShown = true;
        }
      }
    #else
      // Kein Status-Blinken - LED bleibt aus
      digitalWrite(LED_PIN, LOW);
    #endif
  }
  
  // === PRÜFE AUF AUSGABE-ANFRAGE ===
  if (millis() - lastDispenseCheck > DISPENSE_POLL_INTERVAL) {
    checkDispenseRequest();
    lastDispenseCheck = millis();
  }
  
  // SENSOREN DEAKTIVIERT - Keine automatischen Updates
  // Die Anzahl wird nur durch die Web-App geändert (bei Ausleihe)
  
  // Regelmäßiger Status-Check alle UPDATE_INTERVAL Millisekunden
  if (millis() - lastUpdate > UPDATE_INTERVAL) {
    Serial.println("\n--- Status-Check (ohne Sensor-Update) ---");
    getStationData();
    lastUpdate = millis();
  }
  
  delay(1000);  // Schleife jede Sekunde
}

// ===== WLAN FUNKTIONEN =====

void connectWiFi() {
  Serial.println("Verbinde mit WLAN...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));  // LED blinken
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WLAN verbunden!");
    Serial.print("IP Adresse: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Stärke: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    isConnected = true;
    digitalWrite(STATUS_LED_PIN, HIGH);  // LED dauerhaft an
  } else {
    Serial.println("\n✗ WLAN-Verbindung fehlgeschlagen!");
    isConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}

// ===== SUPABASE FUNKTIONEN =====

void getStationData() {
  if (!isConnected) return;
  
  HTTPClient http;
  
  // URL bauen (nutze Short-Code oder UUID)
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  // Nutze Short-Code oder UUID basierend auf Konfiguration
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
    Serial.println("Verwende Short-Code: " + String(STATION_SHORT_CODE));
  #else
    url += "id=eq." + String(STATION_ID);
    Serial.println("Verwende UUID: " + String(STATION_ID));
  #endif
  
  Serial.println("\n→ GET Station Data");
  Serial.println("URL: " + url);
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    // JSON parsen
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      Serial.println("✗ JSON Parse Fehler: " + String(error.c_str()));
      http.end();
      return;
    }
    
    if (doc.is<JsonArray>() && doc.size() > 0) {
      JsonObject station = doc[0];
      
      String name = station["name"] | "N/A";
      int availableUnits = station["available_units"] | 0;
      int totalUnits = station["total_units"] | 0;
      bool isActive = station["is_active"] | true;
      String shortCode = station["short_code"] | "N/A";
      
      Serial.println("✓ Station gefunden!");
      Serial.println("  Name: " + name);
      Serial.println("  Short-Code: " + shortCode);
      Serial.println("  Verfügbar: " + String(availableUnits) + "/" + String(totalUnits));
      Serial.println("  Aktiv: " + String(isActive ? "Ja" : "Nein"));
      
      currentAvailableUnits = availableUnits;
    } else {
      Serial.println("✗ Station nicht in Datenbank gefunden!");
      Serial.println("  Prüfe STATION_ID oder STATION_SHORT_CODE");
    }
  } else {
    Serial.println("✗ HTTP Fehler: " + String(httpCode));
    Serial.println("  Response: " + http.getString());
  }
  
  http.end();
}

void updateAvailableUnits(int units) {
  if (!isConnected) return;
  
  HTTPClient http;
  
  // URL bauen
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  
  Serial.println("\n→ UPDATE Available Units: " + String(units));
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  // JSON Body erstellen
  DynamicJsonDocument doc(256);
  doc["available_units"] = units;
  doc["updated_at"] = "now()";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("Body: " + jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200 || httpCode == 201) {
    Serial.println("✓ Update erfolgreich!");
    lastReportedUnits = units;
  } else {
    Serial.println("✗ Update Fehler: " + String(httpCode));
    Serial.println("  Response: " + http.getString());
  }
  
  http.end();
}

// ===== AUSGABE-SYSTEM (DISPENSE) =====

void checkDispenseRequest() {
  if (!isConnected) return;
  
  HTTPClient http;
  
  // URL bauen
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  
  url += "&select=dispense_requested";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    // JSON parsen
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error && doc.is<JsonArray>() && doc.size() > 0) {
      JsonObject station = doc[0];
      bool dispenseRequested = station["dispense_requested"] | false;
      
      if (dispenseRequested) {
        // Prüfe ob wir schon kürzlich eine Ausgabe hatten (Debounce)
        unsigned long timeSinceLastDispense = millis() - lastDispenseTime;
        
        if (timeSinceLastDispense > 10000) {  // Mindestens 10 Sekunden zwischen Ausgaben
          // 🎉 AUSGABE-ANFRAGE ERKANNT!
          Serial.println("\n🚨🚨🚨 AUSGABE-ANFRAGE ERKANNT! 🚨🚨🚨");
          Serial.println("Powerbank-Ausgabe wurde über die App angefordert!");
          
          // Merke Zeitpunkt
          lastDispenseTime = millis();
          
          // ZUERST Flag in Datenbank zurücksetzen (wichtig!)
          resetDispenseFlag();
          
          // DANN LED aktivieren
          activateDispenseLED();
        } else {
          Serial.println("⚠️ Ausgabe-Anfrage ignoriert (zu kurz nach letzter Ausgabe: " + String(timeSinceLastDispense/1000) + "s)");
        }
      }
    }
  }
  
  http.end();
}

void activateDispenseLED() {
  Serial.println("\n💡 LED-AUSGABE AKTIVIERT!");
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║  LED blinkt für " + String(DISPENSE_LED_DURATION / 1000) + " Sekunden      ║");
  Serial.println("║  Pin: " + String(LED_PIN) + "                            ║");
  Serial.println("║  Modus: Schnelles Blinken (200ms)   ║");
  Serial.println("╚══════════════════════════════════════╝");
  
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Erster Blink sofort
  digitalWrite(LED_PIN, HIGH);
  Serial.println("→ LED AN (Start)");
  
  // Optionales Signal (z.B. Piezo-Buzzer, Servo-Motor, etc.)
  // TODO: Hier kannst du zusätzliche Hardware ansteuern:
  // - Servo-Motor für mechanische Ausgabe
  // - Solenoid zum Entriegeln
  // - Buzzer für akustisches Signal
  // Beispiel:
  // digitalWrite(SERVO_PIN, HIGH);
  // myServo.write(90);
}

void resetDispenseFlag() {
  if (!isConnected) return;
  
  Serial.println("→ Setze dispense_requested Flag zurück...");
  
  HTTPClient http;
  
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  // Setze dispense_requested zurück und aktualisiere last_dispense_time
  DynamicJsonDocument doc(256);
  doc["dispense_requested"] = false;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("   Body: " + jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200 || httpCode == 204) {
    Serial.println("✓ Ausgabe-Flag erfolgreich zurückgesetzt in Datenbank");
  } else {
    Serial.println("⚠️ Fehler beim Zurücksetzen!");
    Serial.println("   HTTP Code: " + String(httpCode));
    Serial.println("   Response: " + http.getString());
  }
  
  http.end();
  
  // Kurze Pause damit Datenbank Zeit hat zu aktualisieren
  delay(500);
}

// ===== SENSOR FUNKTIONEN =====
// SENSOREN DEAKTIVIERT - Nicht benötigt

// Diese Funktion wird nicht mehr verwendet
// Die available_units werden nur durch die Web-App verwaltet
// (Bei Ausleihe: -1, Bei Rückgabe: +1)

void syncTotalUnits() {
  if (!isConnected) return;
  
  HTTPClient http;
  
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(256);
  doc["total_units"] = TOTAL_SLOTS;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200 || httpCode == 201) {
    Serial.println("✓ Total Units synchronisiert: " + String(TOTAL_SLOTS));
  }
  
  http.end();
}

// ===== HILFSFUNKTIONEN =====

void printDebugInfo() {
  Serial.println("\n=== DEBUG INFO ===");
  Serial.println("WLAN Status: " + String(WiFi.status() == WL_CONNECTED ? "Verbunden" : "Getrennt"));
  Serial.println("IP: " + WiFi.localIP().toString());
  Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("Uptime: " + String(millis() / 1000) + " Sekunden");
  Serial.println("==================\n");
}

