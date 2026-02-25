/*
 * ============================================================
 *  GRIDBOX - Servo Kalibrierungs-Tool
 * ============================================================
 *  Zweck: Live-Kalibrierung der Ausgabe-Servos für Powerbanks
 *  Pins:  Servo A = GPIO 13, Servo B = GPIO 7
 *
 *  BEDIENUNG über Serial Monitor (115200 Baud):
 *  -----------------------------------------------------------
 *  a <winkel>    → Servo A auf Winkel setzen (0-180)
 *  b <winkel>    → Servo B auf Winkel setzen (0-180)
 *  
 *  ao <winkel>   → Öffnungswinkel Servo A setzen
 *  ac <winkel>   → Schließwinkel Servo A setzen
 *  bo <winkel>   → Öffnungswinkel Servo B setzen
 *  bc <winkel>   → Schließwinkel Servo B setzen
 *  
 *  ta            → Servo A testen (Auf → Warten → Zu)
 *  tb            → Servo B testen (Auf → Warten → Zu)
 *  tall          → Beide Servos nacheinander testen
 *  
 *  d <ms>        → Haltezeit (Delay) setzen (Standard: 1500ms)
 *  
 *  s             → Gespeicherte Werte anzeigen (für Hauptcode)
 *  r             → Reset auf Standardwerte
 *  h             → Hilfe anzeigen
 *  
 *  +/- (ohne Buchstabe) → Letzten Servo um 1° erhöhen/verringern
 *  ++ / --              → Letzten Servo um 5° erhöhen/verringern
 * ============================================================
 */

#include <ESP32Servo.h>

// ===== PIN-KONFIGURATION =====
#define SERVO_A_PIN 13
#define SERVO_B_PIN 7

// ===== STANDARD-WERTE =====
#define DEFAULT_CLOSED_ANGLE 0
#define DEFAULT_OPEN_ANGLE 180
#define DEFAULT_MOVE_DELAY 1500

// ===== Servo-Objekte =====
Servo servoA;
Servo servoB;

// ===== Kalibrierungswerte =====
int servoA_openAngle   = DEFAULT_OPEN_ANGLE;
int servoA_closedAngle = DEFAULT_CLOSED_ANGLE;
int servoB_openAngle   = DEFAULT_OPEN_ANGLE;
int servoB_closedAngle = DEFAULT_CLOSED_ANGLE;
int moveDelayMs        = DEFAULT_MOVE_DELAY;

// ===== Status =====
int currentAngleA = -1;
int currentAngleB = -1;
char lastServo = 'a';  // Letzter angesteuerter Servo für +/- Steuerung

bool servoA_attached = false;
bool servoB_attached = false;

// ===== EEPROM für Speicherung =====
#include <EEPROM.h>
#define EEPROM_SIZE 32
#define EEPROM_MAGIC 0x47  // 'G' für Gridbox
#define EEPROM_ADDR_MAGIC     0
#define EEPROM_ADDR_A_OPEN    1
#define EEPROM_ADDR_A_CLOSED  3
#define EEPROM_ADDR_B_OPEN    5
#define EEPROM_ADDR_B_CLOSED  7
#define EEPROM_ADDR_DELAY     9  // 2 bytes

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("╔════════════════════════════════════════════╗");
  Serial.println("║   GRIDBOX Servo Kalibrierungs-Tool v1.0   ║");
  Serial.println("╠════════════════════════════════════════════╣");
  Serial.println("║  Servo A: GPIO 13                         ║");
  Serial.println("║  Servo B: GPIO 7                          ║");
  Serial.println("╚════════════════════════════════════════════╝");
  Serial.println();

  // EEPROM initialisieren
  EEPROM.begin(EEPROM_SIZE);
  loadFromEEPROM();

  // PWM Timer zuweisen
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Servos initialisieren
  servoA.setPeriodHertz(50);
  servoB.setPeriodHertz(50);

  int chA = servoA.attach(SERVO_A_PIN, 500, 2400);
  int chB = servoB.attach(SERVO_B_PIN, 500, 2400);

  servoA_attached = (chA >= 0);
  servoB_attached = (chB >= 0);

  Serial.print("Servo A (Pin ");
  Serial.print(SERVO_A_PIN);
  Serial.print("): ");
  Serial.println(servoA_attached ? "✅ OK (Kanal " + String(chA) + ")" : "❌ FEHLER");

  Serial.print("Servo B (Pin ");
  Serial.print(SERVO_B_PIN);
  Serial.print("): ");
  Serial.println(servoB_attached ? "✅ OK (Kanal " + String(chB) + ")" : "❌ FEHLER");

  // Servos in geschlossene Position fahren
  if (servoA_attached) {
    servoA.write(servoA_closedAngle);
    currentAngleA = servoA_closedAngle;
  }
  if (servoB_attached) {
    servoB.write(servoB_closedAngle);
    currentAngleB = servoB_closedAngle;
  }

  Serial.println();
  printCurrentConfig();
  Serial.println();
  printHelp();
  Serial.println();
  Serial.println("Bereit! Gib einen Befehl ein...");
  Serial.println("─────────────────────────────────");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    if (input.length() == 0) return;
    
    processCommand(input);
  }
}

// ===== Befehlsverarbeitung =====
void processCommand(String cmd) {
  cmd.toLowerCase();
  
  Serial.println();
  Serial.print(">>> ");
  Serial.println(cmd);

  // +/- Schnellsteuerung
  if (cmd == "+") {
    nudgeServo(lastServo, 1);
    return;
  }
  if (cmd == "-") {
    nudgeServo(lastServo, -1);
    return;
  }
  if (cmd == "++") {
    nudgeServo(lastServo, 5);
    return;
  }
  if (cmd == "--") {
    nudgeServo(lastServo, -5);
    return;
  }
  if (cmd == "+++") {
    nudgeServo(lastServo, 10);
    return;
  }
  if (cmd == "---") {
    nudgeServo(lastServo, -10);
    return;
  }

  // Servo A direkt ansteuern: "a 90"
  if (cmd.startsWith("a ") && !cmd.startsWith("ao") && !cmd.startsWith("ac")) {
    int angle = cmd.substring(2).toInt();
    moveServoA(angle);
    return;
  }

  // Servo B direkt ansteuern: "b 90"
  if (cmd.startsWith("b ") && !cmd.startsWith("bo") && !cmd.startsWith("bc")) {
    int angle = cmd.substring(2).toInt();
    moveServoB(angle);
    return;
  }

  // Öffnungswinkel setzen
  if (cmd.startsWith("ao ") || cmd.startsWith("ao=")) {
    int angle = cmd.substring(3).toInt();
    angle = constrain(angle, 0, 180);
    servoA_openAngle = angle;
    Serial.println("✅ Servo A Öffnungswinkel = " + String(angle) + "°");
    moveServoA(angle);  // Sofort zeigen
    return;
  }
  if (cmd.startsWith("ac ") || cmd.startsWith("ac=")) {
    int angle = cmd.substring(3).toInt();
    angle = constrain(angle, 0, 180);
    servoA_closedAngle = angle;
    Serial.println("✅ Servo A Schließwinkel = " + String(angle) + "°");
    moveServoA(angle);
    return;
  }
  if (cmd.startsWith("bo ") || cmd.startsWith("bo=")) {
    int angle = cmd.substring(3).toInt();
    angle = constrain(angle, 0, 180);
    servoB_openAngle = angle;
    Serial.println("✅ Servo B Öffnungswinkel = " + String(angle) + "°");
    moveServoB(angle);
    return;
  }
  if (cmd.startsWith("bc ") || cmd.startsWith("bc=")) {
    int angle = cmd.substring(3).toInt();
    angle = constrain(angle, 0, 180);
    servoB_closedAngle = angle;
    Serial.println("✅ Servo B Schließwinkel = " + String(angle) + "°");
    moveServoB(angle);
    return;
  }

  // Haltezeit
  if (cmd.startsWith("d ") || cmd.startsWith("d=")) {
    int delayVal = cmd.substring(2).toInt();
    if (delayVal < 100) delayVal = 100;
    if (delayVal > 10000) delayVal = 10000;
    moveDelayMs = delayVal;
    Serial.println("✅ Haltezeit = " + String(moveDelayMs) + " ms");
    return;
  }

  // Test-Befehle
  if (cmd == "ta") {
    testServoA();
    return;
  }
  if (cmd == "tb") {
    testServoB();
    return;
  }
  if (cmd == "tall" || cmd == "t") {
    testServoA();
    delay(500);
    testServoB();
    return;
  }

  // Anzeige / Speichern
  if (cmd == "s" || cmd == "save") {
    saveToEEPROM();
    printCurrentConfig();
    printCodeSnippet();
    return;
  }
  if (cmd == "show" || cmd == "config" || cmd == "c") {
    printCurrentConfig();
    printCodeSnippet();
    return;
  }
  if (cmd == "r" || cmd == "reset") {
    resetDefaults();
    return;
  }
  if (cmd == "h" || cmd == "help" || cmd == "?") {
    printHelp();
    return;
  }

  // Sweep-Modus
  if (cmd == "sweapa" || cmd == "swa") {
    sweepServo('a');
    return;
  }
  if (cmd == "sweapb" || cmd == "swb") {
    sweepServo('b');
    return;
  }

  Serial.println("❓ Unbekannter Befehl: '" + cmd + "' - Tippe 'h' für Hilfe");
}

// ===== Servo-Bewegung =====
void moveServoA(int angle) {
  angle = constrain(angle, 0, 180);
  if (!servoA_attached) {
    Serial.println("❌ Servo A nicht verfügbar!");
    return;
  }
  servoA.write(angle);
  currentAngleA = angle;
  lastServo = 'a';
  Serial.println("🔧 Servo A → " + String(angle) + "°");
}

void moveServoB(int angle) {
  angle = constrain(angle, 0, 180);
  if (!servoB_attached) {
    Serial.println("❌ Servo B nicht verfügbar!");
    return;
  }
  servoB.write(angle);
  currentAngleB = angle;
  lastServo = 'b';
  Serial.println("🔧 Servo B → " + String(angle) + "°");
}

void nudgeServo(char servo, int delta) {
  if (servo == 'a') {
    int newAngle = constrain(currentAngleA + delta, 0, 180);
    moveServoA(newAngle);
  } else {
    int newAngle = constrain(currentAngleB + delta, 0, 180);
    moveServoB(newAngle);
  }
}

// ===== Test-Funktionen =====
void testServoA() {
  if (!servoA_attached) {
    Serial.println("❌ Servo A nicht verfügbar!");
    return;
  }
  Serial.println("━━━━━ TEST SERVO A ━━━━━");
  Serial.println("  Schließe → " + String(servoA_closedAngle) + "°");
  servoA.write(servoA_closedAngle);
  currentAngleA = servoA_closedAngle;
  delay(500);
  
  Serial.println("  Öffne   → " + String(servoA_openAngle) + "°");
  servoA.write(servoA_openAngle);
  currentAngleA = servoA_openAngle;
  delay(moveDelayMs);
  
  Serial.println("  Schließe → " + String(servoA_closedAngle) + "° (nach " + String(moveDelayMs) + "ms)");
  servoA.write(servoA_closedAngle);
  currentAngleA = servoA_closedAngle;
  delay(300);
  
  Serial.println("  ✅ Test Servo A abgeschlossen");
}

void testServoB() {
  if (!servoB_attached) {
    Serial.println("❌ Servo B nicht verfügbar!");
    return;
  }
  Serial.println("━━━━━ TEST SERVO B ━━━━━");
  Serial.println("  Schließe → " + String(servoB_closedAngle) + "°");
  servoB.write(servoB_closedAngle);
  currentAngleB = servoB_closedAngle;
  delay(500);
  
  Serial.println("  Öffne   → " + String(servoB_openAngle) + "°");
  servoB.write(servoB_openAngle);
  currentAngleB = servoB_openAngle;
  delay(moveDelayMs);
  
  Serial.println("  Schließe → " + String(servoB_closedAngle) + "° (nach " + String(moveDelayMs) + "ms)");
  servoB.write(servoB_closedAngle);
  currentAngleB = servoB_closedAngle;
  delay(300);
  
  Serial.println("  ✅ Test Servo B abgeschlossen");
}

void sweepServo(char servo) {
  Serial.println("━━━ SWEEP Servo " + String((char)toupper(servo)) + " (0° → 180° → 0°) ━━━");
  Serial.println("  (Beobachte den Servo und merke dir die idealen Winkel)");
  
  for (int angle = 0; angle <= 180; angle += 5) {
    if (servo == 'a') {
      servoA.write(angle);
      currentAngleA = angle;
    } else {
      servoB.write(angle);
      currentAngleB = angle;
    }
    Serial.println("  → " + String(angle) + "°");
    delay(200);
  }
  delay(500);
  for (int angle = 180; angle >= 0; angle -= 5) {
    if (servo == 'a') {
      servoA.write(angle);
      currentAngleA = angle;
    } else {
      servoB.write(angle);
      currentAngleB = angle;
    }
    Serial.println("  → " + String(angle) + "°");
    delay(200);
  }
  Serial.println("  ✅ Sweep abgeschlossen");
  lastServo = servo;
}

// ===== Anzeige =====
void printCurrentConfig() {
  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║     AKTUELLE KALIBRIERUNG            ║");
  Serial.println("╠══════════════════════════════════════╣");
  Serial.print("║  Servo A (Pin ");
  Serial.print(SERVO_A_PIN);
  Serial.println("):");
  Serial.println("║    Geschlossen: " + String(servoA_closedAngle) + "°");
  Serial.println("║    Geöffnet:    " + String(servoA_openAngle) + "°");
  Serial.print("║  Servo B (Pin ");
  Serial.print(SERVO_B_PIN);
  Serial.println("):");
  Serial.println("║    Geschlossen: " + String(servoB_closedAngle) + "°");
  Serial.println("║    Geöffnet:    " + String(servoB_openAngle) + "°");
  Serial.println("║  Haltezeit:     " + String(moveDelayMs) + " ms");
  Serial.println("║  Aktuell: A=" + String(currentAngleA) + "° B=" + String(currentAngleB) + "°");
  Serial.println("╚══════════════════════════════════════╝");
}

void printCodeSnippet() {
  Serial.println();
  Serial.println("┌──────────────────────────────────────────┐");
  Serial.println("│ KOPIERE DIESE WERTE IN DEN HAUPTCODE:    │");
  Serial.println("│ (ESP32_Gridbox_Station.ino, Zeile ~65)   │");
  Serial.println("├──────────────────────────────────────────┤");
  Serial.println("│                                          │");
  Serial.println("│ #define SERVO_CLOSED_ANGLE " + padRight(String(servoA_closedAngle), 4) + "          │");
  Serial.println("│ #define SERVO_OPEN_ANGLE " + padRight(String(servoA_openAngle), 4) + "            │");
  Serial.println("│ #define SERVO_MOVE_DELAY_MS " + padRight(String(moveDelayMs), 5) + "        │");
  Serial.println("│                                          │");
  
  if (servoA_closedAngle != servoB_closedAngle || servoA_openAngle != servoB_openAngle) {
    Serial.println("│ ⚠️  ACHTUNG: Servo A und B haben         │");
    Serial.println("│     unterschiedliche Winkel!              │");
    Serial.println("│     Servo A: Zu=" + padRight(String(servoA_closedAngle), 3) + "° Auf=" + padRight(String(servoA_openAngle), 3) + "°          │");
    Serial.println("│     Servo B: Zu=" + padRight(String(servoB_closedAngle), 3) + "° Auf=" + padRight(String(servoB_openAngle), 3) + "°          │");
    Serial.println("│                                          │");
    Serial.println("│  Für unterschiedliche Winkel pro Servo:  │");
    Serial.println("│  Ersetze SERVO_CLOSED/OPEN_ANGLE im      │");
    Serial.println("│  Hauptcode durch separate Defines:       │");
    Serial.println("│                                          │");
    Serial.println("│  #define SERVO_A_CLOSED " + padRight(String(servoA_closedAngle), 4) + "             │");
    Serial.println("│  #define SERVO_A_OPEN " + padRight(String(servoA_openAngle), 4) + "               │");
    Serial.println("│  #define SERVO_B_CLOSED " + padRight(String(servoB_closedAngle), 4) + "             │");
    Serial.println("│  #define SERVO_B_OPEN " + padRight(String(servoB_openAngle), 4) + "               │");
    Serial.println("│                                          │");
  }
  
  Serial.println("└──────────────────────────────────────────┘");
}

String padRight(String str, int length) {
  while (str.length() < (unsigned int)length) {
    str += " ";
  }
  return str;
}

void printHelp() {
  Serial.println("╔══════════════════════════════════════════════╗");
  Serial.println("║              BEFEHLE                         ║");
  Serial.println("╠══════════════════════════════════════════════╣");
  Serial.println("║ DIREKT BEWEGEN:                              ║");
  Serial.println("║   a <0-180>     Servo A auf Winkel           ║");
  Serial.println("║   b <0-180>     Servo B auf Winkel           ║");
  Serial.println("║   + / -         Letzter Servo ±1°            ║");
  Serial.println("║   ++ / --       Letzter Servo ±5°            ║");
  Serial.println("║   +++ / ---     Letzter Servo ±10°           ║");
  Serial.println("╠══════════════════════════════════════════════╣");
  Serial.println("║ WINKEL SPEICHERN:                            ║");
  Serial.println("║   ao <winkel>   Servo A Öffnungswinkel       ║");
  Serial.println("║   ac <winkel>   Servo A Schließwinkel        ║");
  Serial.println("║   bo <winkel>   Servo B Öffnungswinkel       ║");
  Serial.println("║   bc <winkel>   Servo B Schließwinkel        ║");
  Serial.println("║   d <ms>        Haltezeit (100-10000ms)      ║");
  Serial.println("╠══════════════════════════════════════════════╣");
  Serial.println("║ TESTEN:                                      ║");
  Serial.println("║   ta            Servo A Ausgabe testen       ║");
  Serial.println("║   tb            Servo B Ausgabe testen       ║");
  Serial.println("║   tall          Beide testen                 ║");
  Serial.println("║   swa           Sweep Servo A (0→180→0)      ║");
  Serial.println("║   swb           Sweep Servo B (0→180→0)      ║");
  Serial.println("╠══════════════════════════════════════════════╣");
  Serial.println("║ SONSTIGES:                                   ║");
  Serial.println("║   s / save      Werte in EEPROM speichern    ║");
  Serial.println("║                 + Code-Snippet anzeigen      ║");
  Serial.println("║   c / config    Aktuelle Werte anzeigen      ║");
  Serial.println("║   r / reset     Auf Standardwerte zurück     ║");
  Serial.println("║   h / help      Diese Hilfe                  ║");
  Serial.println("╚══════════════════════════════════════════════╝");
}

// ===== EEPROM =====
void saveToEEPROM() {
  EEPROM.write(EEPROM_ADDR_MAGIC, EEPROM_MAGIC);
  EEPROM.write(EEPROM_ADDR_A_OPEN, servoA_openAngle & 0xFF);
  EEPROM.write(EEPROM_ADDR_A_OPEN + 1, (servoA_openAngle >> 8) & 0xFF);
  EEPROM.write(EEPROM_ADDR_A_CLOSED, servoA_closedAngle & 0xFF);
  EEPROM.write(EEPROM_ADDR_A_CLOSED + 1, (servoA_closedAngle >> 8) & 0xFF);
  EEPROM.write(EEPROM_ADDR_B_OPEN, servoB_openAngle & 0xFF);
  EEPROM.write(EEPROM_ADDR_B_OPEN + 1, (servoB_openAngle >> 8) & 0xFF);
  EEPROM.write(EEPROM_ADDR_B_CLOSED, servoB_closedAngle & 0xFF);
  EEPROM.write(EEPROM_ADDR_B_CLOSED + 1, (servoB_closedAngle >> 8) & 0xFF);
  EEPROM.write(EEPROM_ADDR_DELAY, moveDelayMs & 0xFF);
  EEPROM.write(EEPROM_ADDR_DELAY + 1, (moveDelayMs >> 8) & 0xFF);
  EEPROM.commit();
  
  Serial.println("💾 Werte im EEPROM gespeichert!");
}

void loadFromEEPROM() {
  if (EEPROM.read(EEPROM_ADDR_MAGIC) == EEPROM_MAGIC) {
    servoA_openAngle   = EEPROM.read(EEPROM_ADDR_A_OPEN) | (EEPROM.read(EEPROM_ADDR_A_OPEN + 1) << 8);
    servoA_closedAngle = EEPROM.read(EEPROM_ADDR_A_CLOSED) | (EEPROM.read(EEPROM_ADDR_A_CLOSED + 1) << 8);
    servoB_openAngle   = EEPROM.read(EEPROM_ADDR_B_OPEN) | (EEPROM.read(EEPROM_ADDR_B_OPEN + 1) << 8);
    servoB_closedAngle = EEPROM.read(EEPROM_ADDR_B_CLOSED) | (EEPROM.read(EEPROM_ADDR_B_CLOSED + 1) << 8);
    moveDelayMs        = EEPROM.read(EEPROM_ADDR_DELAY) | (EEPROM.read(EEPROM_ADDR_DELAY + 1) << 8);
    
    // Plausibilitätscheck
    servoA_openAngle   = constrain(servoA_openAngle, 0, 180);
    servoA_closedAngle = constrain(servoA_closedAngle, 0, 180);
    servoB_openAngle   = constrain(servoB_openAngle, 0, 180);
    servoB_closedAngle = constrain(servoB_closedAngle, 0, 180);
    moveDelayMs        = constrain(moveDelayMs, 100, 10000);
    
    Serial.println("📂 Gespeicherte Kalibrierung aus EEPROM geladen.");
  } else {
    Serial.println("ℹ️ Kein gespeicherter Stand – verwende Standardwerte.");
  }
}

void resetDefaults() {
  servoA_openAngle   = DEFAULT_OPEN_ANGLE;
  servoA_closedAngle = DEFAULT_CLOSED_ANGLE;
  servoB_openAngle   = DEFAULT_OPEN_ANGLE;
  servoB_closedAngle = DEFAULT_CLOSED_ANGLE;
  moveDelayMs        = DEFAULT_MOVE_DELAY;
  
  // Servos in Default-Position fahren
  if (servoA_attached) {
    servoA.write(servoA_closedAngle);
    currentAngleA = servoA_closedAngle;
  }
  if (servoB_attached) {
    servoB.write(servoB_closedAngle);
    currentAngleB = servoB_closedAngle;
  }
  
  Serial.println("🔄 Standardwerte wiederhergestellt (noch nicht in EEPROM gespeichert)");
  printCurrentConfig();
}
