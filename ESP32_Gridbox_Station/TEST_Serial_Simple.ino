// Einfachster Serial Test für ESP32
// Upload diesen Code um zu testen ob Serial funktioniert

void setup() {
  Serial.begin(115200);
  delay(2000);  // Warte 2 Sekunden
  
  Serial.println("\n\n========================================");
  Serial.println("TEST: Serial funktioniert!");
  Serial.println("========================================");
  Serial.println("Wenn du das liest, funktioniert Serial!");
  Serial.println();
}

void loop() {
  // Sekunden-Zähler
  Serial.print("ESP32 läuft - Sekunde: ");
  Serial.println(millis() / 1000);
  
  delay(1000);  // Jede Sekunde
}

