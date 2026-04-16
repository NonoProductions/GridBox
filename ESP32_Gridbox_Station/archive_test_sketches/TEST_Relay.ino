// TEST_Relay.ino – Einfacher Relay-Test für Gridbox ESP32
// Schaltet Relay A und B abwechselnd EIN und AUS.

#define RELAY_A_PIN 6
#define RELAY_B_PIN 5
#define RELAY_ACTIVE_LOW false   // false = HIGH aktiviert Relais

#define INTERVAL_MS 1000         // Wechsel alle 1 Sekunde

const uint8_t RELAY_ON  = RELAY_ACTIVE_LOW ? LOW  : HIGH;
const uint8_t RELAY_OFF = RELAY_ACTIVE_LOW ? HIGH : LOW;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("====== TEST_Relay ======");
  Serial.println("Relay A Pin: " + String(RELAY_A_PIN));
  Serial.println("Relay B Pin: " + String(RELAY_B_PIN));
  Serial.println("Intervall:   " + String(INTERVAL_MS) + " ms");
  Serial.println("========================");

  pinMode(RELAY_A_PIN, OUTPUT);
  pinMode(RELAY_B_PIN, OUTPUT);
  digitalWrite(RELAY_A_PIN, RELAY_OFF);
  digitalWrite(RELAY_B_PIN, RELAY_OFF);
}

void loop() {
  // Beide EIN
  digitalWrite(RELAY_A_PIN, RELAY_ON);
  digitalWrite(RELAY_B_PIN, RELAY_ON);
  Serial.println("Relay A: EIN  |  Relay B: EIN");
  delay(INTERVAL_MS);

  // Beide AUS
  digitalWrite(RELAY_A_PIN, RELAY_OFF);
  digitalWrite(RELAY_B_PIN, RELAY_OFF);
  Serial.println("Relay A: AUS  |  Relay B: AUS");
  delay(INTERVAL_MS);
}
