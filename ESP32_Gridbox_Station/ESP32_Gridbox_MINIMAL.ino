/*
 * Gridbox ESP32 - MINIMAL VERSION
 * 
 * Abgespeckte Version zum Debuggen
 * Startet garantiert ohne Crashes!
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== KONFIGURATION =====
const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASSWORD = "DEIN_WLAN_PASSWORT";
const char* SUPABASE_URL = "https://deinprojekt.supabase.co";
const char* SUPABASE_KEY = "dein_key_hier";
const char* STATION_SHORT_CODE = "88SH";

#define LED_PIN 2
#define USE_SHORT_CODE true

// Globale Variablen
bool isConnected = false;
bool dispenseLEDActive = false;
unsigned long dispenseLEDStartTime = 0;
unsigned long lastDispenseCheck = 0;
unsigned long lastDispenseTime = 0;

void setup() {
  // Serial ZUERST starten
  Serial.begin(115200);
  delay(3000);  // Extra lange warten
  
  Serial.println("\n\n=== ESP32 STARTET ===");
  Serial.println("Minimal-Version zum Debuggen");
  Serial.println("Wenn du das liest: Serial funktioniert!");
  Serial.println();
  
  // LED Pin konfigurieren (NUR DIESER!)
  Serial.println("→ Konfiguriere LED Pin...");
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.println("✓ LED Pin OK");
  
  // Test-Blink
  Serial.println("→ Test-Blink...");
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("✓ LED Test OK");
  
  // WiFi verbinden
  Serial.println("\n→ Verbinde WiFi...");
  connectWiFi();
  
  Serial.println("\n=== SETUP FERTIG ===");
  Serial.println("ESP32 läuft stabil!");
  Serial.println("Drücke Ausleihen in der App um LED zu testen");
  Serial.println();
}

void loop() {
  // Status alle 10 Sekunden
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 10000) {
    Serial.println("✓ ESP32 läuft... Uptime: " + String(millis()/1000) + "s");
    lastStatus = millis();
  }
  
  // LED Steuerung
  if (dispenseLEDActive) {
    unsigned long elapsed = millis() - dispenseLEDStartTime;
    
    if (elapsed < 5000) {
      // Blinken
      bool state = (millis() / 200) % 2;
      digitalWrite(LED_PIN, state);
    } else {
      // Stopp
      digitalWrite(LED_PIN, LOW);
      dispenseLEDActive = false;
      Serial.println("✓ LED gestoppt nach 5 Sekunden");
    }
  }
  
  // Prüfe auf Ausgabe-Anfrage (alle 2 Sekunden)
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastDispenseCheck > 2000) {
      checkDispenseRequest();
      lastDispenseCheck = millis();
    }
  }
  
  delay(100);
}

void connectWiFi() {
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi OK!");
    Serial.println("IP: " + WiFi.localIP().toString());
    isConnected = true;
  } else {
    Serial.println("\n✗ WiFi Fehler!");
    isConnected = false;
  }
}

void checkDispenseRequest() {
  if (!isConnected) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/stations?short_code=eq." + String(STATION_SHORT_CODE) + "&select=dispense_requested";
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload);
    
    if (doc.is<JsonArray>() && doc.size() > 0) {
      bool requested = doc[0]["dispense_requested"] | false;
      
      if (requested) {
        unsigned long timeSince = millis() - lastDispenseTime;
        if (timeSince > 10000) {
          Serial.println("\n🚨 AUSGABE ERKANNT!");
          lastDispenseTime = millis();
          
          // Flag zurücksetzen
          resetDispenseFlag();
          
          // LED aktivieren
          dispenseLEDActive = true;
          dispenseLEDStartTime = millis();
          Serial.println("💡 LED startet...");
        }
      }
    }
  }
  
  http.end();
}

void resetDispenseFlag() {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/stations?short_code=eq." + String(STATION_SHORT_CODE);
  
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  
  String body = "{\"dispense_requested\":false}";
  int code = http.PATCH(body);
  
  if (code == 200 || code == 204) {
    Serial.println("✓ Flag zurückgesetzt");
  }
  
  http.end();
}

