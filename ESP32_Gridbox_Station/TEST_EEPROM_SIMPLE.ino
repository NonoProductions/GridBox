/*
 * MINIMALER EEPROM TEST
 * Garantiert Ausgabe - auch wenn Hardware nicht funktioniert
 */

#include <Wire.h>

#define TCA9548A_ADDRESS 0x70
#define EEPROM_24C02_ADDRESS 0x50
#define I2C_SDA_PIN 26
#define I2C_SCL_PIN 27
#define TEST_CHANNEL 0

void selectChannel(uint8_t ch) {
  Wire.beginTransmission(TCA9548A_ADDRESS);
  Wire.write(1 << ch);
  Wire.endTransmission();
  delay(10);
}

bool writeByte(uint8_t ch, uint8_t addr, uint8_t data) {
  selectChannel(ch);
  Wire.beginTransmission(EEPROM_24C02_ADDRESS);
  Wire.write(addr);
  Wire.write(data);
  uint8_t err = Wire.endTransmission();
  delay(10);
  return (err == 0);
}

uint8_t readByte(uint8_t ch, uint8_t addr) {
  selectChannel(ch);
  Wire.beginTransmission(EEPROM_24C02_ADDRESS);
  Wire.write(addr);
  Wire.endTransmission(false);
  Wire.requestFrom(EEPROM_24C02_ADDRESS, 1);
  if (Wire.available()) return Wire.read();
  return 0xFF;
}

void setup() {
  // SOFORT ausgeben - keine Wartezeit
  Serial.begin(115200);
  Serial.println();
  Serial.println("START...");
  Serial.flush();
  delay(500);
  
  Serial.println("Kanal: " + String(TEST_CHANNEL));
  Serial.println("Pins: SDA=" + String(I2C_SDA_PIN) + ", SCL=" + String(I2C_SCL_PIN));
  Serial.flush();
  delay(200);
  
  Serial.println("Starte I2C...");
  Serial.flush();
  
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  delay(200);
  
  Serial.println("Prüfe TCA9548A...");
  Serial.flush();
  
  Wire.beginTransmission(TCA9548A_ADDRESS);
  uint8_t err1 = Wire.endTransmission();
  
  if (err1 == 0) {
    Serial.println("OK: TCA9548A gefunden");
  } else {
    Serial.println("FEHLER: TCA9548A Code " + String(err1));
  }
  Serial.flush();
  delay(200);
  
  Serial.println("Prüfe EEPROM...");
  Serial.flush();
  
  selectChannel(TEST_CHANNEL);
  delay(50);
  
  Wire.beginTransmission(EEPROM_24C02_ADDRESS);
  uint8_t err2 = Wire.endTransmission();
  
  if (err2 == 0) {
    Serial.println("OK: EEPROM gefunden");
    Serial.flush();
    delay(200);
    
    // TEST: Schreibe und lese
    Serial.println("TEST: Schreibe 0xAA...");
    Serial.flush();
    
    if (writeByte(TEST_CHANNEL, 10, 0xAA)) {
      Serial.println("OK: Geschrieben");
      Serial.flush();
      delay(20);
      
      uint8_t val = readByte(TEST_CHANNEL, 10);
      Serial.print("Gelesen: 0x");
      Serial.println(val, HEX);
      Serial.flush();
    } else {
      Serial.println("FEHLER: Schreiben fehlgeschlagen");
      Serial.flush();
    }
  } else {
    Serial.println("FEHLER: EEPROM Code " + String(err2));
    Serial.flush();
  }
  
  Serial.println();
  Serial.println("ENDE");
  Serial.flush();
}

void loop() {
  delay(1000);
}
