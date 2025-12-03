#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

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

// ===== BATTERIE KONFIGURATION =====
#define TCA9548A_ADDRESS 0x70     // I2C Adresse des TCA9548A Multiplexers
#define BQ27441_ADDRESS 0x55      // I2C Adresse des BQ27441 Fuel Gauge
#define BATTERY_CHANNEL 0         // Kanal des Multiplexers für den Fuel Gauge (0-7)
#define BATTERY_UPDATE_INTERVAL 2000  // Batteriedaten alle 2 Sekunden aktualisieren (schnelle Updates)
#define BATTERY_TEST_MODE false   // true = Test-Modus ohne Hardware (verwendet Dummy-Daten)

// BQ27441 Register
#define REG_VOLTAGE 0x04     // Spannung (mV)
#define REG_SOC     0x1C     // Ladezustand (%)

// LED Pins
#define LED_PIN 2           // Eingebaute LED (wird bei Ausgabe aktiviert)
#define STATUS_LED_PIN 23   // Externe Status-LED (optional)

// LED Konfiguration
#define ENABLE_STATUS_BLINK false    // false = Kein Status-Blinken (nur bei Ausgabe), true = Normales Blinken
#define ENABLE_DISPENSE_LED false    // Deaktiviert das Blinksignal bei Ausleihe (war nur ein Test)
#define DISPENSE_LED_DURATION 5000   // LED leuchtet 5 Sekunden bei Ausgabe
#define DISPENSE_POLL_INTERVAL 2000  // Prüfe alle 2 Sekunden auf Ausgabe-Anfrage

// Relais & Button Konfiguration
#define RELAY_PIN 5                 // Kontrolliert das Lade-Relais (Pin 17 = funktionierender Relais-Pin aus Testskript)
#define RELAY_ACTIVE_LOW false       // true = LOW aktiviert Relais, false = HIGH aktiviert Relais
                                      // Dein Relais schaltet bei HIGH (siehe funktionierendes Testskript)
#define CHARGE_BUTTON_PIN 33         // Taster zum Ein-/Ausschalten des Ladevorgangs
#define BUTTON_DEBOUNCE_MS 200       // Entprellzeit
#define BATTERY_PRESENT_THRESHOLD 3.2  // ≥3.2V = Batterie erkannt
#define REQUIRE_BATTERY_FOR_RELAY true  // false = Relais funktioniert auch ohne Batterie (für Tests)

// Update-Intervalle
const unsigned long UPDATE_INTERVAL = 2000;  // 2 Sekunden (Status-Check für schnelle Updates)

// ===== ENDE KONFIGURATION =====

// Globale Variablen
unsigned long lastUpdate = 0;
unsigned long lastDispenseCheck = 0;
unsigned long lastDispenseTime = 0;
int currentAvailableUnits = 0;
int lastReportedUnits = -1;
bool isConnected = false;
bool dispenseLEDActive = false;
unsigned long dispenseLEDStartTime = 0;
const uint8_t RELAY_ON_STATE = RELAY_ACTIVE_LOW ? LOW : HIGH;
const uint8_t RELAY_OFF_STATE = RELAY_ACTIVE_LOW ? HIGH : LOW;
bool chargeEnabled = true;  // Lokaler Button-Status
bool chargeEnabledFromWeb = true;  // Status aus Supabase
bool batteryPresent = false;
bool lastButtonState = HIGH;
bool stableButtonState = HIGH;
unsigned long lastButtonChange = 0;
bool relayCurrentlyOn = false;
bool firstDataReceived = false;  // Flag für initiales Relais-Update

// Batterie Variablen
unsigned long lastBatteryUpdate = 0;
float batteryVoltage = 0.0;
int batteryPercentage = 0;
bool batteryInitialized = false;

// Funktionsprototypen
void handleChargeButton();
void updateChargingState();
void evaluateBatteryPresence();

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
  
  // I2C initialisieren (ESP32 Standard Pins: SDA=21, SCL=22)
  Serial.println("→ Initialisiere I2C...");
  Wire.begin(21, 22);
  delay(100);
  Serial.println("✓ I2C initialisiert (SDA=21, SCL=22)");
  
  // Batterie-System initialisieren
  Serial.println("→ Initialisiere Batterie-System...");
  #if BATTERY_TEST_MODE
    Serial.println("  ⚠️ TEST-MODUS: Verwende Dummy-Batteriedaten");
    batteryInitialized = true;
    batteryVoltage = 3.70;
    batteryPercentage = 85;
    evaluateBatteryPresence();
  #else
    if (initBatterySystem()) {
      Serial.println("✓ Batterie-System initialisiert");
      batteryInitialized = true;
    } else {
      Serial.println("⚠️ Batterie-System konnte nicht initialisiert werden");
      Serial.println("   Hinweis: Setze BATTERY_TEST_MODE = true zum Testen ohne Hardware");
      batteryInitialized = false;
      batteryPresent = false;
      updateChargingState();
    }
  #endif
  
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

  // Relais & Button initialisieren
  Serial.println("→ Initialisiere Relais...");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF_STATE);
  relayCurrentlyOn = false;
  Serial.println("✓ Relais Pin " + String(RELAY_PIN) + " (Ausgang, sicher AUS)");
  Serial.println("  RELAY_ON_STATE = " + String(RELAY_ON_STATE == LOW ? "LOW" : "HIGH"));
  Serial.println("  RELAY_OFF_STATE = " + String(RELAY_OFF_STATE == LOW ? "LOW" : "HIGH"));
  
  // Relais-Test: Kurz ein- und ausschalten
  Serial.println("  → Relais-Test: EIN für 1 Sekunde...");
  Serial.println("     Prüfe ob Relais hörbar/visuell aktiviert wird!");
  digitalWrite(RELAY_PIN, RELAY_ON_STATE);
  Serial.println("     Pin " + String(RELAY_PIN) + " = " + String(RELAY_ON_STATE == LOW ? "LOW" : "HIGH"));
  delay(1000);
  digitalWrite(RELAY_PIN, RELAY_OFF_STATE);
  Serial.println("  → Relais-Test: AUS");
  Serial.println("     Pin " + String(RELAY_PIN) + " = " + String(RELAY_OFF_STATE == LOW ? "LOW" : "HIGH"));
  Serial.println("  ⚠️ Falls Relais nicht funktioniert, ändere RELAY_ACTIVE_LOW auf false");
  delay(200);

  pinMode(CHARGE_BUTTON_PIN, INPUT_PULLUP);
  lastButtonState = digitalRead(CHARGE_BUTTON_PIN);
  stableButtonState = lastButtonState;
  Serial.println("✓ Lade-Taster an Pin " + String(CHARGE_BUTTON_PIN) + " (INPUT_PULLUP)");
  Serial.println("  → Taste gedrückt = LOW");
  
  // Initialisiere chargeEnabledFromWeb mit true (wird beim ersten getStationData() aktualisiert)
  chargeEnabledFromWeb = true;
  chargeEnabled = true;
  
  Serial.println("→ Initialer Relais-Status:");
  updateChargingState();
  
  // Sensoren deaktiviert - Nicht benötigt
  Serial.println("ℹ️ Sensoren: DEAKTIVIERT (nicht benötigt)");
  
  // WLAN verbinden
  connectWiFi();
  
  // Initiale Station-Daten abrufen
  if (isConnected) {
    getStationData();
    
    // Synchronisiere total_units mit TOTAL_SLOTS Konfiguration
    syncTotalUnits();
    
    // Sende initiale Batterie-Daten sofort (falls vorhanden)
    if (batteryInitialized) {
      Serial.println("\n→ Sende initiale Batterie-Daten...");
      #if !BATTERY_TEST_MODE
        readBatteryData();
      #endif
      updateBatteryData();
      lastBatteryUpdate = millis(); // Setze Timer zurück
    }
  }
  
  Serial.println("\n=================================");
  Serial.println("Setup abgeschlossen!");
  Serial.println("=================================\n");
}

void loop() {
  handleChargeButton();
  
  // Prüfe WLAN-Verbindung
  if (WiFi.status() != WL_CONNECTED) {
    isConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("WLAN-Verbindung verloren. Versuche Reconnect...");
    connectWiFi();
    return;
  }
  
  // === DISPENSE LED STEUERUNG ===
  #if ENABLE_DISPENSE_LED
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
    }
  #endif

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
  
  // Batteriedaten regelmäßig aktualisieren
  if (millis() - lastBatteryUpdate > BATTERY_UPDATE_INTERVAL) {
    if (batteryInitialized) {
      #if BATTERY_TEST_MODE
        // Test-Modus: Simuliere leicht variierende Batteriedaten
        batteryVoltage = 3.65 + (random(0, 20) / 100.0);  // 3.65 - 3.85 V
        batteryPercentage = 80 + random(-5, 10);  // 75 - 90%
        if (batteryPercentage > 100) batteryPercentage = 100;
        if (batteryPercentage < 0) batteryPercentage = 0;
        evaluateBatteryPresence();
        Serial.println("\n--- Batteriedaten (TEST-MODUS) ---");
        Serial.println("Spannung: " + String(batteryVoltage, 2) + " V");
        Serial.println("Prozent: " + String(batteryPercentage) + " %");
      #else
        readBatteryData();
      #endif
      updateBatteryData();
    } else {
      // Versuche erneut zu initialisieren, falls es beim Start fehlgeschlagen ist
      Serial.println("\n→ Versuche Batterie-System erneut zu initialisieren...");
      if (initBatterySystem()) {
        Serial.println("✓ Batterie-System jetzt initialisiert!");
        batteryInitialized = true;
      } else {
        Serial.println("⚠️ Batterie-System immer noch nicht verfügbar");
        Serial.println("   Prüfe Hardware-Verbindungen:");
        Serial.println("   - TCA9548A an I2C (SDA=21, SCL=22)");
        Serial.println("   - BQ27441 an TCA9548A Kanal " + String(BATTERY_CHANNEL));
        Serial.println("   Oder setze BATTERY_TEST_MODE = true zum Testen ohne Hardware");
        batteryPresent = false;
        updateChargingState();
      }
    }
    lastBatteryUpdate = millis();
  }
  
  delay(100);  // Schneller, damit der Button zuverlässig erkannt wird
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
    
    // DEBUG: Zeige Antwort
    Serial.println("\n📥 RAW Response:");
    Serial.println("Length: " + String(payload.length()) + " bytes");
    Serial.println("Content: " + payload);
    Serial.println("---");
    
    // Prüfe ob Antwort leer ist
    if (payload.length() == 0) {
      Serial.println("✗ Fehler: Leere Antwort von Supabase!");
      http.end();
      return;
    }
    
    // JSON parsen
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      Serial.println("✗ JSON Parse Fehler: " + String(error.c_str()));
      Serial.println("   Ist das wirklich JSON? Prüfe Response oben!");
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
      bool chargeEnabledWeb = station["charge_enabled"] | true;  // Default: true wenn nicht gesetzt
      
      Serial.println("✓ Station gefunden!");
      Serial.println("  Name: " + name);
      Serial.println("  Short-Code: " + shortCode);
      Serial.println("  Verfügbar: " + String(availableUnits) + "/" + String(totalUnits));
      Serial.println("  Aktiv: " + String(isActive ? "Ja" : "Nein"));
      Serial.println("  📱 Laden (Web): " + String(chargeEnabledWeb ? "EIN ✓" : "AUS ✗"));
      
      // Aktualisiere Web-Status und Relais
      bool statusChanged = (chargeEnabledWeb != chargeEnabledFromWeb);
      chargeEnabledFromWeb = chargeEnabledWeb;
      
      // Beim ersten Empfang oder bei Änderung: Relais aktualisieren
      if (!firstDataReceived || statusChanged) {
        if (!firstDataReceived) {
          Serial.println();
          Serial.println("🎯 Erster Daten-Empfang - Initialisiere Relais...");
          firstDataReceived = true;
        } else {
          Serial.println();
          Serial.println("🔄 Web-Schalter geändert!");
          Serial.println("  Alt: " + String(!chargeEnabledWeb ? "EIN" : "AUS"));
          Serial.println("  Neu: " + String(chargeEnabledWeb ? "EIN" : "AUS"));
        }
        updateChargingState();
      }
      
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
  #if !ENABLE_DISPENSE_LED
    Serial.println("ℹ️ Ausleihe bestätigt – LED-Blinken deaktiviert");
    return;
  #endif

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

// ===== LADE-STEUERUNG (RELAIS & BUTTON) =====

void handleChargeButton() {
  bool reading = digitalRead(CHARGE_BUTTON_PIN);

  if (reading != lastButtonState) {
    lastButtonChange = millis();
  }

  if ((millis() - lastButtonChange) > BUTTON_DEBOUNCE_MS) {
    if (reading != stableButtonState) {
      stableButtonState = reading;
      if (stableButtonState == LOW) {
        chargeEnabled = !chargeEnabled;
        Serial.println("\n🔘 BUTTON GEDRÜCKT!");
        Serial.println(chargeEnabled ? "⚡️ Laden per Taste AKTIVIERT" : "⛔️ Laden per Taste DEAKTIVIERT");
        Serial.println("  Button-Status: " + String(chargeEnabled ? "EIN" : "AUS"));
        Serial.println("  Web-Status: " + String(chargeEnabledFromWeb ? "EIN" : "AUS"));
        Serial.println("  Batterie erkannt: " + String(batteryPresent ? "JA" : "NEIN"));
        if (batteryPresent) {
          Serial.println("  Batteriespannung: " + String(batteryVoltage, 2) + " V");
        }
        updateChargingState();
      }
    }
  }

  lastButtonState = reading;
}

void updateChargingState() {
  // Relais-Logik:
  // 1. Web-Schalter AUS → Relais IMMER AUS (höchste Priorität)
  // 2. Web-Schalter EIN → Relais hängt von Button & Batterie ab
  
  bool shouldCharge = false;
  String reason = "";
  
  // Prüfe Web-Schalter zuerst (Master-Switch)
  if (!chargeEnabledFromWeb) {
    // Web-Schalter ist AUS → Relais muss AUS sein
    shouldCharge = false;
    reason = "Web-Schalter AUS";
  } else {
    // Web-Schalter ist EIN → Prüfe lokale Bedingungen
    if (!chargeEnabled) {
      // Lokaler Button ist AUS
      shouldCharge = false;
      reason = "Lokaler Button AUS";
    } else {
      // Button ist EIN → Prüfe Batterie (falls erforderlich)
      if (REQUIRE_BATTERY_FOR_RELAY && !batteryPresent) {
        shouldCharge = false;
        reason = "Keine Batterie erkannt";
      } else {
        // Alles grün → Relais EIN
        shouldCharge = true;
        reason = "Alle Bedingungen erfüllt";
      }
    }
  }
  
  // Debug-Ausgabe
  Serial.println("\n--- Relais-Status Update ---");
  Serial.println("  📱 Web-Schalter: " + String(chargeEnabledFromWeb ? "EIN ✓" : "AUS ✗"));
  Serial.println("  🔘 Lokaler Button: " + String(chargeEnabled ? "EIN ✓" : "AUS ✗"));
  Serial.println("  🔋 Batterie: " + String(batteryPresent ? "ERKANNT ✓" : "NICHT ERKANNT ✗"));
  if (batteryPresent) {
    Serial.println("     Spannung: " + String(batteryVoltage, 2) + " V");
  }
  Serial.println();
  Serial.println("  💡 Entscheidung: " + reason);
  Serial.println("  ⚡ Relais soll: " + String(shouldCharge ? "EIN" : "AUS"));
  Serial.println("  ⚡ Relais aktuell: " + String(relayCurrentlyOn ? "EIN" : "AUS"));
  
  // Prüfe ob Änderung nötig
  if (shouldCharge == relayCurrentlyOn) {
    Serial.println("  → Keine Änderung nötig");
    return;
  }

  // Ändere Relais-Status
  relayCurrentlyOn = shouldCharge;
  uint8_t desiredState = shouldCharge ? RELAY_ON_STATE : RELAY_OFF_STATE;

  Serial.println();
  Serial.println("  🔧 Schalte Relais...");
  Serial.println("  → Pin " + String(RELAY_PIN) + " = " + String(desiredState == LOW ? "LOW" : "HIGH"));
  digitalWrite(RELAY_PIN, desiredState);

  if (shouldCharge) {
    Serial.println("  ✅ RELAIS EIN - Laden aktiv");
  } else {
    Serial.println("  ⛔️ RELAIS AUS - " + reason);
  }
  Serial.println("--- Ende Relais-Update ---\n");
}

void evaluateBatteryPresence() {
  bool previousState = batteryPresent;
  batteryPresent = batteryVoltage >= BATTERY_PRESENT_THRESHOLD;

  if (batteryPresent != previousState) {
    if (batteryPresent) {
      Serial.println("✅ Batterieanschluss erkannt (Spannung ≥ " + String(BATTERY_PRESENT_THRESHOLD, 1) + "V)");
    } else {
      Serial.println("❌ Batterie entfernt oder zu geringe Spannung");
    }
    updateChargingState();
  }
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

// ===== BATTERIE FUNKTIONEN =====

// TCA9548A Multiplexer - Wähle I2C Kanal (genau wie im funktionierenden Code)
void selectI2CChannel(uint8_t channel) {
  if (channel > 7) return;
  
  Wire.beginTransmission(TCA9548A_ADDRESS);
  Wire.write(1 << channel);  // Aktiviert genau EINEN Kanal
  Wire.endTransmission();
  delay(10);  // Kurze Pause für Multiplexer
}

// BQ27441 Fuel Gauge - Lese 16-Bit Register (genau wie im funktionierenden Code)
uint16_t readBQ27441Register(uint8_t reg) {
  Wire.beginTransmission(BQ27441_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return 0;  // Fehler auf dem Bus
  }
  
  // Wichtig: klare Typen → kein Compiler-Warning (genau wie im funktionierenden Code)
  Wire.requestFrom((uint16_t)BQ27441_ADDRESS, (uint8_t)2);
  
  if (Wire.available() < 2) {
    return 0;
  }
  
  uint16_t value = Wire.read();
  value |= (Wire.read() << 8);
  return value;
}

// BQ27441 Fuel Gauge - Schreibe Register
void writeBQ27441Register(uint8_t reg, uint16_t data) {
  Wire.beginTransmission(BQ27441_ADDRESS);
  Wire.write(reg);
  Wire.write(data & 0xFF);
  Wire.write((data >> 8) & 0xFF);
  Wire.endTransmission();
  delay(10);
}

// Initialisiere Batterie-System (genau wie im funktionierenden Test-Code)
bool initBatterySystem() {
  Serial.println("  → Prüfe TCA9548A Multiplexer...");
  
  // Prüfe ob TCA9548A erreichbar ist (genau wie im funktionierenden Code)
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err = Wire.endTransmission();
  
  if (err != 0) {
    Serial.print("  ✗ TCA9548A nicht gefunden (Error ");
    Serial.print(err);
    Serial.println(")");
    return false;
  }
  
  Serial.println("  ✓ TCA9548A gefunden");
  
  // Wähle Kanal für Fuel Gauge
  Serial.println("  → Wähle Kanal " + String(BATTERY_CHANNEL) + " für Fuel Gauge...");
  selectI2CChannel(BATTERY_CHANNEL);
  delay(100);
  
  // Prüfe ob BQ27441 erreichbar ist (genau wie im funktionierenden Code)
  Serial.println("  → Prüfe BQ27441 Fuel Gauge...");
  Wire.beginTransmission(BQ27441_ADDRESS);
  err = Wire.endTransmission();
  
  if (err != 0) {
    Serial.print("  ✗ BQ27441 nicht gefunden (I2C Error ");
    Serial.print(err);
    Serial.println(")");
    Serial.println("  ⚠️ Stelle sicher, dass der Fuel Gauge am Kanal " + String(BATTERY_CHANNEL) + " angeschlossen ist");
    return false;
  }
  
  Serial.println("  ✓ BQ27441 gefunden");
  
  // Test-Lesen der Daten (genau wie im funktionierenden Code)
  uint16_t testVoltage = readBQ27441Register(REG_VOLTAGE);
  uint16_t testSOC = readBQ27441Register(REG_SOC);
  
  Serial.println("  → Test-Lesen:");
  Serial.print("    Spannung: ");
  Serial.print(testVoltage);
  Serial.println(" mV");
  Serial.print("    Ladezustand: ");
  Serial.print(testSOC);
  Serial.println(" %");
  
  if (testVoltage == 0 && testSOC == 0) {
    Serial.println("  ⚠️ Warnung: Beide Werte sind 0 - möglicherweise Kommunikationsproblem");
  }
  
  delay(100);
  
  return true;
}

// Lese Batteriedaten vom Fuel Gauge (genau wie im funktionierenden Test-Code)
void readBatteryData() {
  if (!batteryInitialized) return;
  
  // Wähle den richtigen I2C Kanal
  selectI2CChannel(BATTERY_CHANNEL);
  delay(50);
  
  // Lese Spannung (Register 0x04 - Voltage) - genau wie im funktionierenden Code
  uint16_t voltageRaw = readBQ27441Register(REG_VOLTAGE);
  
  // Lese State of Charge (Register 0x1C - StateOfCharge) - genau wie im funktionierenden Code
  uint16_t socRaw = readBQ27441Register(REG_SOC);
  
  // Konvertiere mV zu V (genau wie im funktionierenden Code zeigt mV)
  if (voltageRaw > 0 && voltageRaw < 5000) {  // Gültiger Bereich: 0-5000mV
    batteryVoltage = voltageRaw / 1000.0;  // Konvertiere mV zu V
  } else {
    batteryVoltage = 0;  // Ungültiger Wert
  }
  
  // SOC ist direkt in Prozent (genau wie im funktionierenden Code)
  if (socRaw <= 100) {
    batteryPercentage = socRaw;
  } else {
    batteryPercentage = 0;  // Ungültiger Wert
  }
  
  // Begrenze Werte auf sinnvolle Bereiche
  if (batteryVoltage < 0 || batteryVoltage > 5.0) batteryVoltage = 0;
  if (batteryPercentage < 0 || batteryPercentage > 100) batteryPercentage = 0;

  evaluateBatteryPresence();
  
  Serial.println("\n--- Batteriedaten ---");
  Serial.print("  Spannung: ");
  Serial.print(voltageRaw);
  Serial.print(" mV (");
  Serial.print(batteryVoltage, 2);
  Serial.println(" V)");
  Serial.print("  Ladezustand: ");
  Serial.print(batteryPercentage);
  Serial.println(" %");
}

// Sende Batteriedaten an Supabase
void updateBatteryData() {
  if (!isConnected) return;
  
  HTTPClient http;
  
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  
  Serial.println("\n→ UPDATE Battery Data");
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  // JSON Body erstellen
  DynamicJsonDocument doc(256);
  
  // Wenn Batterie erkannt wird, sende die Werte, sonst NULL
  if (batteryPresent && batteryInitialized) {
    doc["battery_voltage"] = batteryVoltage;
    doc["battery_percentage"] = batteryPercentage;
    Serial.println("  Spannung: " + String(batteryVoltage, 2) + " V");
    Serial.println("  Prozent: " + String(batteryPercentage) + " %");
    Serial.println("  → Batterie erkannt, sende Werte");
  } else {
    // Setze auf NULL wenn keine Batterie erkannt wird
    doc["battery_voltage"] = nullptr;
    doc["battery_percentage"] = nullptr;
    Serial.println("  ⚠️ Keine Batterie erkannt → Setze Werte auf NULL");
    if (!batteryInitialized) {
      Serial.println("  → Batterie-System nicht initialisiert");
    } else {
      Serial.println("  → Spannung zu niedrig: " + String(batteryVoltage, 2) + " V (Schwellwert: " + String(BATTERY_PRESENT_THRESHOLD, 1) + " V)");
    }
  }
  
  // WICHTIG: updated_at aktualisieren (für Verbindungsstatus im Dashboard)
  doc["updated_at"] = "now()";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("  Body: " + jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
    Serial.println("✓ Batteriedaten erfolgreich aktualisiert!");
  } else {
    Serial.println("✗ Update Fehler: " + String(httpCode));
    Serial.println("  Response: " + http.getString());
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
  if (batteryInitialized) {
    Serial.println("Batterie: " + String(batteryVoltage, 2) + " V (" + String(batteryPercentage) + "%)");
  }
  Serial.println("==================\n");
}

