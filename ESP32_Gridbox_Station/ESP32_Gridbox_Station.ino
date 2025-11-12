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
// Wähle deine Sensor-Methode (nur EINE auf true setzen):
#define USE_IR_SENSORS true       // Infrarot-Sensoren für jeden Slot
#define USE_HALL_SENSORS false    // Hall-Effekt-Sensoren (Magnet)
#define USE_TOUCH_SENSORS false   // Kapazitive Touch-Sensoren
#define USE_WEIGHT_SENSOR false   // Gewichtssensor (HX711)

// Anzahl der Powerbank-Slots in dieser Station
#define TOTAL_SLOTS 8

// Pin-Konfiguration für Sensoren (je nach Methode)
#if USE_IR_SENSORS
  // IR-Sensor Pins (einer pro Slot)
  const int sensorPins[TOTAL_SLOTS] = {25, 26, 27, 32, 33, 34, 35, 36};
  #define SENSOR_ACTIVE HIGH  // HIGH = Powerbank vorhanden, LOW = leer
#elif USE_HALL_SENSORS
  // Hall-Sensor Pins
  const int sensorPins[TOTAL_SLOTS] = {25, 26, 27, 32, 33, 34, 35, 36};
  #define SENSOR_ACTIVE LOW   // LOW = Magnet erkannt (Powerbank da)
#elif USE_TOUCH_SENSORS
  // Touch-Sensor Pins (ESP32 Touch0-Touch9)
  const int touchPins[TOTAL_SLOTS] = {T0, T1, T2, T3, T4, T5, T6, T7};
  #define TOUCH_THRESHOLD 40  // Wert unter dem = berührt/belegt
#elif USE_WEIGHT_SENSOR
  #define LOADCELL_DOUT_PIN 4
  #define LOADCELL_SCK_PIN 5
  #define POWERBANK_WEIGHT 150.0  // Gewicht pro Powerbank in Gramm
  // HX711 scale; // Wird unten initialisiert
#endif

// LED Pins
#define LED_PIN 2           // Eingebaute LED (wird bei Ausgabe aktiviert)
#define STATUS_LED_PIN 23   // Externe Status-LED (optional)

// Ausgabe-LED Konfiguration
#define DISPENSE_LED_DURATION 5000   // LED leuchtet 5 Sekunden bei Ausgabe
#define DISPENSE_POLL_INTERVAL 2000  // Prüfe alle 2 Sekunden auf Ausgabe-Anfrage

// Update-Intervall
const unsigned long UPDATE_INTERVAL = 30000;  // 30 Sekunden

// ===== ENDE KONFIGURATION =====

// Globale Variablen
unsigned long lastUpdate = 0;
unsigned long lastDispenseCheck = 0;
int currentAvailableUnits = 0;
int lastReportedUnits = -1;
bool isConnected = false;
bool dispenseLEDActive = false;
unsigned long dispenseLEDStartTime = 0;

void setup() {
  // Serielle Kommunikation starten
  Serial.begin(115200);
  delay(2000);  // Längere Wartezeit für Serielle Verbindung
  
  Serial.println("\n\n=================================");
  Serial.println("Gridbox ESP32 Station Controller");
  Serial.println("=================================\n");
  
  // Pins konfigurieren
  pinMode(LED_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  
  // Sensor-Pins initialisieren
  #if USE_IR_SENSORS || USE_HALL_SENSORS
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      pinMode(sensorPins[i], INPUT);
      Serial.println("Sensor Pin " + String(sensorPins[i]) + " initialisiert");
    }
  #elif USE_TOUCH_SENSORS
    // Touch-Pins brauchen keine pinMode-Konfiguration
    Serial.println("Touch-Sensoren initialisiert (T0-T" + String(TOTAL_SLOTS-1) + ")");
  #elif USE_WEIGHT_SENSOR
    // HX711 Gewichtssensor initialisieren (benötigt HX711 Bibliothek)
    // scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    // scale.set_scale(2280.f);  // Kalibrierungsfaktor
    // scale.tare();
    Serial.println("Gewichtssensor initialisiert");
  #endif
  
  // LED-Test
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  
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
      digitalWrite(LED_PIN, (millis() / 200) % 2);
    } else {
      // Zeit abgelaufen, LED ausschalten
      digitalWrite(LED_PIN, LOW);
      dispenseLEDActive = false;
      Serial.println("✓ Ausgabe-LED deaktiviert");
    }
  } else {
    // Normales Status-Blinken (kurz, nur wenn keine Ausgabe aktiv)
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
  
  // === PRÜFE AUF AUSGABE-ANFRAGE ===
  if (millis() - lastDispenseCheck > DISPENSE_POLL_INTERVAL) {
    checkDispenseRequest();
    lastDispenseCheck = millis();
  }
  
  // Lese Sensoren und zähle verfügbare Powerbanks
  int detectedUnits = countAvailableUnits();
  
  // Wenn sich die Anzahl geändert hat, sofort updaten
  if (detectedUnits != lastReportedUnits) {
    Serial.println("\n--- Änderung erkannt! ---");
    Serial.print("Vorher: ");
    Serial.print(lastReportedUnits);
    Serial.print(" → Jetzt: ");
    Serial.println(detectedUnits);
    
    updateAvailableUnits(detectedUnits);
    lastReportedUnits = detectedUnits;
  }
  
  // Regelmäßiger Update alle UPDATE_INTERVAL Millisekunden
  if (millis() - lastUpdate > UPDATE_INTERVAL) {
    Serial.println("\n--- Regelmäßiger Status-Update ---");
    getStationData();
    updateAvailableUnits(detectedUnits);
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
        // 🎉 AUSGABE-ANFRAGE ERKANNT!
        Serial.println("\n🚨🚨🚨 AUSGABE-ANFRAGE ERKANNT! 🚨🚨🚨");
        Serial.println("Powerbank-Ausgabe wurde über die App angefordert!");
        
        // Aktiviere LED
        activateDispenseLED();
        
        // Setze Flag in Datenbank zurück
        resetDispenseFlag();
      }
    }
  }
  
  http.end();
}

void activateDispenseLED() {
  Serial.println("\n💡 LED-Ausgabe aktiviert!");
  Serial.println("LED blinkt für " + String(DISPENSE_LED_DURATION / 1000) + " Sekunden...");
  
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
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
  http.addHeader("Prefer", "return=minimal");
  
  // Setze dispense_requested zurück und aktualisiere last_dispense_time
  DynamicJsonDocument doc(256);
  doc["dispense_requested"] = false;
  doc["last_dispense_time"] = "now()";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.PATCH(jsonBody);
  
  if (httpCode == 200 || httpCode == 204) {
    Serial.println("✓ Ausgabe-Flag zurückgesetzt");
  } else {
    Serial.println("⚠️ Fehler beim Zurücksetzen: " + String(httpCode));
  }
  
  http.end();
}

// ===== SENSOR FUNKTIONEN =====

int countAvailableUnits() {
  int count = 0;
  
  #if USE_IR_SENSORS
    // === IR-SENSOREN (Infrarot) ===
    // Jeder Sensor erkennt ob ein Objekt (Powerbank) vorhanden ist
    // Typische IR-Module: FC-51, TCRT5000, etc.
    
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      int sensorState = digitalRead(sensorPins[i]);
      
      if (sensorState == SENSOR_ACTIVE) {
        count++;
      }
      
      // Debug-Output (kann entfernt werden wenn alles läuft)
      if (i == 0 || (millis() % 10000 < 100)) {  // Nur alle 10 Sek loggen
        Serial.print("Slot " + String(i) + ": ");
        Serial.println(sensorState == SENSOR_ACTIVE ? "BELEGT" : "LEER");
      }
    }
    
  #elif USE_HALL_SENSORS
    // === HALL-EFFEKT-SENSOREN (Magnet-Erkennung) ===
    // Powerbanks haben kleine Magneten, Sensoren erkennen diese
    // Typische Module: A3144, OH137, SS49E
    
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      int sensorState = digitalRead(sensorPins[i]);
      
      if (sensorState == SENSOR_ACTIVE) {  // LOW wenn Magnet erkannt
        count++;
      }
      
      // Debug
      if (millis() % 10000 < 100) {
        Serial.print("Slot " + String(i) + " Hall: ");
        Serial.println(sensorState == SENSOR_ACTIVE ? "MAGNET" : "KEIN MAGNET");
      }
    }
    
  #elif USE_TOUCH_SENSORS
    // === KAPAZITIVE TOUCH-SENSOREN ===
    // ESP32 hat eingebaute Touch-Pins
    // Leitfähige Fläche pro Slot erkennt Powerbank
    
    for (int i = 0; i < TOTAL_SLOTS; i++) {
      int touchValue = touchRead(touchPins[i]);
      
      if (touchValue < TOUCH_THRESHOLD) {  // Niedriger Wert = berührt/belegt
        count++;
      }
      
      // Debug
      if (millis() % 10000 < 100) {
        Serial.print("Touch " + String(i) + ": " + String(touchValue));
        Serial.println(touchValue < TOUCH_THRESHOLD ? " BELEGT" : " LEER");
      }
    }
    
  #elif USE_WEIGHT_SENSOR
    // === GEWICHTSSENSOR (Load Cell mit HX711) ===
    // Wiegt alle Powerbanks zusammen
    // Berechnet Anzahl basierend auf Gesamtgewicht
    // HINWEIS: Benötigt HX711 Bibliothek!
    
    // float totalWeight = scale.get_units(5);  // 5 Messungen mitteln
    // count = (int)(totalWeight / POWERBANK_WEIGHT);
    
    // // Sicherstellen dass count im gültigen Bereich ist
    // if (count < 0) count = 0;
    // if (count > TOTAL_SLOTS) count = TOTAL_SLOTS;
    
    // // Debug
    // if (millis() % 10000 < 100) {
    //   Serial.println("Gewicht: " + String(totalWeight) + "g = " + String(count) + " Powerbanks");
    // }
    
    // TEMPORÄR: Wenn Weight-Sensor gewählt aber nicht implementiert
    Serial.println("⚠️ WARNUNG: Gewichtssensor gewählt aber HX711-Code auskommentiert!");
    Serial.println("Entferne die Kommentare oben und installiere 'HX711' Bibliothek!");
    count = 0;  // Fallback
    
  #else
    // === KEINE SENSOR-METHODE GEWÄHLT ===
    Serial.println("❌ FEHLER: Keine Sensor-Methode aktiviert!");
    Serial.println("Setze eine der USE_*_SENSORS Optionen auf true!");
    count = 0;
    
  #endif
  
  return count;
}

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

