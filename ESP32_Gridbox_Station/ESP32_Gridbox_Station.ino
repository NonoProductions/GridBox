#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <ESP32Servo.h>

// Realtime: 1 = Updates per WebSocket (nur bei Änderung), 0 = HTTP-Polling. Bei 1: Bibliothek "WebSockets" (Links2004) + STATION_ID nötig.
#define USE_SUPABASE_REALTIME 1

#if USE_SUPABASE_REALTIME
#include <WebSocketsClient.h>
#include <WiFiClientSecure.h>
#endif

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
#define TOTAL_SLOTS 2        // Anzahl Slots (für Zukunft)

// ===== BATTERIE KONFIGURATION =====
#define TCA9548A_ADDRESS 0x70     // I2C Adresse des TCA9548A Multiplexers
#define BQ27441_ADDRESS 0x55      // I2C Adresse des BQ27441 Fuel Gauge
#define BATTERY_CHANNEL 0        // Kanal des Multiplexers für den Fuel Gauge (0-7)
#define BATTERY_UPDATE_INTERVAL 15000  // Batteriedaten alle 15 Sekunden aktualisieren (reduziert Egress um ~87%)
#define BATTERY_TEST_MODE false   // true = Test-Modus ohne Hardware (verwendet Dummy-Daten)

// BQ27441 Register
#define REG_VOLTAGE 0x04     // Spannung (mV)
#define REG_SOC     0x1C     // Ladezustand (%)

// ===== EEPROM KONFIGURATION =====
// EEPROM hängt am TCA9548A auf diesem Kanal (0-7). Nur dieser Kanal wird für EEPROM genutzt.
#define EEPROM_CHANNEL 2
// 24LC01B/02B kann 0x50-0x57 sein (A0/A1/A2 Pins). Auf Kanal 0 ist 0x55 = Fuel Gauge → überspringen!
#define EEPROM_24C02_ADDRESS 0x50    // Standard-Adresse (wird pro Kanal erkannt: 0x50-0x57)
#define EEPROM_ID_START_ADDRESS 0x00  // Startadresse für Powerbank-ID im EEPROM
#define EEPROM_ID_MAX_LENGTH 32      // Maximale Länge der Powerbank-ID (String)
#define EEPROM_MAGIC_BYTE 0xAA        // Magic Byte zur Erkennung ob ID gesetzt ist
#define EEPROM_MAGIC_ADDRESS 0x00     // Adresse für Magic Byte
#define EEPROM_ID_DATA_ADDRESS 0x01   // Startadresse für ID-Daten (nach Magic Byte)
#define AUTO_INIT_EMPTY_EEPROM true   // true = Automatisch IDs schreiben wenn EEPROM leer ist

// LED Pins
#define LED_PIN 2           // Eingebaute LED (wird bei Ausgabe aktiviert)
#define STATUS_LED_PIN 23   // Externe Status-LED (optional)

// Servo Konfiguration (mechanische Ausgabe)
#define SERVO_A_PIN 13            // Servo A Signal-Pin
#define SERVO_B_PIN 7             // Servo B Signal-Pin
#define DISPENSE_TARGET_SERVO 1   // 1 = Servo A (Pin 13), 2 = Servo B (Pin 7)
#define SERVO_STARTUP_IDENTIFY false // Bewegt A und B kurz beim Start zur Zuordnung
// Kalibrierte Winkel pro Servo (Servos sind gegenläufig!)
#define SERVO_A_CLOSED_ANGLE 140  // Servo A: Fach geschlossen
#define SERVO_A_OPEN_ANGLE 0      // Servo A: Fach geöffnet / Powerbank wird ausgegeben
#define SERVO_B_CLOSED_ANGLE 0    // Servo B: Fach geschlossen
#define SERVO_B_OPEN_ANGLE 140    // Servo B: Fach geöffnet / Powerbank wird ausgegeben
#define SERVO_MOVE_DELAY_MS 1500  // Zeit in ms, wie lange der Servo in Offen-Position bleibt

// LED Konfiguration
#define ENABLE_STATUS_BLINK false    // false = Kein Status-Blinken (nur bei Ausgabe), true = Normales Blinken
#define ENABLE_DISPENSE_LED false    // Deaktiviert das Blinksignal bei Ausleihe (war nur ein Test)
#define DISPENSE_LED_DURATION 5000   // LED leuchtet 5 Sekunden bei Ausgabe
#define DISPENSE_POLL_INTERVAL 15000  // Nur bei USE_SUPABASE_REALTIME=0: Intervall für Ausgabe-Check (Sekunden)
#define REALTIME_FALLBACK_POLL_INTERVAL 5000  // Auch bei Realtime regelmäßig pollen (falls WS Event verpasst wird)
#define DISPENSE_CONFIRM_TIMEOUT_MS 5000      // Abbruch, wenn Entnahme nicht innerhalb von 5s erkannt
#define DISPENSE_CHECK_INTERVAL_MS 250        // Sensor-Prüfung während Ausgabe

// Relais & Button Konfiguration
#define RELAY_PIN 5                 // Kontrolliert das Lade-Relais (Pin 17 = funktionierender Relais-Pin aus Testskript)
#define RELAY_ACTIVE_LOW false       // true = LOW aktiviert Relais, false = HIGH aktiviert Relais
                                      // Dein Relais schaltet bei HIGH (siehe funktionierendes Testskript)
#define CHARGE_BUTTON_PIN 33         // Taster zum Ein-/Ausschalten des Ladevorgangs
#define BUTTON_DEBOUNCE_MS 200       // Entprellzeit
#define BATTERY_PRESENT_THRESHOLD 3.2  // ≥3.2V = Batterie erkannt
#define REQUIRE_BATTERY_FOR_RELAY true  // false = Relais funktioniert auch ohne Batterie (für Tests)

// Update-Intervalle
const unsigned long UPDATE_INTERVAL = 15000;  // 15 Sekunden (reduziert Egress-Verbrauch um ~87%)
const unsigned long HTTP_TIMEOUT_MS = 10000;  // 10 s Timeout für Supabase-Requests (verhindert Hänger)

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
bool lastReportedBatteryPresent = false;  // Zuletzt an Supabase gemeldeter Zustand (Powerbank da/weg)
bool batteryStateEverReported = false;    // Einmal initial melden, danach nur bei Änderung

// Servo-Objekte
Servo dispenseServoA;
Servo dispenseServoB;
bool servosReady = false;
bool dispenseServoLogged = false;
bool servoAReady = false;
bool servoBReady = false;

// EEPROM: pro Kanal erkannter I2C-Adresse (0 = noch nicht erkannt). Kanal 0: 0x55 = Fuel Gauge, überspringen!
uint8_t eepromAddressByChannel[8] = {0};

#if USE_SUPABASE_REALTIME
WebSocketsClient realtimeWebSocket;
unsigned long lastRealtimeHeartbeat = 0;
const unsigned long REALTIME_HEARTBEAT_MS = 20000;  // unter 25 s
volatile bool realtimeDispenseRequested = false;
void realtimeWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void realtimeSendJoin();
void realtimeSendHeartbeat();
#endif

// Funktionsprototypen
void handleChargeButton();
void updateChargingState();
void evaluateBatteryPresence();
void dispensePowerbank();
bool rollbackFailedDispense();
bool initDispenseServos();
void moveDispenseServo(bool open);

// EEPROM Funktionsprototypen
bool writeEEPROMByte(uint8_t channel, uint8_t address, uint8_t data);
uint8_t readEEPROMByte(uint8_t channel, uint8_t address);
bool writePowerbankID(uint8_t channel, const String& id);
String readPowerbankID(uint8_t channel);
bool isPowerbankIDSet(uint8_t channel);
void scanAllPowerbankIDs();
bool initEEPROM(uint8_t channel);
uint8_t findEEPROMAddressOnChannel(uint8_t channel);  // Findet EEPROM-Adresse 0x50-0x57, auf BATTERY_CHANNEL wird 0x55 übersprungen
void initializePowerbankIDs();  // Beispiel-Funktion zum Initialisieren aller IDs
String generatePowerbankID(uint8_t channel);  // Generiert automatisch eine ID basierend auf Station und Slot

void setup() {
  // Serielle Kommunikation starten
  Serial.begin(115200);
  delay(2000);  // Längere Wartezeit für Serielle Verbindung
  
  // Kurze, verständliche Startmeldung
  Serial.println();
  Serial.println("====== Gridbox ESP32 Station ======");
  #if USE_SHORT_CODE
    Serial.println("Station: " + String(STATION_SHORT_CODE));
  #else
    Serial.println("Station-ID: " + String(STATION_ID));
  #endif
  Serial.println("Starte Hardware ...");
  
  // I2C initialisieren (ESP32 Standard Pins: SDA=21, SCL=22)
  Wire.begin(21, 22);
  delay(100);
  
  // Batterie-System initialisieren
  #if BATTERY_TEST_MODE
    batteryInitialized = true;
    batteryVoltage = 3.70;
    batteryPercentage = 85;
    evaluateBatteryPresence();
  #else
    batteryInitialized = initBatterySystem();
    if (!batteryInitialized) {
      batteryPresent = false;
      updateChargingState();
    }
  #endif
  
  // Pins konfigurieren - SICHER initialisieren
  // Nur LED_PIN am Anfang (sicher!)
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  delay(100);
  
  // Status-LED nur wenn nicht problematischer Pin
  if (STATUS_LED_PIN != 23) {  // Pin 23 kann problematisch sein
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
  }
  delay(100);
  
  // LED-Test
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);

  // Servos initialisieren (Ausgabemechanik)
  servosReady = initDispenseServos();

  // Relais & Button initialisieren
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF_STATE);
  relayCurrentlyOn = false;
  
  // Relais-Test: Kurz ein- und ausschalten
  digitalWrite(RELAY_PIN, RELAY_ON_STATE);
  delay(1000);
  digitalWrite(RELAY_PIN, RELAY_OFF_STATE);
  delay(200);

  pinMode(CHARGE_BUTTON_PIN, INPUT_PULLUP);
  lastButtonState = digitalRead(CHARGE_BUTTON_PIN);
  stableButtonState = lastButtonState;
  
  // Initialisiere chargeEnabledFromWeb mit true (wird beim ersten getStationData() aktualisiert)
  chargeEnabledFromWeb = true;
  chargeEnabled = true;
  
  updateChargingState();
  
  // EEPROM-System initialisieren und Powerbank-IDs scannen (nur Start-Info in Konsole)
  scanAllPowerbankIDs();
  
  // OPTIONAL: Initialisiere Powerbank-IDs (nur beim ersten Setup oder zum Testen)
  // Entkommentiere die nächste Zeile, um IDs für alle Slots zu setzen:
  // initializePowerbankIDs();
  
  // WLAN verbinden
  connectWiFi();
  
  #if USE_SUPABASE_REALTIME
  if (isConnected) {
    String host = String(SUPABASE_URL);
    host.replace("https://", "");
    int slash = host.indexOf('/');
    if (slash > 0) host = host.substring(0, slash);
    String path = "/realtime/v1/websocket?apikey=" + String(SUPABASE_KEY) + "&vsn=1.0.0";
    // Links2004 WebSockets: beginSSL(host, port, url) – kein WiFiClientSecure nötig
    realtimeWebSocket.beginSSL(host.c_str(), 443, path.c_str());
    realtimeWebSocket.onEvent(realtimeWebSocketEvent);
    realtimeWebSocket.setReconnectInterval(5000);
    Serial.println("Realtime: WebSocket-Verbindung wird aufgebaut...");
  }
  #endif
  
  // Initiale Station-Daten abrufen
  if (isConnected) {
    getStationData();
    
    // Synchronisiere total_units mit TOTAL_SLOTS Konfiguration
    syncTotalUnits();
    
    // Sende initiale Batterie-Daten sofort (updated_at = Verbindungsstatus)
    if (batteryInitialized) {
      #if !BATTERY_TEST_MODE
        readBatteryData();
      #endif
      if (batteryPresent) {
        Serial.println("🔋 Powerbank: " + String(batteryVoltage, 2) + " V, " + String(batteryPercentage) + " % (Start)");
      } else {
        Serial.println("🔋 Powerbank: keine erkannt");
      }
      updateBatteryData();
      lastReportedBatteryPresent = batteryPresent;
      batteryStateEverReported = true;
      lastBatteryUpdate = millis();
    } else {
      Serial.println("🔋 Batterie: Fuel Gauge nicht gefunden – Akku-Anzeige deaktiviert.");
      if (isConnected) updateBatteryData();  // Trotzdem updated_at senden (Station = verbunden)
    }
  }
  
  Serial.println("Setup abgeschlossen – Station bereit.");
  Serial.println("====================================");
}

void loop() {
  handleChargeButton();
  
  // Prüfe WLAN-Verbindung
  if (WiFi.status() != WL_CONNECTED) {
    isConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
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
  
  // === AUSGABE-ANFRAGE: Realtime (Push) oder Polling ===
  #if USE_SUPABASE_REALTIME
  realtimeWebSocket.loop();
  if (millis() - lastRealtimeHeartbeat > REALTIME_HEARTBEAT_MS) {
    realtimeSendHeartbeat();
    lastRealtimeHeartbeat = millis();
  }
  // Fallback-Polling auch im Realtime-Modus, falls WebSocket-Events verpasst werden
  if (millis() - lastDispenseCheck > REALTIME_FALLBACK_POLL_INTERVAL) {
    checkDispenseRequest();
    lastDispenseCheck = millis();
  }
  if (realtimeDispenseRequested) {
    realtimeDispenseRequested = false;
    unsigned long timeSinceLastDispense = millis() - lastDispenseTime;
    if (timeSinceLastDispense > 10000) {
      lastDispenseTime = millis();
      Serial.println("Supabase Realtime: Powerbank-Ausgabe angefordert.");
      resetDispenseFlag();
      dispensePowerbank();
      activateDispenseLED();
    }
  }
  #else
  if (millis() - lastDispenseCheck > DISPENSE_POLL_INTERVAL) {
    checkDispenseRequest();
    lastDispenseCheck = millis();
  }
  #endif
  
  // SENSOREN DEAKTIVIERT - Keine automatischen Updates
  // Die Anzahl wird nur durch die Web-App geändert (bei Ausleihe)
  
  // Regelmäßiger Status-Check alle UPDATE_INTERVAL Millisekunden
  if (millis() - lastUpdate > UPDATE_INTERVAL) {
    Serial.println("\n--- Status-Check (ohne Sensor-Update) ---");
    getStationData();
    lastUpdate = millis();
  }
  
  // Batteriedaten lesen (Intervall); an Supabase senden (updated_at = Verbindungsstatus im Dashboard!)
  if (millis() - lastBatteryUpdate > BATTERY_UPDATE_INTERVAL) {
    if (batteryInitialized) {
      #if BATTERY_TEST_MODE
        // Test-Modus: Simuliere leicht variierende Batteriedaten
        batteryVoltage = 3.65 + (random(0, 20) / 100.0);  // 3.65 - 3.85 V
        batteryPercentage = 80 + random(-5, 10);  // 75 - 90%
        if (batteryPercentage > 100) batteryPercentage = 100;
        if (batteryPercentage < 0) batteryPercentage = 0;
        evaluateBatteryPresence();
      #else
        readBatteryData();
      #endif
      // Serial: Akkustand der Powerbank anzeigen (jedes Intervall)
      if (batteryPresent) {
        Serial.println("🔋 Powerbank: " + String(batteryVoltage, 2) + " V, " + String(batteryPercentage) + " %");
      } else {
        Serial.println("🔋 Powerbank: keine erkannt (Spannung < " + String(BATTERY_PRESENT_THRESHOLD, 1) + " V)");
      }
      // Immer senden: updated_at muss regelmäßig aktualisiert werden, damit die Station im Dashboard als "verbunden" gilt (< 60 s)
      if (batteryPresent != lastReportedBatteryPresent) {
        Serial.println(batteryPresent ? "Powerbank erkannt → Daten an Dashboard." : "Powerbank entfernt → NULL an Dashboard.");
        lastReportedBatteryPresent = batteryPresent;
      }
      updateBatteryData();  // Sendet battery_voltage/percentage + updated_at
      lastReportedBatteryPresent = batteryPresent;
      if (!batteryStateEverReported) batteryStateEverReported = true;
    } else {
      // Fuel Gauge nicht gefunden – trotzdem updated_at senden, damit Station als verbunden angezeigt wird
      if (isConnected) {
        updateBatteryData();  // Sendet NULL für Batterie + updated_at
      }
      Serial.println("🔋 Batterie: Fuel Gauge nicht gefunden (I2C/Kanal " + String(BATTERY_CHANNEL) + ")");
      if (initBatterySystem()) {
        batteryInitialized = true;
      } else {
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
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));  // LED blinken
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WLAN verbunden, IP: " + WiFi.localIP().toString());
    isConnected = true;
    digitalWrite(STATUS_LED_PIN, HIGH);  // LED dauerhaft an
    lastBatteryUpdate = 0;  // Nächsten Loop sofort Heartbeat senden (updated_at), damit Dashboard wieder "verbunden" zeigt
  } else {
    isConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}

// ===== SUPABASE FUNKTIONEN =====

void getStationData() {
  if (!isConnected) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));

  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    // Prüfe ob Antwort leer ist
    if (payload.length() == 0) {
      http.end();
      return;
    }
    
    // JSON parsen
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
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
      
      // Aktualisiere Web-Status und Relais
      bool statusChanged = (chargeEnabledWeb != chargeEnabledFromWeb);
      chargeEnabledFromWeb = chargeEnabledWeb;
      
      // Beim ersten Empfang oder bei Änderung: Relais aktualisieren
      if (!firstDataReceived || statusChanged) {
        if (!firstDataReceived) {
          firstDataReceived = true;
        } else {
          Serial.println(String("Supabase: Laden per App wurde ") + (chargeEnabledWeb ? "EIN" : "AUS") + " geschaltet.");
        }
        updateChargingState();
      }
      
      currentAvailableUnits = availableUnits;
    } else {
      Serial.println("Supabase: Station nicht gefunden (prüfe ID/Short-Code).");
    }
  } else {
    Serial.println("Supabase HTTP Fehler beim Laden der Station: " + String(httpCode));
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
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  
  // JSON Body erstellen
  DynamicJsonDocument doc(256);
  doc["available_units"] = units;
  // updated_at wird vom DB-Trigger bei jedem UPDATE automatisch gesetzt
  String jsonBody;
  serializeJson(doc, jsonBody);
  http.setTimeout(HTTP_TIMEOUT_MS);
  int httpCode = http.PATCH(jsonBody);
  if (httpCode == 200 || httpCode == 201) lastReportedUnits = units;
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
  http.setTimeout(HTTP_TIMEOUT_MS);
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
          // Ausgabe-Anfrage akzeptiert → einmal klar loggen
          Serial.println("Supabase: Powerbank-Ausgabe angefordert.");
          
          // Merke Zeitpunkt
          lastDispenseTime = millis();
          
          // ZUERST Flag in Datenbank zurücksetzen (wichtig!)
          resetDispenseFlag();
          
          // DANN mechanische Ausgabe auslösen
          dispensePowerbank();
          // Optional LED-Signal
          activateDispenseLED();
        } else {
          Serial.println("⚠️ Ausgabe-Anfrage ignoriert (zu kurz nach letzter Ausgabe: " + String(timeSinceLastDispense/1000) + "s)");
        }
      }
    }
  }
  
  http.end();
}

// Servo dreht, um eine Powerbank mechanisch auszugeben
void dispensePowerbank() {
  // Hinweis: Die Prüfungen (Mindestsaldo 5 € und Distanz <= 100 m)
  // werden in der Web-App / Supabase gemacht, bevor dispense_requested gesetzt wird.
  Serial.println("Servo: Ausgabe gestartet.");
  if (!servosReady) {
    Serial.println("❌ Servos nicht bereit (attach fehlgeschlagen) - Ausgabe abgebrochen.");
    return;
  }
  if (!dispenseServoLogged) {
    Serial.println(String("Aktiver Ausgabe-Servo: ") + (DISPENSE_TARGET_SERVO == 1 ? "A (Pin " + String(SERVO_A_PIN) + ")" : "B (Pin " + String(SERVO_B_PIN) + ")"));
    dispenseServoLogged = true;
  }

  // Servo vor der Ausgabe sicherheitshalber re-attachen (WiFi/HTTP können LEDC-Kanäle stören)
  if (!dispenseServoA.attached()) {
    Serial.println("⚠️ Servo A war detached – re-attach vor Ausgabe.");
    dispenseServoA.setPeriodHertz(50);
    dispenseServoA.attach(SERVO_A_PIN, 500, 2400);
    delay(100);
  }
  if (!dispenseServoB.attached()) {
    Serial.println("⚠️ Servo B war detached – re-attach vor Ausgabe.");
    dispenseServoB.setPeriodHertz(50);
    dispenseServoB.attach(SERVO_B_PIN, 500, 2400);
    delay(100);
  }

  // Ohne Batteriesensor kann keine sichere Entnahme-Prüfung erfolgen
  if (!batteryInitialized) {
    Serial.println("⚠️ Batterie-Sensor nicht verfügbar: keine Entnahme-Verifikation möglich.");
    moveDispenseServo(true);  // öffnen
    delay(SERVO_MOVE_DELAY_MS);
    moveDispenseServo(false);  // schließen
    delay(300);
    return;
  }

  bool pickupDetected = false;

  // Servo öffnen und bis zu 5s auf Entnahme warten
  moveDispenseServo(true);  // öffnen
  delay(50);  // PWM-Signal stabilisieren bevor I2C-Operationen starten
  unsigned long waitStart = millis();

  while (millis() - waitStart < DISPENSE_CONFIRM_TIMEOUT_MS) {
    delay(DISPENSE_CHECK_INTERVAL_MS);
    #if !BATTERY_TEST_MODE
      readBatteryData();  // aktualisiert batteryPresent via evaluateBatteryPresence()
    #endif

    if (!batteryPresent) {
      pickupDetected = true;
      break;
    }
  }

  if (pickupDetected) {
    Serial.println("✅ Entnahme erkannt: Powerbank wurde genommen.");
  } else {
    Serial.println("❌ Keine Entnahme innerhalb 5s erkannt -> Ausleihe wird abgebrochen.");
  }

  // Servo schließen (Powerbank zurückziehen)
  moveDispenseServo(false);  // schließen
  delay(300);

  if (pickupDetected) {
    // Sofort Batterie-Status an Supabase senden, damit die App die Entnahme erkennt
    updateBatteryData();
    lastBatteryUpdate = millis();
  } else {
    if (rollbackFailedDispense()) {
      Serial.println("↩️ Ausleihe erfolgreich zurückgerollt.");
    } else {
      Serial.println("⚠️ Rückrollen fehlgeschlagen - bitte in Dashboard prüfen.");
    }
  }
}

void activateDispenseLED() {
  #if !ENABLE_DISPENSE_LED
    return;
  #endif
  
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Erster Blink sofort
  digitalWrite(LED_PIN, HIGH);
  
  // Optionales Signal (z.B. Piezo-Buzzer, Servo-Motor, etc.)
  // TODO: Hier kannst du zusätzliche Hardware ansteuern:
  // - Servo-Motor für mechanische Ausgabe
  // - Solenoid zum Entriegeln
  // - Buzzer für akustisches Signal
  // Beispiel:
  // digitalWrite(SERVO_A_PIN, HIGH);
  // myServo.write(90);
}

void resetDispenseFlag() {
  if (!isConnected) return;
  
  HTTPClient http;
  
  String url = String(SUPABASE_URL) + "/rest/v1/stations?";
  
  #if USE_SHORT_CODE
    url += "short_code=eq." + String(STATION_SHORT_CODE);
  #else
    url += "id=eq." + String(STATION_ID);
  #endif
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  DynamicJsonDocument doc(256);
  doc["dispense_requested"] = false;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  // Kein dauerhaftes Logging hier nötig – nur interne Rücksetzung
  
  http.end();
  
  // Kurze Pause damit Datenbank Zeit hat zu aktualisieren
  delay(500);
}

bool rollbackFailedDispense() {
  if (!isConnected) return false;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/rollback_failed_dispense";
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");
  DynamicJsonDocument doc(256);
  doc["p_station_id"] = String(STATION_ID);
  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);
  String payload = http.getString();
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    return true;
  }

  Serial.println("Rollback RPC Fehler: HTTP " + String(httpCode) + " -> " + payload);
  return false;
}

bool initDispenseServos() {
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  dispenseServoA.setPeriodHertz(50);
  dispenseServoB.setPeriodHertz(50);
  int servoChannelA = dispenseServoA.attach(SERVO_A_PIN, 500, 2400);
  int servoChannelB = dispenseServoB.attach(SERVO_B_PIN, 500, 2400);
  servoAReady = (servoChannelA >= 0);
  servoBReady = (servoChannelB >= 0);

  Serial.println("Servo A (Pin " + String(SERVO_A_PIN) + ") Kanal: " + String(servoChannelA));
  Serial.println("Servo B (Pin " + String(SERVO_B_PIN) + ") Kanal: " + String(servoChannelB));

  bool targetServoReady = (DISPENSE_TARGET_SERVO == 1) ? servoAReady : servoBReady;
  if (!targetServoReady) {
    Serial.println("❌ Ziel-Servo attach fehlgeschlagen. Pins/Wiring/Power pruefen.");
    return false;
  }

  if (servoAReady) dispenseServoA.write(SERVO_A_CLOSED_ANGLE);
  if (servoBReady) dispenseServoB.write(SERVO_B_CLOSED_ANGLE);
  Serial.println("✅ Servos initialisiert, Startposition: geschlossen (A=" + String(SERVO_A_CLOSED_ANGLE) + "° B=" + String(SERVO_B_CLOSED_ANGLE) + "°)");
  if (!servoAReady || !servoBReady) {
    Serial.println("⚠️ Hinweis: Ein Servo ist optional ausgefallen, Ziel-Servo bleibt nutzbar.");
  }

#if SERVO_STARTUP_IDENTIFY
  Serial.println("Servo-Zuordnungstest: zuerst Servo A, dann Servo B (nur wenn bereit).");
  if (servoAReady) {
    dispenseServoA.write(SERVO_A_OPEN_ANGLE);
    delay(600);
    dispenseServoA.write(SERVO_A_CLOSED_ANGLE);
    delay(400);
  }
  if (servoBReady) {
    dispenseServoB.write(SERVO_B_OPEN_ANGLE);
    delay(600);
    dispenseServoB.write(SERVO_B_CLOSED_ANGLE);
    delay(400);
  }
#endif

  Serial.println(String("Konfigurierter Ausgabe-Servo: ") + (DISPENSE_TARGET_SERVO == 1 ? "A" : "B"));
  return true;
}

void moveDispenseServo(bool open) {
  if (DISPENSE_TARGET_SERVO == 1) {
    int angle = open ? SERVO_A_OPEN_ANGLE : SERVO_A_CLOSED_ANGLE;
    if (!dispenseServoA.attached()) {
      Serial.println("Servo A war detached – re-attach auf Pin " + String(SERVO_A_PIN));
      dispenseServoA.setPeriodHertz(50);
      dispenseServoA.attach(SERVO_A_PIN, 500, 2400);
      delay(50);
    }
    dispenseServoA.write(angle);
    Serial.println("Servo A → " + String(angle) + "° (" + (open ? "OFFEN" : "ZU") + ")");
  } else {
    int angle = open ? SERVO_B_OPEN_ANGLE : SERVO_B_CLOSED_ANGLE;
    if (!dispenseServoB.attached()) {
      Serial.println("Servo B war detached – re-attach auf Pin " + String(SERVO_B_PIN));
      dispenseServoB.setPeriodHertz(50);
      dispenseServoB.attach(SERVO_B_PIN, 500, 2400);
      delay(50);
    }
    dispenseServoB.write(angle);
    Serial.println("Servo B → " + String(angle) + "° (" + (open ? "OFFEN" : "ZU") + ")");
  }
}

#if USE_SUPABASE_REALTIME
void realtimeWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("Realtime: WebSocket verbunden, sende phx_join...");
      realtimeSendJoin();
      break;
    case WStype_DISCONNECTED:
      Serial.println("Realtime: WebSocket getrennt.");
      break;
    case WStype_TEXT: {
      if (length == 0) break;
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) break;
      const char* event = doc["event"];
      if (event && strcmp(event, "postgres_changes") == 0) {
        JsonObject data = doc["payload"]["data"];
        if (!data.isNull()) {
          JsonObject record = data["record"];
          if (!record.isNull() && record["dispense_requested"] == true) {
            realtimeDispenseRequested = true;
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

void realtimeSendJoin() {
  const char* topic = "realtime:public:stations";
  StaticJsonDocument<512> doc;
  doc["topic"] = topic;
  doc["event"] = "phx_join";
  doc["ref"] = "1";
  doc["join_ref"] = "1";
  JsonObject payload = doc.createNestedObject("payload");
  JsonObject config = payload.createNestedObject("config");
  JsonArray changes = config.createNestedArray("postgres_changes");
  JsonObject sub = changes.add<JsonObject>();
  sub["event"] = "UPDATE";
  sub["schema"] = "public";
  sub["table"] = "stations";
  sub["filter"] = String("id=eq.") + String(STATION_ID);
  config["private"] = false;
  String msg;
  serializeJson(doc, msg);
  realtimeWebSocket.sendTXT(msg);
}

void realtimeSendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["topic"] = "phoenix";
  doc["event"] = "heartbeat";
  doc["ref"] = "2";
  doc["join_ref"] = "2";
  doc["payload"] = JsonObject();
  String msg;
  serializeJson(doc, msg);
  realtimeWebSocket.sendTXT(msg);
}
#endif

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
        // Lokaler Button wird nur kurz gemeldet, wenn sich der Zustand ändert
        Serial.println(String("Taste: Laden ") + (chargeEnabled ? "EIN" : "AUS"));
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
  
  // Prüfe ob Änderung nötig
  if (shouldCharge == relayCurrentlyOn) {
    return;
  }

  // Ändere Relais-Status
  relayCurrentlyOn = shouldCharge;
  uint8_t desiredState = shouldCharge ? RELAY_ON_STATE : RELAY_OFF_STATE;
  digitalWrite(RELAY_PIN, desiredState);
  
  // Kurze, gut lesbare Meldung nur bei tatsächlicher Änderung
  Serial.println(String("Relais: Laden ") + (shouldCharge ? "EIN" : "AUS") + " (" + reason + ")");
}

void evaluateBatteryPresence() {
  bool previousState = batteryPresent;
  batteryPresent = batteryVoltage >= BATTERY_PRESENT_THRESHOLD;

  if (batteryPresent != previousState) {
    if (batteryPresent) {
      Serial.println("✅ Batterieanschluss erkannt (Spannung ≥ " + String(BATTERY_PRESENT_THRESHOLD, 1) + "V)");
      // SOFORT Powerbank-ID an Supabase senden → Trigger beendet aktive Ausleihe
      Serial.println("📤 Sende Powerbank-Rückgabe sofort an Supabase...");
      updateBatteryData();
      lastBatteryUpdate = millis();
    } else {
      Serial.println("❌ Batterie entfernt oder zu geringe Spannung");
      // Auch sofort senden damit Station weiß: Powerbank weg
      updateBatteryData();
      lastBatteryUpdate = millis();
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
  http.setTimeout(HTTP_TIMEOUT_MS);
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
  // Prüfe ob TCA9548A erreichbar ist (genau wie im funktionierenden Code)
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err = Wire.endTransmission();
  
  if (err != 0) {
    return false;
  }
  
  // Wähle Kanal für Fuel Gauge
  selectI2CChannel(BATTERY_CHANNEL);
  delay(100);
  
  // Prüfe ob BQ27441 erreichbar ist (genau wie im funktionierenden Code)
  Wire.beginTransmission(BQ27441_ADDRESS);
  err = Wire.endTransmission();
  
  if (err != 0) {
    return false;
  }
  
  // Test-Lesen der Daten (genau wie im funktionierenden Code)
  uint16_t testVoltage = readBQ27441Register(REG_VOLTAGE);
  uint16_t testSOC = readBQ27441Register(REG_SOC);
  
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
}

// Sende Batteriedaten an Supabase (mit Timeout + 1 Retry für stabilere Anzeige im Dashboard)
void updateBatteryData() {
  if (!isConnected) return;
  
  for (int attempt = 0; attempt < 2; attempt++) {
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/stations?";
    #if USE_SHORT_CODE
      url += "short_code=eq." + String(STATION_SHORT_CODE);
    #else
      url += "id=eq." + String(STATION_ID);
    #endif

    http.begin(url);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=representation");

    DynamicJsonDocument doc(256);
    String detectedPowerbankId = readPowerbankID(EEPROM_CHANNEL);
    if (batteryPresent && batteryInitialized) {
      if (detectedPowerbankId.length() > 0) {
        doc["powerbank_id"] = detectedPowerbankId;
      } else {
        doc["powerbank_id"] = nullptr;
      }
      doc["battery_voltage"] = (int)(batteryVoltage * 100) / 100.0;
      doc["battery_percentage"] = batteryPercentage;
    } else {
      doc["powerbank_id"] = nullptr;
      doc["battery_voltage"] = nullptr;
      doc["battery_percentage"] = nullptr;
    }

    String jsonBody;
    serializeJson(doc, jsonBody);
    int httpCode = http.PATCH(jsonBody);
    String responseBody = http.getString();
    http.end();

    if (httpCode == 200 || httpCode == 201) {
      break;
    }
    Serial.println("Body: " + jsonBody);
    if (responseBody.length() > 0) {
      Serial.println("Supabase Antwort: " + responseBody);
    }
    if (attempt == 0) {
      Serial.println("Supabase Battery-Update Fehler (HTTP " + String(httpCode) + "), Retry...");
      delay(500);
    } else {
      Serial.println("Supabase Battery-Update fehlgeschlagen nach Retry: HTTP " + String(httpCode));
    }
  }
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

// ===== EEPROM FUNKTIONEN (24C02) =====

// Findet EEPROM-Adresse auf dem Kanal (0x50-0x57). Auf BATTERY_CHANNEL wird 0x55 übersprungen (Fuel Gauge!).
uint8_t findEEPROMAddressOnChannel(uint8_t channel) {
  if (channel > 7) return 0;
  selectI2CChannel(channel);
  delay(10);
  for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
    if (channel == BATTERY_CHANNEL && addr == 0x55) continue;  // 0x55 auf diesem Kanal = Fuel Gauge
    Wire.beginTransmission(addr);
    Wire.write(0x00);
    if (Wire.endTransmission() == 0) {
      return addr;
    }
    delay(5);
  }
  return 0;
}

// Schreibe ein Byte in das EEPROM auf dem angegebenen TCA-Kanal (verwendet erkennter Adresse pro Kanal)
bool writeEEPROMByte(uint8_t channel, uint8_t address, uint8_t data) {
  if (channel > 7 || address > 255) return false;
  uint8_t addr = eepromAddressByChannel[channel];
  if (addr == 0) return false;  // EEPROM auf diesem Kanal nicht erkannt
  
  selectI2CChannel(channel);
  delay(5);
  Wire.beginTransmission(addr);
  Wire.write(address);
  Wire.write(data);
  uint8_t error = Wire.endTransmission();
  // 24LC01B/02B: Schreibzyklus bis 5 ms; etwas Puffer für zuverlässiges Schreiben
  delay(15);
  return (error == 0);
}

// Lese ein Byte aus dem EEPROM auf dem angegebenen TCA-Kanal (verwendet erkennter Adresse pro Kanal)
uint8_t readEEPROMByte(uint8_t channel, uint8_t address) {
  if (channel > 7 || address > 255) return 0xFF;
  uint8_t addr = eepromAddressByChannel[channel];
  if (addr == 0) return 0xFF;
  
  selectI2CChannel(channel);
  delay(5);
  Wire.beginTransmission(addr);
  Wire.write(address);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  Wire.requestFrom((uint16_t)addr, (uint8_t)1);
  if (Wire.available() < 1) return 0xFF;
  return Wire.read();
}

// Prüfe ob EEPROM auf dem Kanal vorhanden ist; erkennt Adresse 0x50-0x57 (außer 0x55 auf BATTERY_CHANNEL)
bool initEEPROM(uint8_t channel) {
  if (channel > 7) return false;
  if (eepromAddressByChannel[channel] == 0) {
    eepromAddressByChannel[channel] = findEEPROMAddressOnChannel(channel);
  }
  if (eepromAddressByChannel[channel] == 0) return false;
  
  selectI2CChannel(channel);
  delay(10);
  Wire.beginTransmission(eepromAddressByChannel[channel]);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;
  return true;
}

// Prüfe ob eine Powerbank-ID bereits im EEPROM gespeichert ist
bool isPowerbankIDSet(uint8_t channel) {
  uint8_t magic = readEEPROMByte(channel, EEPROM_MAGIC_ADDRESS);
  return (magic == EEPROM_MAGIC_BYTE);
}

// Schreibe eine Powerbank-ID in das EEPROM auf dem angegebenen Kanal (mit Retry und Fehlerausgabe)
bool writePowerbankID(uint8_t channel, const String& id) {
  if (channel > 7) return false;
  if (id.length() == 0 || id.length() > EEPROM_ID_MAX_LENGTH) return false;
  if (!initEEPROM(channel)) return false;

  for (int attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) delay(100);

    if (!writeEEPROMByte(channel, EEPROM_MAGIC_ADDRESS, EEPROM_MAGIC_BYTE)) {
      Serial.println("EEPROM FEHLER: I2C – Schreiben Magic Byte (Adr. 0) fehlgeschlagen. Gerät antwortet nicht (NACK/Timeout).");
      continue;
    }
    uint8_t idLength = id.length();
    if (!writeEEPROMByte(channel, EEPROM_ID_DATA_ADDRESS, idLength)) {
      Serial.println("EEPROM FEHLER: I2C – Schreiben Länge (Adr. 1) fehlgeschlagen. Gerät antwortet nicht.");
      continue;
    }
    bool writeOk = true;
    for (uint8_t i = 0; i < idLength && i < EEPROM_ID_MAX_LENGTH; i++) {
      uint8_t address = EEPROM_ID_DATA_ADDRESS + 1 + i;
      if (!writeEEPROMByte(channel, address, id.charAt(i))) {
        Serial.println("EEPROM FEHLER: I2C – Schreiben Zeichen " + String(i) + " (Adr. " + String(address) + ") fehlgeschlagen.");
        writeOk = false;
        break;
      }
    }
    if (!writeOk) continue;
    if (idLength < EEPROM_ID_MAX_LENGTH) {
      writeEEPROMByte(channel, EEPROM_ID_DATA_ADDRESS + 1 + idLength, 0x00);
    }

    delay(50);
    String verifyID = readPowerbankID(channel);
    if (verifyID == id) return true;
    Serial.println("EEPROM FEHLER: Verifizierung fehlgeschlagen – nach Schreiben stimmt Inhalt nicht.");
    Serial.println("  → Erwartet: \"" + id + "\"");
    Serial.println("  → Gelesen:  \"" + verifyID + "\"");
  }
  return false;
}

// Lese eine Powerbank-ID aus dem EEPROM auf dem angegebenen Kanal
String readPowerbankID(uint8_t channel) {
  if (channel > 7) {
    return "";  // Ungültiger Kanal
  }
  
  // Prüfe ob ID gesetzt ist
  if (!isPowerbankIDSet(channel)) {
    return "";  // Keine ID gespeichert
  }
  
  // Prüfe ob EEPROM vorhanden ist
  if (!initEEPROM(channel)) {
    return "";  // EEPROM nicht gefunden
  }
  
  // Lese ID-Länge
  uint8_t idLength = readEEPROMByte(channel, EEPROM_ID_DATA_ADDRESS);
  
  if (idLength == 0xFF || idLength == 0 || idLength > EEPROM_ID_MAX_LENGTH) {
    return "";  // Ungültige Länge
  }
  
  // Lese ID-String
  String id = "";
  for (uint8_t i = 0; i < idLength; i++) {
    uint8_t address = EEPROM_ID_DATA_ADDRESS + 1 + i;
    uint8_t ch = readEEPROMByte(channel, address);
    
    if (ch == 0xFF) {
      return "";  // Fehler beim Lesen
    }
    
    if (ch == 0x00) {
      break;  // Null-Terminator erreicht
    }
    
    id += (char)ch;
  }
  
  return id;
}

// Scanne alle TCA-Kanäle und zeige vorhandene Powerbank-IDs an
// Schreibt automatisch IDs wenn EEPROM leer ist (wenn AUTO_INIT_EMPTY_EEPROM = true)
void scanAllPowerbankIDs() {
  bool foundAny = false;
  int emptyCount = 0;

  Serial.println("--- EEPROM (Kanal " + String(EEPROM_CHANNEL) + ") ---");

  for (uint8_t channel = EEPROM_CHANNEL; channel <= EEPROM_CHANNEL; channel++) {
    if (!initEEPROM(channel)) {
      Serial.println("EEPROM FEHLER: Kanal " + String(channel) + " – kein Chip gefunden.");
      Serial.println("  → Prüfe: Verdrahtung, TCA9548A Kanal " + String(channel) + ", Adressen 0x50–0x57, Stromversorgung.");
      continue;
    }
    Serial.println("  EEPROM erkannt auf Kanal " + String(channel) + ", Adresse 0x" + String(eepromAddressByChannel[channel], HEX));
    if (isPowerbankIDSet(channel)) {
      String id = readPowerbankID(channel);
      if (id.length() > 0) {
        foundAny = true;
        Serial.println("  EEPROM OK: Powerbank-ID gelesen: \"" + id + "\"");
      } else {
        // EEPROM ist vorhanden aber ID ist ungültig → automatisch initialisieren
        #if AUTO_INIT_EMPTY_EEPROM
          String newID = generatePowerbankID(channel);
          
          // Prüfe ob diese ID bereits auf einem anderen Kanal existiert (Kollisionsprüfung)
          bool idExists = false;
          for (uint8_t checkChannel = 0; checkChannel < 8; checkChannel++) {
            if (checkChannel != channel && isPowerbankIDSet(checkChannel)) {
              String existingID = readPowerbankID(checkChannel);
              if (existingID == newID) {
                idExists = true;
                // Generiere alternative ID mit Timestamp
                newID = generatePowerbankID(channel) + "-" + String(millis() % 10000);
                break;
              }
            }
          }
          
          if (writePowerbankID(channel, newID)) {
            foundAny = true;
            emptyCount++;
          } else {
          }
        #endif
      }
    } else {
      // EEPROM ist leer (kein Magic Byte) → automatisch initialisieren
      #if AUTO_INIT_EMPTY_EEPROM
        Serial.println(" → Kanal " + String(channel) + ": EEPROM leer, schreibe neue ID...");
        String newID = generatePowerbankID(channel);
        
        // Prüfe ob diese ID bereits auf einem anderen Kanal existiert (Kollisionsprüfung)
        bool idExists = false;
        for (uint8_t checkChannel = 0; checkChannel < 8; checkChannel++) {
          if (checkChannel != channel && isPowerbankIDSet(checkChannel)) {
            String existingID = readPowerbankID(checkChannel);
            if (existingID == newID) {
              idExists = true;
              // Generiere alternative ID mit Timestamp
              newID = generatePowerbankID(channel) + "-" + String(millis() % 10000);
              break;
            }
          }
        }
        
        if (writePowerbankID(channel, newID)) {
          foundAny = true;
          emptyCount++;
          Serial.println("  EEPROM OK: ID geschrieben: \"" + newID + "\"");
        } else {
          Serial.println("EEPROM FEHLER: Schreiben der Powerbank-ID fehlgeschlagen (siehe Meldungen oben: I2C oder Verifizierung).");
        }
      #else
        Serial.println("  EEPROM leer – AUTO_INIT_EMPTY_EEPROM ist aus, keine ID geschrieben.");
        emptyCount++;
      #endif
    }
  }
  if (foundAny) {
    Serial.println("EEPROM: OK – Powerbank-ID vorhanden.");
  } else {
    Serial.println("EEPROM FEHLER: Keine gültige Powerbank-ID. Chip nicht gefunden oder Schreiben/Verifizierung fehlgeschlagen.");
  }
  Serial.println("------------------------");
}

// Generiere eine eindeutige Powerbank-ID basierend auf Station und Slot
// ROBUSTE VERSION mit Validierung und Fehlerbehandlung
String generatePowerbankID(uint8_t channel) {
  // Validierung: Kanal muss zwischen 0-7 sein
  if (channel > 7) {
    Serial.println("  ⚠️ WARNUNG: Ungültiger Kanal " + String(channel) + ", verwende 0");
    channel = 0;
  }
  
  String stationCode = "";
  
  #if USE_SHORT_CODE
    stationCode = String(STATION_SHORT_CODE);
    
    // Validierung: Station-Code sollte nicht leer sein
    if (stationCode.length() == 0) {
      Serial.println("  ⚠️ WARNUNG: STATION_SHORT_CODE ist leer, verwende 'ST'");
      stationCode = "ST";
    }
    
    // Begrenze auf max. 8 Zeichen (damit ID nicht zu lang wird)
    if (stationCode.length() > 8) {
      stationCode = stationCode.substring(0, 8);
      Serial.println("  ℹ️ Station-Code gekürzt auf: " + stationCode);
    }
  #else
    // Nutze erste 4 Zeichen der UUID als Code
    String uuid = String(STATION_ID);
    if (uuid.length() >= 4) {
      stationCode = uuid.substring(0, 4).toUpperCase();
    } else {
      Serial.println("  ⚠️ WARNUNG: STATION_ID zu kurz, verwende 'ST'");
      stationCode = "ST";
    }
  #endif
  
  // Erstelle ID: STATION-SLOT (z.B. "88SH-0")
  String id = stationCode + "-" + String(channel);
  
  // Finale Validierung: ID sollte nicht zu lang sein
  if (id.length() > EEPROM_ID_MAX_LENGTH) {
    Serial.println("  ⚠️ WARNUNG: Generierte ID zu lang (" + String(id.length()) + " Zeichen), kürze...");
    id = id.substring(0, EEPROM_ID_MAX_LENGTH);
  }
  
  return id;
}

// Beispiel-Funktion: Initialisiere Powerbank-IDs für alle Slots
// Diese Funktion kann beim ersten Setup verwendet werden
// Passe die IDs nach deinen Bedürfnissen an (z.B. UUIDs aus Supabase)
void initializePowerbankIDs() {
  Serial.println("\n→ Initialisiere Powerbank-IDs für alle Slots...");
  Serial.println("  ⚠️ ACHTUNG: Überschreibt vorhandene IDs!");
  Serial.println();
  
  // Beispiel-IDs (ersetze durch echte UUIDs oder andere eindeutige IDs)
  String exampleIDs[] = {
    "PB-001",  // Kanal 0
    "PB-002",  // Kanal 1
    "PB-003",  // Kanal 2
    "PB-004",  // Kanal 3
    "PB-005",  // Kanal 4
    "PB-006",  // Kanal 5
    "PB-007",  // Kanal 6
    "PB-008"   // Kanal 7
  };
  
  for (uint8_t channel = EEPROM_CHANNEL; channel <= EEPROM_CHANNEL; channel++) {
    if (initEEPROM(channel)) {
      Serial.println("  → Kanal " + String(channel) + ": Setze ID \"" + exampleIDs[channel] + "\"...");
      if (writePowerbankID(channel, exampleIDs[channel])) {
        Serial.println("  ✓ Kanal " + String(channel) + " erfolgreich initialisiert");
      } else {
        Serial.println("  ✗ Kanal " + String(channel) + " Fehler beim Schreiben");
      }
    } else {
      Serial.println("  EEPROM FEHLER: Kanal " + String(channel) + " – kein Chip gefunden (0x50–0x57). Verdrahtung prüfen.");
    }
    delay(50);  // Kurze Pause zwischen Schreibvorgängen
  }
  
  Serial.println();
  Serial.println("→ Verifiziere alle IDs...");
  scanAllPowerbankIDs();
}

