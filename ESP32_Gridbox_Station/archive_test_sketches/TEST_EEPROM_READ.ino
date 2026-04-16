/*
 * TEST_EEPROM_READ.ino
 * Liest EEPROM (24LC01B/02B) am TCA9548A nur aus – kein Schreiben.
 * Gleiche Konfiguration wie ESP32_Gridbox_Station (Kanal 2, I2C 21/22).
 */

#include <Wire.h>

#define TCA9548A_ADDRESS  0x70
#define EEPROM_CHANNEL    2
#define EEPROM_MAGIC_BYTE 0xAA
#define EEPROM_MAGIC_ADDRESS 0x00
#define EEPROM_ID_DATA_ADDRESS 0x01
#define EEPROM_ID_MAX_LENGTH 32
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// 24LC02 = 256 Bytes; 24LC01 = 128 Bytes – hier bis 256 lesen (ungültige Adressen liefern 0xFF)
#define EEPROM_DUMP_BYTES 64

uint8_t eepromAddress = 0;
uint8_t eepromChannel = EEPROM_CHANNEL;  // Kanal, auf dem EEPROM gefunden wurde

void selectI2CChannel(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(TCA9548A_ADDRESS);
  Wire.write(1 << channel);
  Wire.endTransmission();
  delay(10);
}

uint8_t findEEPROMAddressOnChannel(uint8_t channel) {
  if (channel > 7) return 0;
  selectI2CChannel(channel);
  delay(10);
  for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
    if (channel == 0 && addr == 0x55) continue;  // Kanal 0: 0x55 = Fuel Gauge, kein EEPROM
    Wire.beginTransmission(addr);
    Wire.write(0x00);
    if (Wire.endTransmission() == 0) {
      return addr;
    }
    delay(5);
  }
  return 0;
}

uint8_t readEEPROMByte(uint8_t address) {
  if (eepromAddress == 0) return 0xFF;
  selectI2CChannel(eepromChannel);
  delay(5);
  Wire.beginTransmission(eepromAddress);
  Wire.write(address);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  Wire.requestFrom((uint16_t)eepromAddress, (uint8_t)1);
  if (Wire.available() < 1) return 0xFF;
  return Wire.read();
}

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
  Serial.println("--------------------------------");
}

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

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("====== EEPROM Nur-Lesen Test ======");
  Serial.println("Kanal: " + String(EEPROM_CHANNEL) + " | SDA=" + String(I2C_SDA_PIN) + " SCL=" + String(I2C_SCL_PIN));
  Serial.println();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  delay(100);

  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err = Wire.endTransmission();
  if (err != 0) {
    Serial.println("FEHLER: TCA9548A nicht gefunden (Code " + String(err) + ")");
    Serial.println("Verdrahtung prüfen.");
    return;
  }
  Serial.println("OK: TCA9548A gefunden");

  // Alle Kanäle 0–7 scannen, um EEPROM zu finden (evtl. hängt es nicht auf Kanal 2)
  Serial.println("\n--- Scan aller TCA-Kanäle (0x50-0x57) ---");
  bool found = false;
  for (uint8_t ch = 0; ch <= 7; ch++) {
    selectI2CChannel(ch);
    delay(10);
    uint8_t addr = findEEPROMAddressOnChannel(ch);
    if (addr != 0) {
      Serial.println("  Kanal " + String(ch) + ": EEPROM gefunden, Adresse 0x" + String(addr, HEX));
      if (!found) {
        found = true;
        eepromAddress = addr;
        eepromChannel = ch;
      }
    } else {
      Serial.println("  Kanal " + String(ch) + ": nichts");
    }
  }
  Serial.println("----------------------------------------");

  if (!found) {
    Serial.println("FEHLER: Kein EEPROM auf keinem Kanal (0-7, 0x50-0x57).");
    Serial.println("  Prüfen: Verdrahtung EEPROM → TCA9548A, welcher Kanal? I2C-Pins " + String(I2C_SDA_PIN) + "/" + String(I2C_SCL_PIN) + ".");
    return;
  }
  if (eepromChannel != EEPROM_CHANNEL) {
    Serial.println("HINWEIS: EEPROM ist auf Kanal " + String(eepromChannel) + " (nicht " + String(EEPROM_CHANNEL) + "). Lese von Kanal " + String(eepromChannel) + ".");
  }
  Serial.println("OK: EEPROM verwendet – Kanal " + String(eepromChannel) + ", Adresse 0x" + String(eepromAddress, HEX));

  dumpRawEEPROM();

  Serial.println("\n--- Powerbank-ID (interpretiert) ---");
  String id = readPowerbankID();
  if (id.length() > 0) {
    Serial.println("  Magic: 0x" + String(EEPROM_MAGIC_BYTE, HEX) + " (OK)");
    Serial.println("  ID:    \"" + id + "\"");
  } else {
    uint8_t magic = readEEPROMByte(EEPROM_MAGIC_ADDRESS);
    if (magic == EEPROM_MAGIC_BYTE) {
      Serial.println("  Magic gesetzt, aber ID ungültig oder leer.");
    } else {
      Serial.println("  Keine Powerbank-ID (Magic Byte nicht 0xAA – EEPROM leer oder anderes Format).");
    }
  }
  Serial.println("-----------------------------------");
  Serial.println("\nTest beendet. Kein Schreiben.");
}

void loop() {
  delay(1000);
}
