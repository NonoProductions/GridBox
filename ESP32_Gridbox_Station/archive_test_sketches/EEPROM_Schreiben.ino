/*
 * EEPROM_Schreiben.ino
 * =====================
 * Manuelles Schreiben einer beliebigen Powerbank-ID in das EEPROM (24LC01B/02B)
 * am TCA9548A I2C-Multiplexer.
 *
 * ANLEITUNG:
 *   1. Unten bei NEUE_POWERBANK_ID den gewünschten Wert eintragen (z.B. "88SH-1")
 *   2. EEPROM_CHANNEL anpassen falls nötig (Standard: Kanal 2)
 *   3. Sketch hochladen, Serial Monitor öffnen (115200 Baud)
 *   4. Der aktuelle Inhalt wird angezeigt
 *   5. Tippe 'j' + Enter um zu schreiben, oder 'n' zum Abbrechen
 *   6. Nach dem Schreiben wird der Inhalt verifiziert
 *
 * INTERAKTIV:
 *   Im Serial Monitor kannst du jederzeit einen neuen Wert eingeben:
 *     id:MeinNeuerWert   → Setzt die neue ID
 *     read               → Liest und zeigt die aktuelle ID
 *     dump               → Zeigt Rohdaten der ersten 64 Bytes
 *     erase              → Löscht die ID (setzt Magic Byte auf 0xFF)
 *     scan               → Scannt alle TCA-Kanäle nach EEPROMs
 */

#include <Wire.h>

// ===== KONFIGURATION =====
#define NEUE_POWERBANK_ID  "88SH-2"   // ← HIER DEINE GEWÜNSCHTE ID EINTRAGEN
#define EEPROM_CHANNEL     2          // TCA9548A Kanal (0-7) auf dem das EEPROM hängt
#define I2C_SDA_PIN        21
#define I2C_SCL_PIN        22

// ===== HARDWARE ADRESSEN =====
#define TCA9548A_ADDRESS      0x70
#define BATTERY_CHANNEL       0       // Kanal des Fuel Gauge (0x55 dort überspringen)
#define EEPROM_MAGIC_BYTE     0xAA
#define EEPROM_MAGIC_ADDRESS  0x00
#define EEPROM_ID_DATA_ADDRESS 0x01
#define EEPROM_ID_MAX_LENGTH  32
#define EEPROM_DUMP_BYTES     64

// ===== GLOBALE VARIABLEN =====
uint8_t eepromAddress = 0;     // Erkannte I2C-Adresse des EEPROMs
uint8_t activeChannel = EEPROM_CHANNEL;
String pendingID = NEUE_POWERBANK_ID;
bool waitingForConfirm = false;

// ===== I2C HILFSFUNKTIONEN =====

void selectI2CChannel(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(TCA9548A_ADDRESS);
  Wire.write(1 << channel);
  Wire.endTransmission();
  delay(10);
}

uint8_t findEEPROMOnChannel(uint8_t channel) {
  if (channel > 7) return 0;
  selectI2CChannel(channel);
  delay(10);
  for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
    if (channel == BATTERY_CHANNEL && addr == 0x55) continue;
    Wire.beginTransmission(addr);
    Wire.write(0x00);
    if (Wire.endTransmission() == 0) {
      return addr;
    }
    delay(5);
  }
  return 0;
}

bool writeEEPROMByte(uint8_t address, uint8_t data) {
  if (eepromAddress == 0) return false;
  selectI2CChannel(activeChannel);
  delay(5);
  Wire.beginTransmission(eepromAddress);
  Wire.write(address);
  Wire.write(data);
  uint8_t err = Wire.endTransmission();
  delay(15);  // Schreibzyklus 24LC02: max 5ms, Puffer
  return (err == 0);
}

uint8_t readEEPROMByte(uint8_t address) {
  if (eepromAddress == 0) return 0xFF;
  selectI2CChannel(activeChannel);
  delay(5);
  Wire.beginTransmission(eepromAddress);
  Wire.write(address);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  Wire.requestFrom((uint16_t)eepromAddress, (uint8_t)1);
  if (Wire.available() < 1) return 0xFF;
  return Wire.read();
}

// ===== POWERBANK ID LESEN =====

String readPowerbankID() {
  uint8_t magic = readEEPROMByte(EEPROM_MAGIC_ADDRESS);
  if (magic != EEPROM_MAGIC_BYTE) return "";

  uint8_t idLength = readEEPROMByte(EEPROM_ID_DATA_ADDRESS);
  if (idLength == 0xFF || idLength == 0 || idLength > EEPROM_ID_MAX_LENGTH) return "";

  String id = "";
  for (uint8_t i = 0; i < idLength; i++) {
    uint8_t ch = readEEPROMByte(EEPROM_ID_DATA_ADDRESS + 1 + i);
    if (ch == 0xFF) return "";
    if (ch == 0x00) break;
    id += (char)ch;
  }
  return id;
}

// ===== POWERBANK ID SCHREIBEN =====

bool writePowerbankID(const String& id) {
  if (eepromAddress == 0) {
    Serial.println("FEHLER: Kein EEPROM erkannt!");
    return false;
  }
  if (id.length() == 0 || id.length() > EEPROM_ID_MAX_LENGTH) {
    Serial.println("FEHLER: ID ungültig (leer oder zu lang, max " + String(EEPROM_ID_MAX_LENGTH) + " Zeichen)");
    return false;
  }

  Serial.println("Schreibe ID: \"" + id + "\" (" + String(id.length()) + " Zeichen)");

  // Magic Byte
  if (!writeEEPROMByte(EEPROM_MAGIC_ADDRESS, EEPROM_MAGIC_BYTE)) {
    Serial.println("FEHLER: Magic Byte konnte nicht geschrieben werden!");
    return false;
  }

  // Länge
  if (!writeEEPROMByte(EEPROM_ID_DATA_ADDRESS, id.length())) {
    Serial.println("FEHLER: Länge konnte nicht geschrieben werden!");
    return false;
  }

  // ID Zeichen
  for (uint8_t i = 0; i < id.length(); i++) {
    if (!writeEEPROMByte(EEPROM_ID_DATA_ADDRESS + 1 + i, id.charAt(i))) {
      Serial.println("FEHLER: Zeichen " + String(i) + " konnte nicht geschrieben werden!");
      return false;
    }
  }

  // Null-Terminator
  if (id.length() < EEPROM_ID_MAX_LENGTH) {
    writeEEPROMByte(EEPROM_ID_DATA_ADDRESS + 1 + id.length(), 0x00);
  }

  // Verifizieren
  delay(50);
  String verify = readPowerbankID();
  if (verify == id) {
    Serial.println("OK: ID erfolgreich geschrieben und verifiziert!");
    return true;
  } else {
    Serial.println("FEHLER: Verifizierung fehlgeschlagen!");
    Serial.println("  Erwartet: \"" + id + "\"");
    Serial.println("  Gelesen:  \"" + verify + "\"");
    return false;
  }
}

// ===== ID LÖSCHEN =====

void eraseID() {
  Serial.println("Lösche ID (setze Magic Byte auf 0xFF)...");
  if (writeEEPROMByte(EEPROM_MAGIC_ADDRESS, 0xFF)) {
    Serial.println("OK: ID gelöscht. EEPROM erscheint jetzt als leer.");
  } else {
    Serial.println("FEHLER: Konnte Magic Byte nicht überschreiben!");
  }
}

// ===== ROHDUMP =====

void dumpRawEEPROM() {
  Serial.println("\n--- Rohdump (erste " + String(EEPROM_DUMP_BYTES) + " Bytes) ---");
  for (uint16_t i = 0; i < EEPROM_DUMP_BYTES; i += 16) {
    Serial.print("  ");
    if (i < 100) Serial.print(" ");
    if (i < 10)  Serial.print(" ");
    Serial.print(i);
    Serial.print(": ");
    for (uint8_t j = 0; j < 16 && (i + j) < EEPROM_DUMP_BYTES; j++) {
      uint8_t b = readEEPROMByte(i + j);
      if (b < 0x10) Serial.print("0");
      Serial.print(b, HEX);
      Serial.print(" ");
    }
    Serial.print(" | ");
    for (uint8_t j = 0; j < 16 && (i + j) < EEPROM_DUMP_BYTES; j++) {
      uint8_t b = readEEPROMByte(i + j);
      Serial.print((b >= 32 && b < 127) ? (char)b : '.');
    }
    Serial.println();
  }
  Serial.println("-------------------------------------------");
}

// ===== ALLE KANÄLE SCANNEN =====

void scanAllChannels() {
  Serial.println("\n--- Scan aller TCA9548A Kanäle ---");
  for (uint8_t ch = 0; ch <= 7; ch++) {
    uint8_t addr = findEEPROMOnChannel(ch);
    if (addr != 0) {
      // Kurzzeitig auf diesen Kanal wechseln um ID zu lesen
      uint8_t savedAddr = eepromAddress;
      uint8_t savedCh = activeChannel;
      eepromAddress = addr;
      activeChannel = ch;

      String id = readPowerbankID();

      eepromAddress = savedAddr;
      activeChannel = savedCh;

      Serial.print("  Kanal " + String(ch) + ": EEPROM 0x" + String(addr, HEX));
      if (id.length() > 0) {
        Serial.println(" → ID: \"" + id + "\"");
      } else {
        Serial.println(" → (leer/keine ID)");
      }
    } else {
      Serial.println("  Kanal " + String(ch) + ": -");
    }
  }
  Serial.println("-----------------------------------");
}

// ===== HILFE ANZEIGEN =====

void printHelp() {
  Serial.println();
  Serial.println("╔══════════════════════════════════════════╗");
  Serial.println("║     EEPROM Powerbank-ID Schreibtool      ║");
  Serial.println("╠══════════════════════════════════════════╣");
  Serial.println("║  Befehle:                                ║");
  Serial.println("║    id:WERT    Neue ID setzen             ║");
  Serial.println("║    read       Aktuelle ID anzeigen        ║");
  Serial.println("║    dump       Rohdaten anzeigen           ║");
  Serial.println("║    erase      ID löschen                  ║");
  Serial.println("║    scan       Alle Kanäle scannen         ║");
  Serial.println("║    help       Diese Hilfe anzeigen        ║");
  Serial.println("╚══════════════════════════════════════════╝");
  Serial.println();
}

// ===== SETUP =====

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════════╗");
  Serial.println("║   EEPROM Powerbank-ID Schreibtool            ║");
  Serial.println("║   Kanal: " + String(activeChannel) + " | SDA: " + String(I2C_SDA_PIN) + " | SCL: " + String(I2C_SCL_PIN) + "              ║");
  Serial.println("╚══════════════════════════════════════════════╝");
  Serial.println();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  delay(100);

  // TCA9548A prüfen
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err = Wire.endTransmission();
  if (err != 0) {
    Serial.println("FEHLER: TCA9548A nicht gefunden! (I2C Fehler " + String(err) + ")");
    Serial.println("Prüfe Verdrahtung: SDA=" + String(I2C_SDA_PIN) + ", SCL=" + String(I2C_SCL_PIN));
    return;
  }
  Serial.println("OK: TCA9548A gefunden");

  // EEPROM auf Kanal suchen
  eepromAddress = findEEPROMOnChannel(activeChannel);
  if (eepromAddress == 0) {
    Serial.println("FEHLER: Kein EEPROM auf Kanal " + String(activeChannel) + " gefunden!");
    Serial.println("Starte Scan aller Kanäle...");
    scanAllChannels();
    return;
  }
  Serial.println("OK: EEPROM auf Kanal " + String(activeChannel) + ", Adresse 0x" + String(eepromAddress, HEX));

  // Aktuelle ID lesen
  Serial.println();
  String currentID = readPowerbankID();
  if (currentID.length() > 0) {
    Serial.println("Aktuelle ID: \"" + currentID + "\"");
  } else {
    Serial.println("Aktuelle ID: (leer/nicht gesetzt)");
  }

  // Vorgeschlagene neue ID anzeigen
  Serial.println();
  Serial.println("Neue ID:     \"" + pendingID + "\"");
  Serial.println();

  if (currentID == pendingID) {
    Serial.println("Die ID ist bereits korrekt gesetzt. Kein Schreiben nötig.");
    Serial.println();
    printHelp();
    return;
  }

  Serial.println("Soll die ID geschrieben werden?");
  Serial.println("  'j' + Enter = Ja, schreiben");
  Serial.println("  'n' + Enter = Nein, abbrechen");
  Serial.println();
  waitingForConfirm = true;
}

// ===== LOOP =====

void loop() {
  if (!Serial.available()) return;

  String input = Serial.readStringUntil('\n');
  input.trim();

  if (input.length() == 0) return;

  // Warte auf Bestätigung
  if (waitingForConfirm) {
    if (input == "j" || input == "J" || input == "y" || input == "Y") {
      waitingForConfirm = false;
      Serial.println();
      writePowerbankID(pendingID);
      Serial.println();
      printHelp();
    } else if (input == "n" || input == "N") {
      waitingForConfirm = false;
      Serial.println("Abgebrochen.");
      Serial.println();
      printHelp();
    } else {
      Serial.println("Bitte 'j' oder 'n' eingeben.");
    }
    return;
  }

  // Interaktive Befehle
  if (input.startsWith("id:")) {
    String newID = input.substring(3);
    newID.trim();
    if (newID.length() == 0) {
      Serial.println("FEHLER: Leere ID. Verwende: id:MeinWert");
      return;
    }
    if (newID.length() > EEPROM_ID_MAX_LENGTH) {
      Serial.println("FEHLER: ID zu lang (max " + String(EEPROM_ID_MAX_LENGTH) + " Zeichen)");
      return;
    }
    Serial.println();
    writePowerbankID(newID);
    Serial.println();
  }
  else if (input == "read") {
    String id = readPowerbankID();
    if (id.length() > 0) {
      Serial.println("Aktuelle ID: \"" + id + "\"");
    } else {
      Serial.println("Keine ID gesetzt (EEPROM leer).");
    }
  }
  else if (input == "dump") {
    dumpRawEEPROM();
  }
  else if (input == "erase") {
    eraseID();
  }
  else if (input == "scan") {
    scanAllChannels();
  }
  else if (input == "help" || input == "h" || input == "?") {
    printHelp();
  }
  else {
    Serial.println("Unbekannter Befehl: \"" + input + "\"");
    Serial.println("Tippe 'help' für Befehle, oder 'id:WERT' um eine ID zu setzen.");
  }
}
