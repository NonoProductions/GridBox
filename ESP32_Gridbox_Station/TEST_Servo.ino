/*
 * Servo-Test für Gridbox ESP32 Station
 * 
 * Testet zwei Ausgabe-Servos (Pin 8 und Pin 7).
 * - Auto-Modus: beide pendeln zwischen 0° und 180° alle 3 Sekunden
 * - Manuell per Serial:
 *   o = beide öffnen, c = beide schließen, s = Sweep beide
 *   1 = Servo A öffnen, 2 = Servo A schließen
 *   3 = Servo B öffnen, 4 = Servo B schließen
 *   a = Auto-Modus EIN/AUS
 * 
 * Serial Monitor: 115200 Baud
 */

#include <ESP32Servo.h>

// Gleiche Konfiguration wie Hauptskript
#define SERVO_A_PIN 13
#define SERVO_B_PIN 7
#define SERVO_CLOSED_ANGLE 0
#define SERVO_OPEN_ANGLE 180
#define SERVO_MOVE_DELAY_MS 1500

Servo testServoA;
Servo testServoB;
bool autoMode = true;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println();
  Serial.println("====== Gridbox Dual-Servo Test ======");
  Serial.println("Servo A Pin: " + String(SERVO_A_PIN));
  Serial.println("Servo B Pin: " + String(SERVO_B_PIN));
  Serial.println("Geschlossen: " + String(SERVO_CLOSED_ANGLE) + "°");
  Serial.println("Offen: " + String(SERVO_OPEN_ANGLE) + "°");
  Serial.println();
  Serial.println("Befehle (Serial):");
  Serial.println("  o = Beide öffnen (180°)");
  Serial.println("  c = Beide schließen (0°)");
  Serial.println("  s = Sweep beide (0° -> 180° -> 0°)");
  Serial.println("  1 = Servo A öffnen");
  Serial.println("  2 = Servo A schließen");
  Serial.println("  3 = Servo B öffnen");
  Serial.println("  4 = Servo B schließen");
  Serial.println("  a = Auto-Modus EIN/AUS");
  Serial.println();

  int chA = testServoA.attach(SERVO_A_PIN);
  int chB = testServoB.attach(SERVO_B_PIN);

  testServoA.write(SERVO_CLOSED_ANGLE);
  testServoB.write(SERVO_CLOSED_ANGLE);

  Serial.println("Servo A attach channel: " + String(chA));
  Serial.println("Servo B attach channel: " + String(chB));
  Serial.println("Startposition: beide geschlossen (0°)");
  Serial.println("Auto-Modus ist AKTIV.");
}

void loop() {
  // Serial-Befehle prüfen
  if (Serial.available()) {
    char cmd = Serial.read();
    while (Serial.available()) Serial.read();  // Rest verwerfen

    switch (cmd) {
      case 'o':
      case 'O':
        Serial.println("-> Beide öffnen (180°)");
        testServoA.write(SERVO_OPEN_ANGLE);
        testServoB.write(SERVO_OPEN_ANGLE);
        break;
      case 'c':
      case 'C':
        Serial.println("-> Beide schließen (0°)");
        testServoA.write(SERVO_CLOSED_ANGLE);
        testServoB.write(SERVO_CLOSED_ANGLE);
        break;
      case 's':
      case 'S':
        Serial.println("-> Sweep beide ausführen...");
        doSweep();
        break;
      case '1':
        Serial.println("-> Servo A öffnen (180°)");
        testServoA.write(SERVO_OPEN_ANGLE);
        break;
      case '2':
        Serial.println("-> Servo A schließen (0°)");
        testServoA.write(SERVO_CLOSED_ANGLE);
        break;
      case '3':
        Serial.println("-> Servo B öffnen (180°)");
        testServoB.write(SERVO_OPEN_ANGLE);
        break;
      case '4':
        Serial.println("-> Servo B schließen (0°)");
        testServoB.write(SERVO_CLOSED_ANGLE);
        break;
      case 'a':
      case 'A':
        autoMode = !autoMode;
        Serial.println(String("-> Auto-Modus: ") + (autoMode ? "AKTIV" : "INAKTIV"));
        break;
      default:
        Serial.println("Unbekannter Befehl. o/c/s/1/2/3/4/a");
    }
  }

  // Auto-Modus: beide pendeln zwischen offen und geschlossen
  static unsigned long lastToggle = 0;
  static bool isOpen = false;

  if (autoMode && millis() - lastToggle >= 3000) {
    lastToggle = millis();
    isOpen = !isOpen;

    int angle = isOpen ? SERVO_OPEN_ANGLE : SERVO_CLOSED_ANGLE;
    testServoA.write(angle);
    testServoB.write(angle);

    Serial.print("Auto: ");
    Serial.print(isOpen ? "Beide offen" : "Beide geschlossen");
    Serial.println(" (" + String(angle) + "°)");
  }

  delay(50);
}

void doSweep() {
  // 0° -> 180°
  for (int a = SERVO_CLOSED_ANGLE; a <= SERVO_OPEN_ANGLE; a += 5) {
    testServoA.write(a);
    testServoB.write(a);
    delay(30);
  }
  delay(500);

  // 180° -> 0°
  for (int a = SERVO_OPEN_ANGLE; a >= SERVO_CLOSED_ANGLE; a -= 5) {
    testServoA.write(a);
    testServoB.write(a);
    delay(30);
  }
  Serial.println("Sweep fertig.");
}
