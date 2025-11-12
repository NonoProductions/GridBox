// Einfacher Test - ESP32 Serial Output
// Verwende diesen Code nur zum Testen!

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n=============================");
  Serial.println("TEST: ESP32 Serial funktioniert!");
  Serial.println("=============================\n");
}

void loop() {
  Serial.println("ESP32 läuft... (Sekunde " + String(millis() / 1000) + ")");
  delay(1000);
}

