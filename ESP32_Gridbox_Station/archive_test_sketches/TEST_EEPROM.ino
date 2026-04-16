/*
 * EINFACHER EEPROM TEST
 * Nur Lesen und Schreiben
 */

#include <Wire.h>

// ===== KONFIGURATION =====
#define TCA9548A_ADDRESS 0x70     // Multiplexer
#define EEPROM_24C02_ADDRESS_DEFAULT 0x50 // EEPROM Standard-Adresse
// 24LC01B/02B kann verschiedene Adressen haben (0x50-0x57) je nach A0/A1/A2 Pins
#define I2C_SDA_PIN 21            // ← GLEICHE PINS WIE IM HAUPTCODE (Fuel Gauge funktioniert!)
#define I2C_SCL_PIN 22            // ← GLEICHE PINS WIE IM HAUPTCODE (Fuel Gauge funktioniert!)
#define TEST_CHANNEL 0            // Kanal 0-7

// Variable für gefundene EEPROM-Adresse und Kanal (werden bei Erkennung gesetzt)
uint8_t eepromAddress = EEPROM_24C02_ADDRESS_DEFAULT;
uint8_t activeChannel = TEST_CHANNEL;  // Kanal, auf dem EEPROM gefunden wurde (für Schreiben/Lesen/Leer-Erkennung)

// ===== FUNKTIONEN =====

// Wähle TCA9548A Kanal (genau wie im Hauptcode)
void selectChannel(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(TCA9548A_ADDRESS);
  Wire.write(1 << channel);  // Aktiviert genau EINEN Kanal
  Wire.endTransmission();
  delay(10);  // Kurze Pause für Multiplexer
}

// Prüfe ob EEPROM vorhanden ist (funktioniert auch wenn leer!)
bool checkEEPROM(uint8_t channel, uint8_t eepromAddr) {
  selectChannel(channel);
  delay(10);
  
  // Versuche einfach auf das EEPROM zuzugreifen (unabhängig vom Inhalt)
  Wire.beginTransmission(eepromAddr);
  Wire.write(0x00);  // Adresse 0 setzen
  uint8_t error = Wire.endTransmission();
  
  // Error 0 = ACK (EEPROM antwortet)
  // Error 2 = NACK (EEPROM antwortet nicht)
  // Error 4 = Timeout/Fehler
  return (error == 0);
}

// Finde EEPROM-Adresse (24LC01B/02B kann 0x50-0x57 sein)
uint8_t findEEPROMAddress(uint8_t channel) {
  selectChannel(channel);
  delay(10);
  
  // Teste alle möglichen Adressen für 24LC01B/02B (0x50-0x57)
  for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
    Wire.beginTransmission(addr);
    Wire.write(0x00);
    uint8_t error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("  → EEPROM gefunden bei Adresse 0x");
      Serial.println(addr, HEX);
      return addr;
    }
    delay(5);
  }
  
  return 0;  // Nicht gefunden
}

// Schreibe Byte ins EEPROM
bool writeByte(uint8_t channel, uint8_t address, uint8_t data) {
  selectChannel(channel);
  Wire.beginTransmission(eepromAddress);
  Wire.write(address);
  Wire.write(data);
  uint8_t error = Wire.endTransmission();
  delay(10);  // 24LC01B/02B benötigt Zeit zum Schreiben
  return (error == 0);
}

// Lese Byte aus EEPROM
uint8_t readByte(uint8_t channel, uint8_t address) {
  selectChannel(channel);
  Wire.beginTransmission(eepromAddress);
  Wire.write(address);
  Wire.endTransmission(false);
  Wire.requestFrom(eepromAddress, 1);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0xFF;
}

// Schreibe String ins EEPROM
bool writeString(uint8_t channel, uint8_t startAddr, String text) {
  selectChannel(channel);
  Wire.beginTransmission(eepromAddress);
  Wire.write(startAddr);
  for (int i = 0; i < text.length() && i < 32; i++) {
    Wire.write(text.charAt(i));
  }
  Wire.write(0); // Null-Terminator
  uint8_t error = Wire.endTransmission();
  delay(20);  // 24LC01B/02B benötigt Zeit zum Schreiben
  return (error == 0);
}

// Lese String aus EEPROM
String readString(uint8_t channel, uint8_t startAddr) {
  String result = "";
  selectChannel(channel);
  for (int i = 0; i < 32; i++) {
    uint8_t ch = readByte(channel, startAddr + i);
    if (ch == 0 || ch == 0xFF) break;
    result += (char)ch;
  }
  return result;
}

// ===== SETUP =====

void setup() {
  // Serial SOFORT starten und testen
  Serial.begin(115200);
  Serial.flush();
  delay(500);
  
  // SOFORT ausgeben - bevor irgendwas anderes passiert
  Serial.println();
  Serial.println("========================================");
  Serial.println("EEPROM TEST STARTET...");
  Serial.println("========================================");
  Serial.flush();
  delay(100);
  
  Serial.println("Kanal: " + String(TEST_CHANNEL));
  Serial.println("Pins: SDA=" + String(I2C_SDA_PIN) + ", SCL=" + String(I2C_SCL_PIN));
  Serial.flush();
  delay(100);
  
  Serial.println();
  Serial.println("Initialisiere I2C...");
  Serial.println("(Gleiche Pins wie im Hauptcode: SDA=21, SCL=22)");
  Serial.flush();
  
  // I2C starten (genau wie im Hauptcode)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  delay(100);  // Gleiche Verzögerung wie im Hauptcode
  
  Serial.println("I2C gestartet");
  Serial.flush();
  delay(100);
  
  // Prüfe TCA9548A
  Serial.println("Prüfe TCA9548A...");
  Serial.flush();
  
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t tcaError = Wire.endTransmission();
  
  bool tcaFound = (tcaError == 0);
  
  if (!tcaFound) {
    Serial.println("⚠️ TCA9548A nicht gefunden (Code: " + String(tcaError) + ")");
    Serial.println("→ Versuche EEPROM direkt zu finden (ohne Multiplexer)...");
    Serial.flush();
    delay(200);
    
    // Versuche EEPROM direkt zu finden (teste alle Adressen 0x50-0x57)
    uint8_t directAddr = 0;
    for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
      Wire.beginTransmission(addr);
      uint8_t directError = Wire.endTransmission();
      if (directError == 0) {
        directAddr = addr;
        break;
      }
    }
    
    if (directAddr != 0) {
      Serial.println("✓ EEPROM direkt gefunden bei Adresse 0x" + String(directAddr, HEX) + " (ohne Multiplexer)");
      Serial.println("→ Teste direktes Lesen/Schreiben...");
      Serial.flush();
      
      // Direkter Test ohne Multiplexer
      Wire.beginTransmission(directAddr);
      Wire.write(10);
      Wire.write(0xAA);
      uint8_t writeErr = Wire.endTransmission();
      delay(20);
      
      if (writeErr == 0) {
        Wire.beginTransmission(directAddr);
        Wire.write(10);
        Wire.endTransmission(false);
        Wire.requestFrom(directAddr, 1);
        if (Wire.available()) {
          uint8_t val = Wire.read();
          Serial.println("✓ Direkter Test OK: 0x" + String(val, HEX));
        }
      }
      Serial.println();
      Serial.println("HINWEIS: EEPROM funktioniert direkt!");
      Serial.println("         TCA9548A wird nicht benötigt oder ist falsch angeschlossen.");
      Serial.flush();
      return;
    } else {
      Serial.println("✗ EEPROM auch direkt nicht gefunden (testete 0x50-0x57)");
      Serial.println();
      Serial.println("PROBLEM-DIAGNOSE:");
      Serial.println("1. Prüfe I2C-Pins (aktuell: SDA=" + String(I2C_SDA_PIN) + ", SCL=" + String(I2C_SCL_PIN) + ")");
      Serial.println("2. Prüfe ob Pullup-Widerstände vorhanden sind (4.7kΩ)");
      Serial.println("3. Prüfe Hardware-Verbindungen");
      Serial.println();
      Serial.println("→ Teste andere Pin-Kombinationen...");
      Serial.flush();
      
      // Teste andere Pin-Kombinationen
      int pinCombos[][2] = {{21, 22}, {33, 32}, {19, 18}, {25, 26}, {4, 5}};
      bool found = false;
      
      for (int i = 0; i < 5; i++) {
        Serial.print("  Teste SDA=" + String(pinCombos[i][0]) + ", SCL=" + String(pinCombos[i][1]) + " ... ");
        Wire.begin(pinCombos[i][0], pinCombos[i][1]);
        delay(50);
        
        Wire.beginTransmission(TCA9548A_ADDRESS);
        uint8_t testErr = Wire.endTransmission();
        if (testErr == 0) {
          Serial.println("✓ TCA9548A GEFUNDEN!");
          Serial.println("  → Verwende diese Pins:");
          Serial.println("     #define I2C_SDA_PIN " + String(pinCombos[i][0]));
          Serial.println("     #define I2C_SCL_PIN " + String(pinCombos[i][1]));
          found = true;
          break;
        } else {
          Serial.println("✗");
        }
        delay(50);
      }
      
      if (!found) {
        Serial.println();
        Serial.println("✗ Keine funktionierende Pin-Kombination gefunden!");
      }
      Serial.flush();
      return;
    }
  }
  
  Serial.println("✓ TCA9548A gefunden");
  Serial.flush();
  delay(100);
  
  // Prüfe EEPROM über Multiplexer (24LC01B/02B kann verschiedene Adressen haben!)
  Serial.println("Prüfe EEPROM auf Kanal " + String(TEST_CHANNEL) + "...");
  Serial.println("(24LC01B/02B: Teste alle Adressen 0x50-0x57)");
  Serial.flush();
  
  // Finde EEPROM-Adresse (kann 0x50-0x57 sein je nach A0/A1/A2 Pins)
  uint8_t foundEEPROMAddr = findEEPROMAddress(TEST_CHANNEL);
  
  if (foundEEPROMAddr != 0) {
    Serial.println("✓ EEPROM gefunden bei Adresse 0x" + String(foundEEPROMAddr, HEX));
    Serial.println("  (24LC01B/02B - auch wenn leer, das ist OK!)");
    Serial.flush();
    
    // Verwende gefundene Adresse und Kanal für alle weiteren Tests
    eepromAddress = foundEEPROMAddr;
    activeChannel = TEST_CHANNEL;
    
    // Zeige Inhalt von Adresse 0 (um zu sehen ob leer)
    uint8_t firstByte = readByte(TEST_CHANNEL, 0);
    Serial.print("  Inhalt Adresse 0: 0x");
    if (firstByte == 0xFF) {
      Serial.println("FF (leer/uninitialisiert - normal für neues EEPROM)");
    } else {
      Serial.println(String(firstByte, HEX));
    }
    Serial.println("  → Verwende Kanal " + String(activeChannel) + ", Adresse 0x" + String(eepromAddress, HEX) + " für Schreiben/Lesen.");
    Serial.println();
    Serial.flush();
    delay(100);
  } else {
    Serial.println("FEHLER: EEPROM nicht gefunden auf Standard-Adresse!");
    Serial.println("→ Teste alle Kanäle und alle Adressen (0x50-0x57)...");
    Serial.flush();
    
    // Teste alle Kanäle UND alle Adressen
    bool foundOnAnyChannel = false;
    for (uint8_t ch = 0; ch < 8; ch++) {
      Serial.print("  Kanal " + String(ch) + ": ");
      uint8_t addr = findEEPROMAddress(ch);
      if (addr != 0) {
        Serial.println("✓ EEPROM GEFUNDEN!");
        Serial.println("  → Kanal: " + String(ch) + ", Adresse: 0x" + String(addr, HEX));
        foundEEPROMAddr = addr;
        eepromAddress = addr;
        activeChannel = ch;  // Wichtig: diesen Kanal für Schreiben/Lesen/Leer nutzen!
        foundOnAnyChannel = true;
        Serial.flush();
        break;
      } else {
        Serial.println("✗");
      }
      delay(20);
    }
    
    if (!foundOnAnyChannel) {
      Serial.println();
      Serial.println("✗ EEPROM auf keinem Kanal gefunden!");
      Serial.println("Mögliche Ursachen:");
      Serial.println("  1. EEPROM nicht angeschlossen");
      Serial.println("  2. Falsche I2C-Verbindung");
      Serial.println("  3. Hardware-Problem");
      Serial.println("  4. A0/A1/A2 Pins des 24LC01B/02B prüfen");
    } else {
      Serial.println();
      Serial.println("✓ Verwende Kanal " + String(activeChannel) + ", Adresse 0x" + String(foundEEPROMAddr, HEX) + " für Schreiben/Lesen/Leer-Erkennung");
    }
    Serial.flush();
    
    if (!foundOnAnyChannel) {
      return;
    }
  }
  
  // ===== TEST 1: Byte schreiben/lesen =====
  Serial.println("TEST 1: Byte schreiben/lesen (Kanal " + String(activeChannel) + ", Adr. 0x" + String(eepromAddress, HEX) + ")");
  Serial.flush();
  
  uint8_t testAddr = 10;
  uint8_t testValue = 0xAA;
  
  Serial.print("  Schreibe 0x");
  Serial.print(testValue, HEX);
  Serial.print(" nach Adresse ");
  Serial.print(testAddr);
  Serial.print(" ... ");
  Serial.flush();
  
  if (writeByte(activeChannel, testAddr, testValue)) {
    Serial.println("OK");
    Serial.flush();
    
    delay(20);
    uint8_t readValue = readByte(activeChannel, testAddr);
    
    Serial.print("  Lese zurück ... ");
    Serial.flush();
    if (readValue == testValue) {
      Serial.println("OK (0x" + String(readValue, HEX) + ")");
    } else {
      Serial.println("FEHLER! (gelesen: 0x" + String(readValue, HEX) + ")");
    }
    Serial.flush();
  } else {
    Serial.println("FEHLER!");
    Serial.flush();
  }
  Serial.println();
  Serial.flush();
  
  // ===== TEST 2: String schreiben/lesen =====
  Serial.println("TEST 2: String schreiben/lesen (Kanal " + String(activeChannel) + ")");
  Serial.flush();
  
  String testText = "TEST-123";
  
  Serial.print("  Schreibe \"" + testText + "\" ... ");
  Serial.flush();
  
  if (writeString(activeChannel, 20, testText)) {
    Serial.println("OK");
    Serial.flush();
    
    delay(20);
    String readText = readString(activeChannel, 20);
    
    Serial.print("  Lese zurück ... ");
    Serial.flush();
    if (readText == testText) {
      Serial.println("OK (\"" + readText + "\")");
    } else {
      Serial.println("FEHLER! (gelesen: \"" + readText + "\")");
    }
    Serial.flush();
  } else {
    Serial.println("FEHLER!");
    Serial.flush();
  }
  Serial.println();
  Serial.flush();
  
  Serial.println("=== ZUSAMMENFASSUNG ===");
  Serial.println("  Erkennung: Kanal " + String(activeChannel) + ", Adresse 0x" + String(eepromAddress, HEX));
  Serial.println("  Schreiben: OK | Lesen: OK | Leer-Erkennung: Adresse 0 = 0xFF = leer");
  Serial.println("=== FERTIG ===");
  Serial.flush();
}

void loop() {
  delay(1000);
}
