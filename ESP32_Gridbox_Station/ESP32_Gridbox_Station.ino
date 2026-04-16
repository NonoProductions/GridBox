#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <ESP32Servo.h>

// Realtime: 1 = Updates per WebSocket (nur bei Änderung), 0 = HTTP-Polling. Bei 1: Bibliothek "WebSockets" (Links2004) + STATION_ID nötig.
#define USE_SUPABASE_REALTIME 1

#if USE_SUPABASE_REALTIME
#include <WebSocketsClient.h>
#endif

#if __has_include("secrets.h")
#include "secrets.h"
#endif

// ===== WLAN Konfiguration =====
// WICHTIG: Echte Zugangsdaten MUESSEN in secrets.h stehen (nicht hier committen!)
#ifndef WIFI_SSID
#define WIFI_SSID "CHANGE_ME_IN_SECRETS_H"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "CHANGE_ME_IN_SECRETS_H"
#endif

// ===== PROXY Konfiguration (SICHER: kein Supabase-Key auf dem ESP32!) =====
// Der ESP32 kommuniziert NUR mit dem Proxy (Next.js API Routes).
// Der Proxy authentifiziert den ESP32 per DEVICE_API_KEY und leitet an Supabase weiter.
#ifndef PROXY_BASE_URL
#define PROXY_BASE_URL "https://gridbox-app.vercel.app/api/esp"
#endif

#ifndef DEVICE_API_KEY
#define DEVICE_API_KEY "CHANGE_ME_IN_SECRETS_H"
#endif

#define USE_SHORT_CODE true

#ifndef STATION_SHORT_CODE
#define STATION_SHORT_CODE "XXXX"
#endif

#ifndef STATION_ID
#define STATION_ID "00000000-0000-0000-0000-000000000000"
#endif

// ===== SENSOR KONFIGURATION =====
// SENSOREN DEAKTIVIERT - Nicht benötigt
#define USE_SENSORS false         // Alle Sensoren deaktiviert
#define TOTAL_SLOTS 2        // Anzahl Slots

// ===== BATTERIE KONFIGURATION =====
#define TCA9548A_ADDRESS 0x70     // I2C Adresse des TCA9548A Multiplexers
#define BQ27441_ADDRESS 0x55      // I2C Adresse des BQ27441 Fuel Gauge
// Pro-Slot Fuel Gauge Kanäle auf dem TCA9548A (0-7)
#define SLOT_1_BATTERY_CHANNEL 0  // Fuel Gauge Kanal für Slot 1
#define SLOT_2_BATTERY_CHANNEL 1  // Fuel Gauge Kanal für Slot 2
#define BATTERY_UPDATE_INTERVAL 15000  // Batteriedaten alle 15 Sekunden aktualisieren (reduziert Egress um ~87%)
#define BATTERY_TEST_MODE false   // true = Test-Modus ohne Hardware (verwendet Dummy-Daten)

// BQ27441 Register
#define REG_VOLTAGE 0x04     // Spannung (mV)
#define REG_SOC     0x1C     // Ladezustand (%)

// ===== EEPROM KONFIGURATION =====
// Pro-Slot EEPROM Kanäle auf dem TCA9548A (0-7)
#define SLOT_1_EEPROM_CHANNEL 2   // EEPROM Kanal für Slot 1
#define SLOT_2_EEPROM_CHANNEL 3   // EEPROM Kanal für Slot 2
// 24LC01B/02B kann 0x50-0x57 sein (A0/A1/A2 Pins). Auf Batterie-Kanälen ist 0x55 = Fuel Gauge → überspringen!
#define EEPROM_24C02_ADDRESS 0x50    // Standard-Adresse (wird pro Kanal erkannt: 0x50-0x57)
#define EEPROM_ID_START_ADDRESS 0x00  // Startadresse für Powerbank-ID im EEPROM
#define EEPROM_ID_MAX_LENGTH 32      // Maximale Länge der Powerbank-ID (String)
#define EEPROM_MAGIC_BYTE 0xAA        // Magic Byte zur Erkennung ob ID gesetzt ist
#define EEPROM_MAGIC_ADDRESS 0x00     // Adresse für Magic Byte
#define EEPROM_ID_DATA_ADDRESS 0x01   // Startadresse für ID-Daten (nach Magic Byte)
#define AUTO_INIT_EMPTY_EEPROM true   // true = Automatisch IDs schreiben wenn EEPROM leer ist

// Abwärtskompatibilität: BATTERY_CHANNEL und EEPROM_CHANNEL als Alias für Slot 1
#define BATTERY_CHANNEL SLOT_1_BATTERY_CHANNEL
#define EEPROM_CHANNEL SLOT_1_EEPROM_CHANNEL

// LED Pins
#define LED_PIN 2           // Eingebaute LED (wird bei Ausgabe aktiviert)
#define STATUS_LED_PIN 23   // Externe Status-LED (optional)

// Servo Konfiguration (mechanische Ausgabe)
// Servo A = Slot 1, Servo B = Slot 2
#define SERVO_A_PIN 13            // Servo A Signal-Pin (Slot 1)
#define SERVO_B_PIN 7             // Servo B Signal-Pin (Slot 2)
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
// 2 Relais: jedes Relais steuert das Laden für einen einzelnen Slot
#define RELAY_A_PIN 6              // Relais A = Slot 1 (Lade-Relais)
#define RELAY_B_PIN 7              // Relais B = Slot 2 (Lade-Relais)
#define RELAY_ACTIVE_LOW false       // true = LOW aktiviert Relais, false = HIGH aktiviert Relais
                                      // Dein Relais schaltet bei HIGH (siehe funktionierendes Testskript)
#define CHARGE_BUTTON_PIN 33         // Taster zum Ein-/Ausschalten des Ladevorgangs
#define BUTTON_DEBOUNCE_MS 200       // Entprellzeit
#define BATTERY_PRESENT_THRESHOLD 3.2  // ≥3.2V = Batterie erkannt
#define REQUIRE_BATTERY_FOR_RELAY true  // false = Relais funktioniert auch ohne Batterie (für Tests)

// Startup-Prime: Relais beim Booten kurz einschalten, damit EEPROM/Peripherie versorgt ist
#define RELAY_STARTUP_PRIME_MS 800

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
bool relayACurrentlyOn = false;  // Relais A (Slot 1) Status
bool relayBCurrentlyOn = false;  // Relais B (Slot 2) Status
bool firstDataReceived = false;  // Flag für initiales Relais-Update

// ===== Per-Slot Datenstrukturen =====
struct SlotData {
  float batteryVoltage;
  int batteryPercentage;
  bool batteryInitialized;
  bool batteryPresent;
  bool lastReportedBatteryPresent;
  bool batteryStateEverReported;
  uint8_t batteryChannel;    // TCA9548A Kanal für Fuel Gauge
  uint8_t eepromChannel;     // TCA9548A Kanal für EEPROM
  String powerbankId;        // Gelesene ID aus EEPROM
};

SlotData slots[TOTAL_SLOTS];
unsigned long lastBatteryUpdate = 0;

// Servo-Objekte (Servo A = Slot 1, Servo B = Slot 2)
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

// Realtime Token Management (kurzlebiges JWT vom Proxy)
String realtimeToken = "";
String realtimeSupabaseHost = "";
String realtimeApiKey = "";
unsigned long realtimeTokenExpiresAt = 0;  // Unix-Timestamp (Sekunden)
const unsigned long TOKEN_REFRESH_MARGIN = 120;  // 2 Minuten vor Ablauf erneuern
bool realtimeConnected = false;
unsigned long lastRealtimeReconnectAttempt = 0;
const unsigned long REALTIME_RECONNECT_INTERVAL_MS = 5000;
bool fetchRealtimeToken();
void connectRealtimeWebSocket();
#endif

// Funktionsprototypen
void handleChargeButton();
void updateChargingState();
void evaluateBatteryPresence();
void evaluateSlotBatteryPresence(uint8_t slotIndex);
void dispensePowerbank();
bool rollbackFailedDispense();
bool initDispenseServos();
void moveDispenseServo(int slotIndex, bool open);
int chooseBestSlot();  // Wählt den Slot mit dem höchsten Akku
bool initSlotBattery(uint8_t slotIndex);
void readSlotBatteryData(uint8_t slotIndex);
void updateAllSlotsBatteryData();
bool beginProxyRequest(HTTPClient& http, WiFiClientSecure& secureClient, const String& endpoint);

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
  
  // Slot-Datenstrukturen initialisieren
  slots[0].batteryChannel = SLOT_1_BATTERY_CHANNEL;
  slots[0].eepromChannel = SLOT_1_EEPROM_CHANNEL;
  slots[1].batteryChannel = SLOT_2_BATTERY_CHANNEL;
  slots[1].eepromChannel = SLOT_2_EEPROM_CHANNEL;
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    slots[i].batteryVoltage = 0.0;
    slots[i].batteryPercentage = 0;
    slots[i].batteryInitialized = false;
    slots[i].batteryPresent = false;
    slots[i].lastReportedBatteryPresent = false;
    slots[i].batteryStateEverReported = false;
    slots[i].powerbankId = "";
  }
  
  // Batterie-System für alle Slots initialisieren
  #if BATTERY_TEST_MODE
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      slots[i].batteryInitialized = true;
      slots[i].batteryVoltage = 3.70 + i * 0.05;
      slots[i].batteryPercentage = 85 - i * 10;
      evaluateSlotBatteryPresence(i);
    }
  #else
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      slots[i].batteryInitialized = initSlotBattery(i);
      if (!slots[i].batteryInitialized) {
        slots[i].batteryPresent = false;
      }
      Serial.println("Slot " + String(i + 1) + " Fuel Gauge: " + (slots[i].batteryInitialized ? "OK" : "nicht gefunden") + " (Kanal " + String(slots[i].batteryChannel) + ")");
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

  // Relais A & B sofort einschalten, damit EEPROM beim Start versorgt ist
  pinMode(RELAY_A_PIN, OUTPUT);
  pinMode(RELAY_B_PIN, OUTPUT);
  digitalWrite(RELAY_A_PIN, RELAY_ON_STATE);
  digitalWrite(RELAY_B_PIN, RELAY_ON_STATE);
  relayACurrentlyOn = true;
  relayBCurrentlyOn = true;
  Serial.println("Startup: Relais A und B kurz EIN fuer EEPROM-/I2C-Versorgung...");
  delay(RELAY_STARTUP_PRIME_MS);

  // Nach dem Einschalten Batterie/Fuel-Gauge noch einmal pruefen
  #if !BATTERY_TEST_MODE
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      if (!slots[i].batteryInitialized) {
        slots[i].batteryInitialized = initSlotBattery(i);
      }
      if (!slots[i].batteryInitialized) {
        slots[i].batteryPresent = false;
      }
      Serial.println("Startup-Check Slot " + String(i + 1) + ": Fuel Gauge " + (slots[i].batteryInitialized ? "OK" : "nicht gefunden") + " (Kanal " + String(slots[i].batteryChannel) + ")");
    }
  #endif

  pinMode(CHARGE_BUTTON_PIN, INPUT_PULLUP);
  lastButtonState = digitalRead(CHARGE_BUTTON_PIN);
  stableButtonState = lastButtonState;
  
  // Initialisiere chargeEnabledFromWeb mit true (wird beim ersten getStationData() aktualisiert)
  chargeEnabledFromWeb = true;
  chargeEnabled = true;
  
  // EEPROM-System initialisieren und Powerbank-IDs scannen (beide Slots)
  scanAllPowerbankIDs();

  // Nach der Startup-Versorgung echte Messwerte holen und erst dann Relais final setzen
  #if !BATTERY_TEST_MODE
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      if (slots[i].batteryInitialized) {
        readSlotBatteryData(i);
      }
    }
  #endif
  updateChargingState();
  
  // OPTIONAL: Initialisiere Powerbank-IDs (nur beim ersten Setup oder zum Testen)
  // Entkommentiere die nächste Zeile, um IDs für alle Slots zu setzen:
  // initializePowerbankIDs();
  
  // WLAN verbinden
  connectWiFi();
  
  // Initiale Station-Daten abrufen (wärmt Vercel Cold Start auf)
  if (isConnected) {
    getStationData();
    
    // Synchronisiere total_units mit TOTAL_SLOTS Konfiguration
    syncTotalUnits();
    
    // Sende initiale Batterie-Daten sofort für alle Slots (updated_at = Verbindungsstatus)
    bool anySlotInit = false;
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      if (slots[i].batteryInitialized) {
        anySlotInit = true;
        #if !BATTERY_TEST_MODE
          readSlotBatteryData(i);
        #endif
        if (slots[i].batteryPresent) {
          Serial.println("🔋 Slot " + String(i + 1) + ": " + String(slots[i].batteryVoltage, 2) + " V, " + String(slots[i].batteryPercentage) + " % (Start)");
        } else {
          Serial.println("🔋 Slot " + String(i + 1) + ": keine Powerbank erkannt");
        }
        slots[i].lastReportedBatteryPresent = slots[i].batteryPresent;
        slots[i].batteryStateEverReported = true;
      } else {
        Serial.println("🔋 Slot " + String(i + 1) + ": Fuel Gauge nicht gefunden – Akku-Anzeige deaktiviert.");
      }
    }
    updateAllSlotsBatteryData();
    lastBatteryUpdate = millis();
  }

  // Realtime Token holen NACH den initialen Requests (Vercel ist jetzt warm)
  #if USE_SUPABASE_REALTIME
  if (isConnected) {
    if (fetchRealtimeToken()) {
      connectRealtimeWebSocket();
    } else {
      Serial.println("Realtime: Token konnte nicht geholt werden – nur Polling aktiv.");
    }
  }
  #endif

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

  // Auto-Reconnect wenn WebSocket getrennt ist
  if (!realtimeConnected && (millis() - lastRealtimeReconnectAttempt > REALTIME_RECONNECT_INTERVAL_MS)) {
    lastRealtimeReconnectAttempt = millis();
    if (realtimeToken.length() == 0 || realtimeSupabaseHost.length() == 0 || realtimeApiKey.length() == 0) {
      fetchRealtimeToken();
    }
    connectRealtimeWebSocket();
  }

  // Token-Refresh: vor Ablauf neues Token holen und WebSocket neu verbinden
  if (realtimeTokenExpiresAt > 0) {
    unsigned long nowSec = millis() / 1000;  // Uptime-basiert (nicht Unix-Zeit, aber Differenz reicht)
    (void)nowSec;
    // Token wurde vor (expiresAt - fetchTime) Sekunden geholt; refresh TOKEN_REFRESH_MARGIN vorher
    static unsigned long tokenFetchedAtMillis = 0;
    if (tokenFetchedAtMillis == 0) tokenFetchedAtMillis = millis();
    unsigned long tokenAge = (millis() - tokenFetchedAtMillis) / 1000;
    unsigned long tokenLifetime = 600;  // 10 Minuten
    if (tokenAge > (tokenLifetime - TOKEN_REFRESH_MARGIN)) {
      Serial.println("Realtime: Token läuft ab – erneuere...");
      if (fetchRealtimeToken()) {
        tokenFetchedAtMillis = millis();
        realtimeWebSocket.disconnect();
        delay(200);
        connectRealtimeWebSocket();
      }
    }
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
  
  // Batteriedaten für alle Slots lesen und an Supabase senden
  if (millis() - lastBatteryUpdate > BATTERY_UPDATE_INTERVAL) {
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      if (slots[i].batteryInitialized) {
        #if BATTERY_TEST_MODE
          // Test-Modus: Simuliere leicht variierende Batteriedaten pro Slot
          slots[i].batteryVoltage = 3.65 + (random(0, 20) / 100.0) + i * 0.05;
          slots[i].batteryPercentage = 80 + random(-5, 10) - i * 5;
          if (slots[i].batteryPercentage > 100) slots[i].batteryPercentage = 100;
          if (slots[i].batteryPercentage < 0) slots[i].batteryPercentage = 0;
          evaluateSlotBatteryPresence(i);
        #else
          readSlotBatteryData(i);
        #endif
        // Serial: Akkustand pro Slot
        if (slots[i].batteryPresent) {
          Serial.println("🔋 Slot " + String(i + 1) + ": " + String(slots[i].batteryVoltage, 2) + " V, " + String(slots[i].batteryPercentage) + " %");
        } else {
          Serial.println("🔋 Slot " + String(i + 1) + ": keine Powerbank (Spannung < " + String(BATTERY_PRESENT_THRESHOLD, 1) + " V)");
        }
        if (slots[i].batteryPresent != slots[i].lastReportedBatteryPresent) {
          Serial.println(slots[i].batteryPresent ? "Slot " + String(i + 1) + ": Powerbank erkannt → Daten an Dashboard." : "Slot " + String(i + 1) + ": Powerbank entfernt → NULL an Dashboard.");
          slots[i].lastReportedBatteryPresent = slots[i].batteryPresent;
        }
        if (!slots[i].batteryStateEverReported) slots[i].batteryStateEverReported = true;
      } else {
        // Versuche erneut zu initialisieren
        slots[i].batteryInitialized = initSlotBattery(i);
        if (!slots[i].batteryInitialized) {
          slots[i].batteryPresent = false;
        }
      }
    }
    // Sende alle Slot-Daten an Supabase (inkl. updated_at für Verbindungsstatus)
    updateAllSlotsBatteryData();
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

// ===== PROXY API FUNKTIONEN =====

bool beginProxyRequest(HTTPClient& http, WiFiClientSecure& secureClient, const String& endpoint) {
  String url = String(PROXY_BASE_URL) + endpoint;
  secureClient.setInsecure();
  secureClient.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(secureClient, url)) {
    Serial.println("Proxy-Verbindung konnte nicht gestartet werden: " + url);
    return false;
  }

  http.setReuse(false);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Connection", "close");
  http.addHeader("X-Station-Key", DEVICE_API_KEY);
  return true;
}

void getStationData() {
  if (!isConnected) return;
  
  HTTPClient http;
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/station")) {
    return;
  }

  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    if (payload.length() == 0) {
      http.end();
      return;
    }
    
    // JSON parsen (Proxy gibt direkt ein Objekt zurück, kein Array)
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      http.end();
      return;
    }
    
    int availableUnits = doc["available_units"] | 0;
    int totalUnits = doc["total_units"] | 0;
    bool isActive = doc["is_active"] | true;
    bool chargeEnabledWeb = doc["charge_enabled"] | true;
    bool dispenseRequested = doc["dispense_requested"] | false;
    
    // Aktualisiere Web-Status und Relais
    bool statusChanged = (chargeEnabledWeb != chargeEnabledFromWeb);
    chargeEnabledFromWeb = chargeEnabledWeb;
    
    if (!firstDataReceived || statusChanged) {
      if (!firstDataReceived) {
        firstDataReceived = true;
      } else {
        Serial.println(String("App: Laden wurde ") + (chargeEnabledWeb ? "EIN" : "AUS") + " geschaltet.");
      }
      updateChargingState();
    }
    
    currentAvailableUnits = availableUnits;
    
    // Dispense-Check integriert (spart einen extra HTTP-Request)
    if (dispenseRequested) {
      unsigned long timeSinceLastDispense = millis() - lastDispenseTime;
      if (timeSinceLastDispense > 10000) {
        Serial.println("Proxy: Powerbank-Ausgabe angefordert.");
        lastDispenseTime = millis();
        resetDispenseFlag();
        dispensePowerbank();
        activateDispenseLED();
      }
    }
  } else if (httpCode == 401) {
    Serial.println("Proxy: Authentifizierung fehlgeschlagen (prüfe DEVICE_API_KEY).");
  } else {
    Serial.println("Proxy HTTP Fehler: " + String(httpCode));
  }
  
  http.end();
}

void updateAvailableUnits(int units) {
  if (!isConnected) return;
  
  HTTPClient http;
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/units")) {
    return;
  }
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(256);
  doc["available_units"] = units;
  String jsonBody;
  serializeJson(doc, jsonBody);
  int httpCode = http.PATCH(jsonBody);
  if (httpCode == 200) lastReportedUnits = units;
  http.end();
}

// ===== AUSGABE-SYSTEM (DISPENSE) =====

void checkDispenseRequest() {
  // Dispense-Check ist jetzt in getStationData() integriert (spart HTTP-Request).
  // Diese Funktion wird als Fallback-Poll weiterhin aufgerufen.
  if (!isConnected) return;
  
  HTTPClient http;
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/station")) {
    return;
  }
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      bool dispenseRequested = doc["dispense_requested"] | false;
      
      if (dispenseRequested) {
        unsigned long timeSinceLastDispense = millis() - lastDispenseTime;
        
        if (timeSinceLastDispense > 10000) {
          Serial.println("Proxy: Powerbank-Ausgabe angefordert.");
          lastDispenseTime = millis();
          resetDispenseFlag();
          dispensePowerbank();
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
// Wählt automatisch den Slot mit dem höchsten Akkustand
void dispensePowerbank() {
  // Hinweis: Die Prüfungen (Mindestsaldo 5 € und Distanz <= 100 m)
  // werden in der Web-App / Supabase gemacht, bevor dispense_requested gesetzt wird.
  Serial.println("=== Ausgabe-Vorgang gestartet ===");
  if (!servosReady) {
    Serial.println("❌ Servos nicht bereit (attach fehlgeschlagen) - Ausgabe abgebrochen.");
    return;
  }

  // Wähle den besten Slot (höchster Akku)
  int bestSlot = chooseBestSlot();
  if (bestSlot < 0) {
    Serial.println("❌ Keine Powerbank verfügbar – Ausgabe abgebrochen.");
    // Rollback: keine Powerbank zum Ausgeben
    if (rollbackFailedDispense()) {
      Serial.println("↩️ Ausleihe erfolgreich zurückgerollt (keine Powerbank verfügbar).");
    }
    return;
  }
  
  Serial.println("✅ Bester Slot: " + String(bestSlot + 1) + " (Akku: " + String(slots[bestSlot].batteryPercentage) + "%, " + String(slots[bestSlot].batteryVoltage, 2) + "V)");
  Serial.println("   Servo: " + String(bestSlot == 0 ? "A" : "B") + " (Pin " + String(bestSlot == 0 ? SERVO_A_PIN : SERVO_B_PIN) + ")");

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
  if (!slots[bestSlot].batteryInitialized) {
    Serial.println("⚠️ Slot " + String(bestSlot + 1) + " Batterie-Sensor nicht verfügbar: keine Entnahme-Verifikation möglich.");
    moveDispenseServo(bestSlot, true);  // öffnen
    delay(SERVO_MOVE_DELAY_MS);
    moveDispenseServo(bestSlot, false);  // schließen
    delay(300);
    return;
  }

  bool pickupDetected = false;

  // Servo öffnen und bis zu 5s auf Entnahme warten
  moveDispenseServo(bestSlot, true);  // öffnen
  delay(50);  // PWM-Signal stabilisieren bevor I2C-Operationen starten
  unsigned long waitStart = millis();

  while (millis() - waitStart < DISPENSE_CONFIRM_TIMEOUT_MS) {
    delay(DISPENSE_CHECK_INTERVAL_MS);
    #if !BATTERY_TEST_MODE
      readSlotBatteryData(bestSlot);  // aktualisiert batteryPresent via evaluateSlotBatteryPresence()
    #endif

    if (!slots[bestSlot].batteryPresent) {
      pickupDetected = true;
      break;
    }
  }

  if (pickupDetected) {
    Serial.println("✅ Entnahme erkannt: Powerbank aus Slot " + String(bestSlot + 1) + " wurde genommen.");
  } else {
    Serial.println("❌ Keine Entnahme innerhalb 5s erkannt -> Ausleihe wird abgebrochen.");
  }

  // Servo schließen (Powerbank zurückziehen)
  moveDispenseServo(bestSlot, false);  // schließen
  delay(300);

  if (pickupDetected) {
    // Sofort Batterie-Status an Supabase senden, damit die App die Entnahme erkennt
    updateAllSlotsBatteryData();
    lastBatteryUpdate = millis();
  } else {
    if (rollbackFailedDispense()) {
      Serial.println("↩️ Ausleihe erfolgreich zurückgerollt.");
    } else {
      Serial.println("⚠️ Rückrollen fehlgeschlagen - bitte in Dashboard prüfen.");
    }
  }
  Serial.println("=== Ausgabe-Vorgang beendet ===");
}

// Wählt den Slot mit dem höchsten Akkustand (gibt -1 zurück wenn kein Slot verfügbar)
int chooseBestSlot() {
  int bestSlot = -1;
  int bestPercentage = -1;
  
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    if (slots[i].batteryPresent && slots[i].batteryPercentage > bestPercentage) {
      bestPercentage = slots[i].batteryPercentage;
      bestSlot = i;
    }
  }
  
  // Debug: Zeige alle Slots
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    String status = slots[i].batteryPresent 
      ? (String(slots[i].batteryPercentage) + "%, " + String(slots[i].batteryVoltage, 2) + "V")
      : "leer";
    Serial.println("  Slot " + String(i + 1) + ": " + status + (i == bestSlot ? " ← GEWÄHLT" : ""));
  }
  
  return bestSlot;
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
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/dispense-ack")) {
    return;
  }
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PATCH("{}");
  
  http.end();
  
  // Kurze Pause damit Datenbank Zeit hat zu aktualisieren
  delay(500);
}

bool rollbackFailedDispense() {
  if (!isConnected) return false;

  HTTPClient http;
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/rollback")) {
    return false;
  }
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST("{}");
  String payload = http.getString();
  http.end();

  if (httpCode == 200) {
    return true;
  }

  Serial.println("Rollback Fehler: HTTP " + String(httpCode) + " -> " + payload);
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

  bool targetServoReady = servoAReady && servoBReady;
  if (!servoAReady && !servoBReady) {
    Serial.println("❌ Beide Servos attach fehlgeschlagen. Pins/Wiring/Power pruefen.");
    return false;
  }

  if (servoAReady) dispenseServoA.write(SERVO_A_CLOSED_ANGLE);
  if (servoBReady) dispenseServoB.write(SERVO_B_CLOSED_ANGLE);
  Serial.println("✅ Servos initialisiert, Startposition: geschlossen (A=" + String(SERVO_A_CLOSED_ANGLE) + "° B=" + String(SERVO_B_CLOSED_ANGLE) + "°)");
  if (!servoAReady || !servoBReady) {
    Serial.println("⚠️ Hinweis: Ein Servo ist ausgefallen (" + String(!servoAReady ? "A" : "B") + "), der andere bleibt nutzbar.");
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

  Serial.println("Servo A = Slot 1 (Pin " + String(SERVO_A_PIN) + "), Servo B = Slot 2 (Pin " + String(SERVO_B_PIN) + ")");
  return true;
}

void moveDispenseServo(int slotIndex, bool open) {
  if (slotIndex == 0) {
    // Slot 1 → Servo A
    int angle = open ? SERVO_A_OPEN_ANGLE : SERVO_A_CLOSED_ANGLE;
    if (!dispenseServoA.attached()) {
      Serial.println("Servo A war detached – re-attach auf Pin " + String(SERVO_A_PIN));
      dispenseServoA.setPeriodHertz(50);
      dispenseServoA.attach(SERVO_A_PIN, 500, 2400);
      delay(50);
    }
    dispenseServoA.write(angle);
    Serial.println("Servo A (Slot 1) → " + String(angle) + "° (" + (open ? "OFFEN" : "ZU") + ")");
  } else {
    // Slot 2 → Servo B
    int angle = open ? SERVO_B_OPEN_ANGLE : SERVO_B_CLOSED_ANGLE;
    if (!dispenseServoB.attached()) {
      Serial.println("Servo B war detached – re-attach auf Pin " + String(SERVO_B_PIN));
      dispenseServoB.setPeriodHertz(50);
      dispenseServoB.attach(SERVO_B_PIN, 500, 2400);
      delay(50);
    }
    dispenseServoB.write(angle);
    Serial.println("Servo B (Slot 2) → " + String(angle) + "° (" + (open ? "OFFEN" : "ZU") + ")");
  }
}

#if USE_SUPABASE_REALTIME
void realtimeWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      realtimeConnected = true;
      Serial.println("Realtime: WebSocket verbunden, sende phx_join...");
      realtimeSendJoin();
      break;
    case WStype_DISCONNECTED:
      realtimeConnected = false;
      Serial.println("Realtime: WebSocket getrennt.");
      if (length > 0 && payload != nullptr) {
        String reason;
        for (size_t i = 0; i < length; i++) reason += (char)payload[i];
        Serial.println("Realtime: Disconnect-Details: " + reason);
      }
      break;
    case WStype_ERROR:
      Serial.println("Realtime: WebSocket Fehler.");
      if (length > 0 && payload != nullptr) {
        String err;
        for (size_t i = 0; i < length; i++) err += (char)payload[i];
        Serial.println("Realtime: Fehlerdetails: " + err);
      }
      break;
    case WStype_TEXT: {
      if (length == 0) break;
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) {
        Serial.println("Realtime: Konnte WebSocket-Payload nicht parsen.");
        break;
      }
      const char* event = doc["event"];
      if (event && strcmp(event, "phx_error") == 0) {
        Serial.println("Realtime: phx_error empfangen.");
      }
      if (event && strcmp(event, "phx_reply") == 0) {
        JsonVariant status = doc["payload"]["status"];
        if (!status.isNull()) {
          Serial.println("Realtime: Join-Status = " + String((const char*)status));
        }
      }
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
  payload["access_token"] = realtimeToken;
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

// Hole ein kurzlebiges JWT vom Proxy für die WebSocket-Verbindung
bool fetchRealtimeToken() {
  if (!isConnected) return false;

  HTTPClient http;
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/token")) {
    Serial.println("Realtime: beginProxyRequest fehlgeschlagen");
    return false;
  }
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST("{}");

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.println("Realtime: Raw response (" + String(payload.length()) + " bytes): " + payload.substring(0, 500));
    DynamicJsonDocument doc(1536);
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.println("Realtime: JSON-Parse-Fehler: " + String(error.c_str()));
      http.end();
      return false;
    }

    const char* token = doc["token"];
    const char* host = doc["supabase_host"];
    const char* apikey = doc["realtime_apikey"];
    unsigned long expiresAt = doc["expires_at"] | 0;

    if (token && host && apikey) {
      realtimeToken = String(token);
      realtimeSupabaseHost = String(host);
      realtimeApiKey = String(apikey);
      realtimeTokenExpiresAt = expiresAt;
      Serial.println("Realtime: Token erhalten (gültig " + String(600) + "s)");
      http.end();
      return true;
    } else {
      Serial.println("Realtime: Antwort unvollständig – token=" + String(token ? "OK" : "NULL") + " host=" + String(host ? "OK" : "NULL") + " apikey=" + String(apikey ? "OK" : "NULL"));
      http.end();
      return false;
    }
  } else {
    String body = http.getString();
    Serial.println("Realtime: Token-Fehler HTTP " + String(httpCode) + " Body: " + body);
  }

  http.end();
  return false;
}

// Verbinde WebSocket mit dem kurzlebigen Token
void connectRealtimeWebSocket() {
  if (realtimeToken.length() == 0 || realtimeSupabaseHost.length() == 0 || realtimeApiKey.length() == 0) {
    Serial.println("Realtime: Kein Token vorhanden – WebSocket nicht gestartet.");
    return;
  }
  
  String path = "/realtime/v1/websocket?apikey=" + realtimeApiKey + "&vsn=1.0.0";
  realtimeConnected = false;
  realtimeWebSocket.beginSSL(realtimeSupabaseHost.c_str(), 443, path.c_str());
  realtimeWebSocket.onEvent(realtimeWebSocketEvent);
  realtimeWebSocket.setReconnectInterval(5000);
  Serial.println("Realtime: WebSocket-Verbindung wird aufgebaut...");
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
  // Relais-Logik PRO SLOT:
  // 1. Web-Schalter AUS → BEIDE Relais IMMER AUS (höchste Priorität)
  // 2. Lokaler Button AUS → BEIDE Relais AUS
  // 3. Pro Slot: Relais EIN nur wenn Batterie im Slot erkannt wird

  for (int i = 0; i < TOTAL_SLOTS; i++) {
    bool shouldCharge = false;
    String reason = "";

    if (!chargeEnabledFromWeb) {
      shouldCharge = false;
      reason = "Web-Schalter AUS";
    } else if (!chargeEnabled) {
      shouldCharge = false;
      reason = "Lokaler Button AUS";
    } else if (REQUIRE_BATTERY_FOR_RELAY && !slots[i].batteryPresent) {
      shouldCharge = false;
      reason = "Keine Batterie in Slot " + String(i + 1);
    } else {
      shouldCharge = true;
      reason = "Batterie erkannt";
    }

    // Relais A (Slot 1) oder B (Slot 2)
    bool* relayCurrentlyOn = (i == 0) ? &relayACurrentlyOn : &relayBCurrentlyOn;
    uint8_t relayPin = (i == 0) ? RELAY_A_PIN : RELAY_B_PIN;
    const char* relayName = (i == 0) ? "A" : "B";

    if (shouldCharge == *relayCurrentlyOn) {
      continue;  // Keine Änderung nötig
    }

    *relayCurrentlyOn = shouldCharge;
    digitalWrite(relayPin, shouldCharge ? RELAY_ON_STATE : RELAY_OFF_STATE);
    Serial.println(String("Relais ") + relayName + " (Slot " + String(i + 1) + "): Laden " + (shouldCharge ? "EIN" : "AUS") + " (" + reason + ")");
  }
}

void evaluateBatteryPresence() {
  // Evaluiere alle Slots
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    evaluateSlotBatteryPresence(i);
  }
}

void evaluateSlotBatteryPresence(uint8_t slotIndex) {
  if (slotIndex >= TOTAL_SLOTS) return;
  bool previousState = slots[slotIndex].batteryPresent;
  slots[slotIndex].batteryPresent = slots[slotIndex].batteryVoltage >= BATTERY_PRESENT_THRESHOLD;

  if (slots[slotIndex].batteryPresent != previousState) {
    if (slots[slotIndex].batteryPresent) {
      Serial.println("✅ Slot " + String(slotIndex + 1) + ": Powerbank erkannt (Spannung ≥ " + String(BATTERY_PRESENT_THRESHOLD, 1) + "V)");
      // SOFORT Powerbank-ID an Supabase senden → Trigger beendet aktive Ausleihe
      Serial.println("📤 Sende Slot " + String(slotIndex + 1) + " Powerbank-Rückgabe sofort an Supabase...");
      updateAllSlotsBatteryData();
      lastBatteryUpdate = millis();
    } else {
      Serial.println("❌ Slot " + String(slotIndex + 1) + ": Batterie entfernt oder zu geringe Spannung");
      // Auch sofort senden damit Station weiß: Powerbank weg
      updateAllSlotsBatteryData();
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
  WiFiClientSecure secureClient;
  if (!beginProxyRequest(http, secureClient, "/units")) {
    return;
  }
  http.addHeader("Content-Type", "application/json");
  DynamicJsonDocument doc(256);
  doc["total_units"] = TOTAL_SLOTS;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200) {
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

// Initialisiere Batterie-System für einen bestimmten Slot
bool initSlotBattery(uint8_t slotIndex) {
  if (slotIndex >= TOTAL_SLOTS) return false;
  uint8_t channel = slots[slotIndex].batteryChannel;
  
  // Prüfe ob TCA9548A erreichbar ist
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err = Wire.endTransmission();
  
  if (err != 0) {
    return false;
  }
  
  // Wähle Kanal für Fuel Gauge
  selectI2CChannel(channel);
  delay(100);
  
  // Prüfe ob BQ27441 erreichbar ist
  Wire.beginTransmission(BQ27441_ADDRESS);
  err = Wire.endTransmission();
  
  if (err != 0) {
    return false;
  }
  
  // Test-Lesen der Daten
  uint16_t testVoltage = readBQ27441Register(REG_VOLTAGE);
  uint16_t testSOC = readBQ27441Register(REG_SOC);
  (void)testVoltage;
  (void)testSOC;
  
  delay(100);
  
  return true;
}

// Initialisiere Batterie-System (Abwärtskompatibilität – initialisiert Slot 1)
bool initBatterySystem() {
  return initSlotBattery(0);
}

// Lese Batteriedaten für einen bestimmten Slot
void readSlotBatteryData(uint8_t slotIndex) {
  if (slotIndex >= TOTAL_SLOTS) return;
  if (!slots[slotIndex].batteryInitialized) return;
  
  uint8_t channel = slots[slotIndex].batteryChannel;
  
  // Wähle den richtigen I2C Kanal
  selectI2CChannel(channel);
  delay(50);
  
  // Lese Spannung
  uint16_t voltageRaw = readBQ27441Register(REG_VOLTAGE);
  
  // Lese State of Charge
  uint16_t socRaw = readBQ27441Register(REG_SOC);
  
  // Konvertiere mV zu V
  if (voltageRaw > 0 && voltageRaw < 5000) {
    slots[slotIndex].batteryVoltage = voltageRaw / 1000.0;
  } else {
    slots[slotIndex].batteryVoltage = 0;
  }
  
  // SOC ist direkt in Prozent
  if (socRaw <= 100) {
    slots[slotIndex].batteryPercentage = socRaw;
  } else {
    slots[slotIndex].batteryPercentage = 0;
  }
  
  // Begrenze Werte auf sinnvolle Bereiche
  if (slots[slotIndex].batteryVoltage < 0 || slots[slotIndex].batteryVoltage > 5.0) slots[slotIndex].batteryVoltage = 0;
  if (slots[slotIndex].batteryPercentage < 0 || slots[slotIndex].batteryPercentage > 100) slots[slotIndex].batteryPercentage = 0;

  evaluateSlotBatteryPresence(slotIndex);
}

// Lese Batteriedaten vom Fuel Gauge (Abwärtskompatibilität – liest Slot 1)
void readBatteryData() {
  readSlotBatteryData(0);
}

// Sende Batteriedaten für ALLE Slots an Proxy (neues Format mit slot_1_ und slot_2_ Feldern)
void updateAllSlotsBatteryData() {
  if (!isConnected || WiFi.status() != WL_CONNECTED) {
    isConnected = false;
    Serial.println("Battery-Update übersprungen: WLAN nicht verbunden.");
    return;
  }
  
  for (int attempt = 0; attempt < 2; attempt++) {
    HTTPClient http;
    WiFiClientSecure secureClient;
    if (!beginProxyRequest(http, secureClient, "/battery")) {
      if (attempt == 0) {
        delay(500);
      } else {
        Serial.println("Proxy Battery-Update fehlgeschlagen: Verbindung konnte nicht gestartet werden.");
      }
      continue;
    }
    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument doc(512);
    
    // Slot 1 Daten
    String slot1PbId = readPowerbankID(slots[0].eepromChannel);
    if (slots[0].batteryPresent && slots[0].batteryInitialized) {
      doc["slot_1_powerbank_id"] = slot1PbId.length() > 0 ? slot1PbId : (const char*)nullptr;
      doc["slot_1_battery_voltage"] = (int)(slots[0].batteryVoltage * 100) / 100.0;
      doc["slot_1_battery_percentage"] = slots[0].batteryPercentage;
    } else {
      doc["slot_1_powerbank_id"] = nullptr;
      doc["slot_1_battery_voltage"] = nullptr;
      doc["slot_1_battery_percentage"] = nullptr;
    }
    
    // Slot 2 Daten
    String slot2PbId = readPowerbankID(slots[1].eepromChannel);
    if (slots[1].batteryPresent && slots[1].batteryInitialized) {
      doc["slot_2_powerbank_id"] = slot2PbId.length() > 0 ? slot2PbId : (const char*)nullptr;
      doc["slot_2_battery_voltage"] = (int)(slots[1].batteryVoltage * 100) / 100.0;
      doc["slot_2_battery_percentage"] = slots[1].batteryPercentage;
    } else {
      doc["slot_2_powerbank_id"] = nullptr;
      doc["slot_2_battery_voltage"] = nullptr;
      doc["slot_2_battery_percentage"] = nullptr;
    }
    
    // Abwärtskompatibilität: Setze die alten Felder auf den besten Slot
    int bestSlot = chooseBestSlot();
    if (bestSlot >= 0) {
      String bestPbId = readPowerbankID(slots[bestSlot].eepromChannel);
      doc["powerbank_id"] = bestPbId.length() > 0 ? bestPbId : (const char*)nullptr;
      doc["battery_voltage"] = (int)(slots[bestSlot].batteryVoltage * 100) / 100.0;
      doc["battery_percentage"] = slots[bestSlot].batteryPercentage;
    } else {
      doc["powerbank_id"] = nullptr;
      doc["battery_voltage"] = nullptr;
      doc["battery_percentage"] = nullptr;
    }

    String jsonBody;
    serializeJson(doc, jsonBody);
    int httpCode = http.PATCH(jsonBody);
    String responseBody = (httpCode > 0) ? http.getString() : "";
    http.end();

    if (httpCode == 200) {
      break;
    }

    String httpError = HTTPClient::errorToString(httpCode);
    if (attempt == 0) {
      Serial.println("Proxy Battery-Update Fehler (HTTP " + String(httpCode) + ": " + httpError + "), Retry...");
      delay(500);
    } else {
      Serial.println("Proxy Battery-Update fehlgeschlagen nach Retry: HTTP " + String(httpCode) + " (" + httpError + ")");
      if (responseBody.length() > 0) {
        Serial.println("Proxy Antwort: " + responseBody);
      }
    }
  }
}

// Abwärtskompatibilität: updateBatteryData() sendet jetzt alle Slots
void updateBatteryData() {
  updateAllSlotsBatteryData();
}

// ===== HILFSFUNKTIONEN =====

void printDebugInfo() {
  Serial.println("\n=== DEBUG INFO ===");
  Serial.println("WLAN Status: " + String(WiFi.status() == WL_CONNECTED ? "Verbunden" : "Getrennt"));
  Serial.println("IP: " + WiFi.localIP().toString());
  Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("Uptime: " + String(millis() / 1000) + " Sekunden");
  if (slots[0].batteryInitialized) {
    Serial.println("Batterie: " + String(slots[0].batteryVoltage, 2) + " V (" + String(slots[0].batteryPercentage) + "%)");
  }
  Serial.println("==================\n");
}

// ===== EEPROM FUNKTIONEN (24C02) =====

// Findet EEPROM-Adresse auf dem Kanal (0x50-0x57). Auf Batterie-Kanälen wird 0x55 übersprungen (Fuel Gauge!).
uint8_t findEEPROMAddressOnChannel(uint8_t channel) {
  if (channel > 7) return 0;
  selectI2CChannel(channel);
  delay(10);
  for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
    // 0x55 auf Batterie-Kanälen = Fuel Gauge → überspringen
    if ((channel == SLOT_1_BATTERY_CHANNEL || channel == SLOT_2_BATTERY_CHANNEL) && addr == 0x55) continue;
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

  Serial.println("--- EEPROM Scan (Slot 1: Kanal " + String(SLOT_1_EEPROM_CHANNEL) + ", Slot 2: Kanal " + String(SLOT_2_EEPROM_CHANNEL) + ") ---");

  uint8_t eepromChannels[] = { SLOT_1_EEPROM_CHANNEL, SLOT_2_EEPROM_CHANNEL };
  
  for (uint8_t slotIdx = 0; slotIdx < TOTAL_SLOTS; slotIdx++) {
    uint8_t channel = eepromChannels[slotIdx];
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
  
  uint8_t eepromChannels[] = { SLOT_1_EEPROM_CHANNEL, SLOT_2_EEPROM_CHANNEL };
  
  for (uint8_t slotIdx = 0; slotIdx < TOTAL_SLOTS; slotIdx++) {
    uint8_t channel = eepromChannels[slotIdx];
    String newID = generatePowerbankID(channel);
    if (initEEPROM(channel)) {
      Serial.println("  → Slot " + String(slotIdx + 1) + " (Kanal " + String(channel) + "): Setze ID \"" + newID + "\"...");
      if (writePowerbankID(channel, newID)) {
        Serial.println("  ✓ Slot " + String(slotIdx + 1) + " erfolgreich initialisiert");
      } else {
        Serial.println("  ✗ Slot " + String(slotIdx + 1) + " Fehler beim Schreiben");
      }
    } else {
      Serial.println("  EEPROM FEHLER: Kanal " + String(channel) + " – kein Chip gefunden (0x50–0x57). Verdrahtung prüfen.");
    }
    delay(50);
  }
  
  Serial.println();
  Serial.println("→ Verifiziere alle IDs...");
  scanAllPowerbankIDs();
}

