/**
 * Serre Connectée — Contrôle MQTT via HiveMQ Cloud
 * Plateforme : Arduino UNO R4 WiFi
 * v5 : ajout de publishStatus() — source de vérité pour l'app
 *
 * Topics reçus :
 *   serre/led/cmd       → "ON" | "OFF"           (mode manuel)
 *   serre/led/mode      → "manuel" | "programmateur" | "solaire"
 *   serre/led/schedule  → {"on":"08:00","off":"20:00"}
 *   serre/fan/state     → "ON" | "OFF"
 *   serre/fan/speed     → "0"-"100"
 *
 * Topics publiés :
 *   serre/led/state         → "ON" | "OFF"
 *   serre/led/status        → {"mode":"solaire","ledOn":true,"nextEvent":"extinction","nextTime":"21:08"}
 *   serre/localisation      → {"ip":"x.x.x.x"}
 *   serre/capteurs/temperature → "23.5"
 *   serre/capteurs/humidite    → "62.1"
 *   serre/fan/pwm           → "0"-"255"
 */

/**
 * Serre Connectée — Contrôle MQTT via HiveMQ Cloud
 * Plateforme : Arduino UNO R4 WiFi
 * v5 corrigé : publishStatus() appelé une seule fois par événement
 */

#include <WiFiS3.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <WiFiUdp.h>
#include <NTPClient.h>

#define DHT_PIN  2
#define DHT_TYPE DHT22
#define FAN_PIN  9
DHT dht(DHT_PIN, DHT_TYPE);

const char* WIFI_SSID     = "HUAWEI-H1HQ3C";
const char* WIFI_PASSWORD = "paupierre9895";

const char* MQTT_SERVER = "95ad7664c9384cb0936c42c6ea5b8654.s1.eu.hivemq.cloud";
const int   MQTT_PORT   = 8883;
const char* MQTT_USER   = "Ssxpn";
const char* MQTT_PASS   = "isCPEarD7?LaKYq9";
const char* MQTT_CLIENT = "ArduinoUNOR4";

const char* TOPIC_STATUS = "serre/status";
const char* TOPIC_LED_CMD      = "serre/led/cmd";
const char* TOPIC_LED_STATE    = "serre/led/state";
const char* TOPIC_LED_MODE     = "serre/led/mode";
const char* TOPIC_LED_SCHEDULE = "serre/led/schedule";
const char* TOPIC_LED_STATUS   = "serre/led/status";
const char* TOPIC_LOCALISATION = "serre/localisation";
const char* TOPIC_TEMPERATURE  = "serre/capteurs/temperature";
const char* TOPIC_HUMIDITE     = "serre/capteurs/humidite";
const char* TOPIC_LOCALISATION_REQUEST = "serre/localisation/request";
const char* TOPIC_FAN_STATE    = "serre/fan/state";
const char* TOPIC_FAN_SPEED    = "serre/fan/speed";
const char* TOPIC_FAN_PWM      = "serre/fan/pwm";

#define EEPROM_ADDR_MODE   0
#define EEPROM_ADDR_ON     1
#define EEPROM_ADDR_OFF    7
#define EEPROM_MAGIC_ADDR  13
#define EEPROM_MAGIC_VALUE 0x42

enum LedMode { MODE_MANUEL = 0, MODE_PROGRAMMATEUR = 1, MODE_SOLAIRE = 2 };

LedMode ledMode    = MODE_MANUEL;
bool    ledOn      = false;
char    timeOn[6]  = "08:00";
char    timeOff[6] = "20:00";

bool    fanOn    = false;
uint8_t fanSpeed = 50;

const unsigned long SENSOR_INTERVAL   = 10000;
const unsigned long SCHEDULE_INTERVAL = 10000;
unsigned long lastSensorRead    = 0;
unsigned long lastScheduleCheck = 0;

WiFiUDP   ntpUdp;
NTPClient ntpClient(ntpUdp, "pool.ntp.org", 7200);

WiFiSSLClient wifiClient;
WiFiClient    httpClient;
PubSubClient  mqttClient(wifiClient);

// ──────────────────────────────────────────────────────────────────────────
// EEPROM
// ──────────────────────────────────────────────────────────────────────────

void saveToEEPROM() {
  EEPROM.write(EEPROM_ADDR_MODE, (uint8_t)ledMode);
  for (int i = 0; i < 6; i++) EEPROM.write(EEPROM_ADDR_ON  + i, timeOn[i]);
  for (int i = 0; i < 6; i++) EEPROM.write(EEPROM_ADDR_OFF + i, timeOff[i]);
  EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);
  Serial.println("Config sauvegardée en EEPROM.");
}

void loadFromEEPROM() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) != EEPROM_MAGIC_VALUE) {
    Serial.println("EEPROM vierge — valeurs par défaut."); return;
  }
  ledMode = (LedMode)EEPROM.read(EEPROM_ADDR_MODE);
  for (int i = 0; i < 6; i++) timeOn[i]  = (char)EEPROM.read(EEPROM_ADDR_ON  + i);
  for (int i = 0; i < 6; i++) timeOff[i] = (char)EEPROM.read(EEPROM_ADDR_OFF + i);
  Serial.print("Config restaurée — Mode : "); Serial.print(ledMode);
  Serial.print(" | ON : "); Serial.print(timeOn);
  Serial.print(" | OFF : "); Serial.println(timeOff);
}

// ──────────────────────────────────────────────────────────────────────────
// publishStatus — appelé UNE seule fois par événement, jamais en cascade
// ──────────────────────────────────────────────────────────────────────────

void publishStatus() {
  ntpClient.update();
  String currentTime = ntpClient.getFormattedTime().substring(0, 5);

  String nextEvent, nextTime, modeName;

  if (ledMode == MODE_MANUEL) {
    nextEvent = "manuel";
    nextTime  = "";
  } else {
    bool inRange = (currentTime >= String(timeOn) && currentTime < String(timeOff));
    nextEvent = inRange ? "extinction" : "allumage";
    nextTime  = inRange ? String(timeOff) : String(timeOn);
  }

  if      (ledMode == MODE_MANUEL)        modeName = "manuel";
  else if (ledMode == MODE_PROGRAMMATEUR) modeName = "programmateur";
  else                                    modeName = "solaire";

  StaticJsonDocument<128> doc;
  doc["mode"]      = modeName;
  doc["ledOn"]     = ledOn;
  doc["nextEvent"] = nextEvent;
  doc["nextTime"]  = nextTime;
  doc["timeOn"]    = String(timeOn);
  doc["timeOff"]   = String(timeOff);

  char payload[128];
  serializeJson(doc, payload);
  mqttClient.publish(TOPIC_LED_STATUS, payload, true);
  Serial.print("Status publié : "); Serial.println(payload);
}

// ──────────────────────────────────────────────────────────────────────────
// LED — ne publie PAS le status (le fait l'appelant)
// ──────────────────────────────────────────────────────────────────────────

void setLed(bool on) {
  ledOn = on;                          // ← plus de guard
  digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
  mqttClient.publish(TOPIC_LED_STATE, on ? "ON" : "OFF", true);
  Serial.print("LED : "); Serial.println(on ? "ON" : "OFF");
}

// ──────────────────────────────────────────────────────────────────────────
// Ventilateur
// ──────────────────────────────────────────────────────────────────────────

void applyFan() {
  uint8_t pwm = fanOn ? (uint8_t)map(fanSpeed, 0, 100, 0, 255) : 0;
  analogWrite(FAN_PIN, pwm);
  char buf[4];
  itoa(pwm, buf, 10);
  mqttClient.publish(TOPIC_FAN_PWM, buf, true);
  Serial.print("Ventilateur : "); Serial.print(fanOn ? "ON" : "OFF");
  Serial.print(" | "); Serial.print(fanSpeed); Serial.print("% | PWM : "); Serial.println(pwm);
}

// ──────────────────────────────────────────────────────────────────────────
// checkSchedule — applique les horaires, publie le status une seule fois
// ──────────────────────────────────────────────────────────────────────────

// Convertit "HH:MM" en minutes depuis minuit
int timeToMinutes(const char* t) {
  int h = (t[0] - '0') * 10 + (t[1] - '0');
  int m = (t[3] - '0') * 10 + (t[4] - '0');
  return h * 60 + m;
}

void checkSchedule() {
  if (ledMode == MODE_MANUEL) return;

  ntpClient.update();

  int nowH   = ntpClient.getHours();
  int nowM   = ntpClient.getMinutes();
  int nowMin = nowH * 60 + nowM;

  int onMin  = timeToMinutes(timeOn);
  int offMin = timeToMinutes(timeOff);

  bool shouldBeOn;

  if (onMin < offMin) {
    shouldBeOn = (nowMin >= onMin && nowMin < offMin);
  } else {
    shouldBeOn = (nowMin >= onMin || nowMin < offMin);
  }

  setLed(shouldBeOn);
  publishStatus();
}

// ──────────────────────────────────────────────────────────────────────────
// WiFi
// ──────────────────────────────────────────────────────────────────────────

void setupWifi() {
  Serial.print("Connexion au WiFi « "); Serial.print(WIFI_SSID); Serial.println(" »...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  while (WiFi.localIP() == IPAddress(0, 0, 0, 0)) { delay(200); Serial.print("~"); }
  Serial.println("\nWiFi connecté !");
  Serial.print("IP locale : "); Serial.println(WiFi.localIP());
}

// ──────────────────────────────────────────────────────────────────────────
// IP publique
// ──────────────────────────────────────────────────────────────────────────

String fetchPublicIP() {
  if (!httpClient.connect("api.ipify.org", 80)) return "";
  httpClient.println("GET /?format=text HTTP/1.1");
  httpClient.println("Host: api.ipify.org");
  httpClient.println("Connection: close");
  httpClient.println();
  unsigned long timeout = millis();
  while (!httpClient.available()) {
    if (millis() - timeout > 5000) { httpClient.stop(); return ""; }
  }
  String ip = ""; bool headersEnd = false;
  while (httpClient.available()) {
    String line = httpClient.readStringUntil('\n');
    if (!headersEnd) { if (line == "\r") headersEnd = true; }
    else { ip = line; ip.trim(); }
  }
  httpClient.stop();
  return ip;
}

void publishLocalisation() {
  String ip = fetchPublicIP();
  if (ip.length() == 0) return;
  mqttClient.publish(TOPIC_LOCALISATION, ("{\"ip\":\"" + ip + "\"}").c_str(), true);
  Serial.print("Localisation publiée : "); Serial.println(ip);
}

// ──────────────────────────────────────────────────────────────────────────
// Capteurs DHT22
// ──────────────────────────────────────────────────────────────────────────

void publishSensors() {
  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) { Serial.println("Erreur DHT22 !"); return; }
  char tempStr[8], humStr[8];
  dtostrf(temperature, 4, 1, tempStr);
  dtostrf(humidity,    4, 1, humStr);
  mqttClient.publish(TOPIC_TEMPERATURE, tempStr, true);
  mqttClient.publish(TOPIC_HUMIDITE,    humStr,  true);
  Serial.print("Temp : "); Serial.print(tempStr);
  Serial.print("°C  |  Humidité : "); Serial.print(humStr); Serial.println("%");
}

// ──────────────────────────────────────────────────────────────────────────
// MQTT — Callback
// Règle : chaque branche appelle publishStatus() une seule fois à la fin
// ──────────────────────────────────────────────────────────────────────────

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.print("Message reçu ["); Serial.print(topic); Serial.print("] : "); Serial.println(message);

  if (String(topic) == TOPIC_LED_CMD) {
    if (ledMode != MODE_MANUEL) return;
    setLed(message == "ON");
    publishStatus();

  } else if (String(topic) == TOPIC_LED_MODE) {
    if      (message == "manuel")        ledMode = MODE_MANUEL;
    else if (message == "programmateur") ledMode = MODE_PROGRAMMATEUR;
    else if (message == "solaire")       ledMode = MODE_SOLAIRE;
    saveToEEPROM();
    if (ledMode != MODE_MANUEL) {
      checkSchedule();
    } else {
      publishStatus();
    }

  } else if (String(topic) == TOPIC_LED_SCHEDULE) {
    StaticJsonDocument<64> doc;
    if (deserializeJson(doc, message) != DeserializationError::Ok) return;
    const char* on  = doc["on"];
    const char* off = doc["off"];
    if (!on || !off) return;
    strncpy(timeOn,  on,  5); timeOn[5]  = '\0';
    strncpy(timeOff, off, 5); timeOff[5] = '\0';
    saveToEEPROM();
    checkSchedule();

  } else if (String(topic) == TOPIC_LOCALISATION_REQUEST) {
    publishLocalisation();

  } else if (String(topic) == TOPIC_FAN_STATE) {
    fanOn = (message == "ON");
    applyFan();

  } else if (String(topic) == TOPIC_FAN_SPEED) {
    int spd = message.toInt();
    if (spd < 0)   spd = 0;
    if (spd > 100) spd = 100;
    fanSpeed = (uint8_t)spd;
    applyFan();
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MQTT — Reconnexion
// ──────────────────────────────────────────────────────────────────────────

void mqttReconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Connexion MQTT...");

    bool connected = mqttClient.connect(
      MQTT_CLIENT, MQTT_USER, MQTT_PASS,
      TOPIC_STATUS,
      0,
      true,
      "offline"
    );

    if (connected) {
      Serial.println(" connecté !");

      mqttClient.publish(TOPIC_STATUS, "online", true);

      mqttClient.subscribe(TOPIC_LED_CMD);
      mqttClient.subscribe(TOPIC_LED_MODE);
      mqttClient.subscribe(TOPIC_LED_SCHEDULE);
      mqttClient.subscribe(TOPIC_LOCALISATION_REQUEST);
      mqttClient.subscribe(TOPIC_FAN_STATE);
      mqttClient.subscribe(TOPIC_FAN_SPEED);

      publishLocalisation();
      publishStatus();
      applyFan();

    } else {
      Serial.print(" échec (code=");
      Serial.print(mqttClient.state());
      Serial.println("). Retry dans 2s...");
      delay(2000);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Setup & Loop
// ──────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(9600);
  delay(1000);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  analogWrite(FAN_PIN, 0);
  dht.begin();
  loadFromEEPROM();
  setupWifi();
  ntpClient.begin();
  ntpClient.update();
  Serial.print("Heure NTP : "); Serial.println(ntpClient.getFormattedTime());
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setCallback(onMqttMessage);
  if (ledMode != MODE_MANUEL) checkSchedule();
}

void loop() {
  if (!mqttClient.connected()) mqttReconnect();
  mqttClient.loop();
  ntpClient.update();

  unsigned long now = millis();

  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    publishSensors();
  }

  if (now - lastScheduleCheck >= SCHEDULE_INTERVAL) {
    lastScheduleCheck = now;
    checkSchedule();
  }
}
