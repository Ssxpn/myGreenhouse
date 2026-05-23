/**
 * Serre Connectée — Contrôle MQTT via HiveMQ Cloud
 * Plateforme : Arduino Nano ESP32
 *
 * Topics reçus :
 *   serre/led/cmd         → "ON" | "OFF"
 *   serre/led/mode        → "manuel" | "programmateur" | "solaire"
 *   serre/led/schedule    → {"on":"08:00","off":"20:00"}
 *   serre/fan/cmd         → "ON" | "OFF"
 *   serre/mist/cmd        → "ON" | "OFF"
 *   serre/mist/mode       → "manuel" | "auto"       ← NOUVEAU
 *   serre/mist/setpoint   → "0"-"100"               ← sauvegardé EEPROM
 *
 * Topics publiés :
 *   serre/led/state            → "ON" | "OFF"
 *   serre/led/status           → {mode, ledOn, nextEvent, nextTime, timeOn, timeOff}
 *   serre/localisation         → {"ip":"x.x.x.x"}
 *   serre/capteurs/temperature → "23.5"
 *   serre/capteurs/humidite    → "62.1"
 *   serre/fan/state            → "ON" | "OFF"        ← retained
 *   serre/mist/state           → "ON" | "OFF"
 *   serre/mist/mode            → "manuel" | "auto"   ← retained, NOUVEAU
 *   serre/mist/setpoint        → "0"-"100"           ← retained, republié toutes les 10s
 */

// ── Bibliothèques ESP32 ────────────────────────────────────────────────────
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <WiFiUdp.h>
#include <NTPClient.h>

// ── Pins ───────────────────────────────────────────────────────────────────
#define DHT_PIN        2
#define DHT_TYPE       DHT22
#define FAN_PIN        9    // Sortie relais ventilateur (HIGH = OFF, LOW = ON)
#define MIST_PIN       4
#define LED_EXT_PIN_1  6    // Relais lumière 1 (actif LOW, NO)
#define LED_EXT_PIN_2  7    // Relais lumière 2 (actif LOW, NO)
// LED RGB intégrée : LEDR, LEDG, LEDB définis par le board package (actives LOW)

DHT dht(DHT_PIN, DHT_TYPE);

// ── Credentials WiFi ──────────────────────────────────────────────────────
const char* WIFI_SSID     = "HUAWEI-H1HQ3C";
const char* WIFI_PASSWORD = "paupierre9895";

// ── Credentials MQTT (HiveMQ Cloud) ───────────────────────────────────────
const char* MQTT_SERVER = "95ad7664c9384cb0936c42c6ea5b8654.s1.eu.hivemq.cloud";
const int   MQTT_PORT   = 8883;
const char* MQTT_USER   = "Ssxpn";
const char* MQTT_PASS   = "isCPEarD7?LaKYq9";
const char* MQTT_CLIENT = "ArduinoNanoESP32";

// ── Topics ─────────────────────────────────────────────────────────────────
const char* TOPIC_STATUS               = "serre/status";
const char* TOPIC_LED_CMD              = "serre/led/cmd";
const char* TOPIC_LED_STATE            = "serre/led/state";
const char* TOPIC_LED_MODE             = "serre/led/mode";
const char* TOPIC_LED_SCHEDULE         = "serre/led/schedule";
const char* TOPIC_LED_STATUS           = "serre/led/status";
const char* TOPIC_LOCALISATION         = "serre/localisation";
const char* TOPIC_TEMPERATURE          = "serre/capteurs/temperature";
const char* TOPIC_HUMIDITE             = "serre/capteurs/humidite";
const char* TOPIC_LOCALISATION_REQUEST = "serre/localisation/request";
const char* TOPIC_FAN_CMD              = "serre/fan/cmd";
const char* TOPIC_FAN_STATE            = "serre/fan/state";
const char* TOPIC_MIST_CMD             = "serre/mist/cmd";
const char* TOPIC_MIST_MODE            = "serre/mist/mode";      // ← NOUVEAU
const char* TOPIC_MIST_SETPOINT        = "serre/mist/setpoint";
const char* TOPIC_MIST_STATE           = "serre/mist/state";

// ── EEPROM ─────────────────────────────────────────────────────────────────
#define EEPROM_SIZE           29         // +1 pour mistMode
#define EEPROM_ADDR_MODE       0
#define EEPROM_ADDR_ON         1
#define EEPROM_ADDR_OFF        7
#define EEPROM_MAGIC_ADDR     13
#define EEPROM_MAGIC_VALUE  0x42
#define EEPROM_ADDR_MIST_TGT  14
#define EEPROM_MAGIC2_ADDR    18
#define EEPROM_MAGIC2_VALUE 0x43
#define EEPROM_ADDR_MIST_MODE 19        // ← NOUVEAU : 0 = auto, 1 = manuel
#define EEPROM_MAGIC3_ADDR    20
#define EEPROM_MAGIC3_VALUE 0x44

// ── État applicatif ────────────────────────────────────────────────────────
enum LedMode  { MODE_MANUEL = 0, MODE_PROGRAMMATEUR = 1, MODE_SOLAIRE = 2 };
enum MistMode { MIST_AUTO = 0, MIST_MANUAL = 1 };   // ← NOUVEAU

LedMode  ledMode   = MODE_MANUEL;
MistMode mistMode  = MIST_AUTO;          // ← NOUVEAU

bool  ledOn      = false;
char  timeOn[6]  = "08:00";
char  timeOff[6] = "20:00";

bool  fanOn          = false;
bool  mistOn         = false;
float mistTarget     = -1.0;
const float MIST_HYSTERESIS = 1.0;

// ── Timers ─────────────────────────────────────────────────────────────────
const unsigned long SENSOR_INTERVAL   = 10000;
const unsigned long SCHEDULE_INTERVAL = 10000;
unsigned long lastSensorRead    = 0;
unsigned long lastScheduleCheck = 0;

// ── Clients réseau ─────────────────────────────────────────────────────────
WiFiUDP           ntpUdp;
NTPClient         ntpClient(ntpUdp, "pool.ntp.org", 7200);
WiFiClientSecure  wifiClient;
WiFiClient        httpClient;
PubSubClient      mqttClient(wifiClient);

// ══════════════════════════════════════════════════════════════════════════
// EEPROM
// ══════════════════════════════════════════════════════════════════════════

void saveToEEPROM() {
  EEPROM.write(EEPROM_ADDR_MODE, (uint8_t)ledMode);
  for (int i = 0; i < 6; i++) EEPROM.write(EEPROM_ADDR_ON  + i, timeOn[i]);
  for (int i = 0; i < 6; i++) EEPROM.write(EEPROM_ADDR_OFF + i, timeOff[i]);
  EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);
  EEPROM.commit();
  Serial.println("Config LED sauvegardée en EEPROM.");
}

void saveExtToEEPROM() {
  byte* p = (byte*)&mistTarget;
  for (int i = 0; i < 4; i++) EEPROM.write(EEPROM_ADDR_MIST_TGT + i, p[i]);
  EEPROM.write(EEPROM_MAGIC2_ADDR, EEPROM_MAGIC2_VALUE);
  EEPROM.commit();
  Serial.print("EEPROM étendue — mistTarget: "); Serial.println(mistTarget);
}

void saveMistModeToEEPROM() {                           // ← NOUVEAU
  EEPROM.write(EEPROM_ADDR_MIST_MODE, (uint8_t)mistMode);
  EEPROM.write(EEPROM_MAGIC3_ADDR, EEPROM_MAGIC3_VALUE);
  EEPROM.commit();
  Serial.print("EEPROM — mistMode: "); Serial.println(mistMode == MIST_AUTO ? "auto" : "manuel");
}

void loadFromEEPROM() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) == EEPROM_MAGIC_VALUE) {
    ledMode = (LedMode)EEPROM.read(EEPROM_ADDR_MODE);
    for (int i = 0; i < 6; i++) timeOn[i]  = (char)EEPROM.read(EEPROM_ADDR_ON  + i);
    for (int i = 0; i < 6; i++) timeOff[i] = (char)EEPROM.read(EEPROM_ADDR_OFF + i);
    Serial.print("Config LED restaurée — Mode: "); Serial.print(ledMode);
    Serial.print(" | ON: "); Serial.print(timeOn);
    Serial.print(" | OFF: "); Serial.println(timeOff);
  } else {
    Serial.println("EEPROM LED vierge — valeurs par défaut.");
  }

  if (EEPROM.read(EEPROM_MAGIC2_ADDR) == EEPROM_MAGIC2_VALUE) {
    byte* p = (byte*)&mistTarget;
    for (int i = 0; i < 4; i++) p[i] = EEPROM.read(EEPROM_ADDR_MIST_TGT + i);
    Serial.print("Config étendue restaurée — mistTarget: "); Serial.println(mistTarget);
  } else {
    Serial.println("EEPROM étendue vierge — valeurs par défaut.");
    mistTarget = 75.0;
  }

  if (EEPROM.read(EEPROM_MAGIC3_ADDR) == EEPROM_MAGIC3_VALUE) {  // ← NOUVEAU
    mistMode = (MistMode)EEPROM.read(EEPROM_ADDR_MIST_MODE);
    Serial.print("Mode brumisateur restauré : "); Serial.println(mistMode == MIST_AUTO ? "auto" : "manuel");
  } else {
    Serial.println("EEPROM mistMode vierge — auto par défaut.");
    mistMode = MIST_AUTO;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// publishStatus
// ══════════════════════════════════════════════════════════════════════════

void publishStatus() {
  ntpClient.update();
  String currentTime = ntpClient.getFormattedTime().substring(0, 5);
  String nextEvent, nextTime, modeName;

  if (ledMode == MODE_MANUEL) {
    nextEvent = "manuel"; nextTime = "";
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

// ══════════════════════════════════════════════════════════════════════════
// publishPreferences — retained, appelé toutes les 10s
// ══════════════════════════════════════════════════════════════════════════

void publishPreferences() {
  if (mistTarget >= 0) {
    char buf[8];
    dtostrf(mistTarget, 4, 1, buf);
    String s = String(buf); s.trim();
    mqttClient.publish(TOPIC_MIST_SETPOINT, s.c_str(), true);
  }
  // On NE publie PAS TOPIC_MIST_MODE ici pour éviter de retriggerer le callback.
  // Il est publié une seule fois à la reconnexion (voir mqttReconnect).
  Serial.print("Prefs publiées — mistTarget: "); Serial.println(mistTarget);
}

// ══════════════════════════════════════════════════════════════════════════
// LED RGB intégrée (actives LOW) + relais externes pins 6 & 7 (actifs LOW)
// ══════════════════════════════════════════════════════════════════════════

void setRGB(bool r, bool g, bool b) {
  digitalWrite(LEDR, r ? LOW : HIGH);
  digitalWrite(LEDG, g ? LOW : HIGH);
  digitalWrite(LEDB, b ? LOW : HIGH);
}

void rgbOff()    { setRGB(false, false, false); }
void rgbRed()    { setRGB(true,  false, false); }
void rgbGreen()  { setRGB(false, true,  false); }
void rgbBlue()   { setRGB(false, false, true);  }
void rgbYellow() { setRGB(true,  true,  false); }

void light() {
  if (ledOn) {
    rgbGreen();
    digitalWrite(LED_EXT_PIN_1, LOW);
    digitalWrite(LED_EXT_PIN_2, LOW);
  } else {
    if (ledMode == MODE_PROGRAMMATEUR || ledMode == MODE_SOLAIRE) rgbBlue();
    else rgbRed();
    digitalWrite(LED_EXT_PIN_1, HIGH);
    digitalWrite(LED_EXT_PIN_2, HIGH);
  }
}

void setLed(bool on) {
  ledOn = on;
  light();
  mqttClient.publish(TOPIC_LED_STATE, on ? "ON" : "OFF", true);
  Serial.print("LED : "); Serial.println(on ? "ON" : "OFF");
}

// ══════════════════════════════════════════════════════════════════════════
// Ventilateur
// ══════════════════════════════════════════════════════════════════════════

void applyFan() {
  digitalWrite(FAN_PIN, fanOn ? LOW : HIGH);
  mqttClient.publish(TOPIC_FAN_STATE, fanOn ? "ON" : "OFF", true);
  Serial.print("Ventilateur : "); Serial.println(fanOn ? "ON" : "OFF");
}

// ══════════════════════════════════════════════════════════════════════════
// Brumisateur
// ══════════════════════════════════════════════════════════════════════════

void applyMist(bool on) {
  mistOn = on;
  digitalWrite(MIST_PIN, on ? LOW : HIGH);
  mqttClient.publish(TOPIC_MIST_STATE, on ? "ON" : "OFF", false);
  Serial.print("Brumisateur : "); Serial.println(on ? "ON" : "OFF");
}

// ══════════════════════════════════════════════════════════════════════════
// checkSchedule
// ══════════════════════════════════════════════════════════════════════════

int timeToMinutes(const char* t) {
  int h = (t[0]-'0')*10 + (t[1]-'0');
  int m = (t[3]-'0')*10 + (t[4]-'0');
  return h * 60 + m;
}

void checkSchedule() {
  if (ledMode == MODE_MANUEL) return;
  ntpClient.update();
  int nowMin = ntpClient.getHours() * 60 + ntpClient.getMinutes();
  int onMin  = timeToMinutes(timeOn);
  int offMin = timeToMinutes(timeOff);
  bool shouldBeOn = (onMin < offMin)
    ? (nowMin >= onMin && nowMin < offMin)
    : (nowMin >= onMin || nowMin < offMin);
  setLed(shouldBeOn);
  publishStatus();
}

// ══════════════════════════════════════════════════════════════════════════
// WiFi
// ══════════════════════════════════════════════════════════════════════════

void setupWifi() {
  Serial.print("Connexion au WiFi « "); Serial.print(WIFI_SSID); Serial.println(" »...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  while (WiFi.localIP() == IPAddress(0, 0, 0, 0)) { delay(200); Serial.print("~"); }
  Serial.println("\nWiFi connecté !");
  Serial.print("IP locale : "); Serial.println(WiFi.localIP());
}

// ══════════════════════════════════════════════════════════════════════════
// IP publique
// ══════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════
// Capteurs DHT22 + hystérésis brumisateur (mode auto uniquement)
// ══════════════════════════════════════════════════════════════════════════

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

  // ── Hystérésis : uniquement en mode AUTO ──────────────────────────────
  if (mistMode == MIST_AUTO && mistTarget >= 0) {
    if (humidity < mistTarget - MIST_HYSTERESIS && !mistOn) applyMist(true);
    else if (humidity > mistTarget + MIST_HYSTERESIS && mistOn) applyMist(false);
  }
  // En mode MANUAL : on ne touche pas à mistOn, l'app est maître.
}

// ══════════════════════════════════════════════════════════════════════════
// MQTT — Callback
// ══════════════════════════════════════════════════════════════════════════

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
    if (ledMode != MODE_MANUEL) checkSchedule();
    else { publishStatus(); light(); }

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

  } else if (String(topic) == TOPIC_FAN_CMD) {
    fanOn = (message == "ON");
    applyFan();

  } else if (String(topic) == TOPIC_MIST_MODE) {
    // ── Changement de mode brumisateur ──────────────────────────────────
    if (message == "auto") {
      mistMode = MIST_AUTO;
    } else if (message == "manuel") {
      mistMode = MIST_MANUAL;
    } else return;
    saveMistModeToEEPROM();
    Serial.print("Mode brumisateur → "); Serial.println(message);
    // Pas de retour retained ici : c'est l'app qui a envoyé, elle connaît le mode.

  } else if (String(topic) == TOPIC_MIST_CMD) {
    // ── Commande directe (mode manuel uniquement) ────────────────────────
    // On l'accepte uniquement si l'app a préalablement sélectionné le mode manuel.
    if (mistMode != MIST_MANUAL) {
      Serial.println("MIST_CMD ignoré : mode auto actif.");
      return;
    }
    applyMist(message == "ON");

  } else if (String(topic) == TOPIC_MIST_SETPOINT) {
    // ── Consigne hygro (mode auto) ───────────────────────────────────────
    float sp = message.toFloat();
    if (sp >= 0 && sp <= 100) {
      mistTarget = sp;
      saveExtToEEPROM();
      Serial.print("Consigne brumisateur : "); Serial.print(mistTarget); Serial.println(" %");
      // Appliquer immédiatement si on est en auto
      if (mistMode == MIST_AUTO) {
        float humidity = dht.readHumidity();
        if (!isnan(humidity)) {
          if (humidity < mistTarget - MIST_HYSTERESIS && !mistOn) applyMist(true);
          else if (humidity > mistTarget + MIST_HYSTERESIS && mistOn) applyMist(false);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MQTT — Reconnexion
// ══════════════════════════════════════════════════════════════════════════

void mqttReconnect() {
  while (!mqttClient.connected()) {
    rgbYellow();
    Serial.print("Connexion MQTT...");
    bool connected = mqttClient.connect(
      MQTT_CLIENT, MQTT_USER, MQTT_PASS,
      TOPIC_STATUS, 0, true, "offline"
    );
    if (connected) {
      Serial.println(" connecté !");
      mqttClient.publish(TOPIC_STATUS, "online", true);

      mqttClient.subscribe(TOPIC_LED_CMD);
      mqttClient.subscribe(TOPIC_LED_MODE);
      mqttClient.subscribe(TOPIC_LED_SCHEDULE);
      mqttClient.subscribe(TOPIC_LOCALISATION_REQUEST);
      mqttClient.subscribe(TOPIC_FAN_CMD);
      mqttClient.subscribe(TOPIC_MIST_MODE);      // ← NOUVEAU
      mqttClient.subscribe(TOPIC_MIST_CMD);
      mqttClient.subscribe(TOPIC_MIST_SETPOINT);

      publishLocalisation();
      publishStatus();
      applyFan();

      // Publier le mode brumisateur (retained) → l'app se synchronise au démarrage
      mqttClient.publish(TOPIC_MIST_MODE, mistMode == MIST_AUTO ? "auto" : "manuel", true);
      mqttClient.publish(TOPIC_MIST_STATE, mistOn ? "ON" : "OFF", true);
      mqttClient.publish(TOPIC_FAN_STATE, fanOn ? "ON" : "OFF", true);
      publishPreferences();
      light();

    } else {
      Serial.print(" échec (code="); Serial.print(mqttClient.state()); Serial.println("). Retry dans 2s...");
      delay(2000);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Setup & Loop
// ══════════════════════════════════════════════════════════════════════════

void setup() {
  pinMode(MIST_PIN, OUTPUT);
  digitalWrite(MIST_PIN, HIGH);

  Serial.begin(9600);
  delay(1000);

  pinMode(LEDR, OUTPUT);
  pinMode(LEDG, OUTPUT);
  pinMode(LEDB, OUTPUT);
  rgbYellow();

  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, HIGH);

  pinMode(LED_EXT_PIN_1, OUTPUT);
  pinMode(LED_EXT_PIN_2, OUTPUT);
  digitalWrite(LED_EXT_PIN_1, HIGH);
  digitalWrite(LED_EXT_PIN_2, HIGH);

  dht.begin();

  EEPROM.begin(EEPROM_SIZE);
  loadFromEEPROM();

  setupWifi();

  ntpClient.begin();
  ntpClient.update();
  Serial.print("Heure NTP : "); Serial.println(ntpClient.getFormattedTime());

  wifiClient.setInsecure();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setCallback(onMqttMessage);

  if (ledMode != MODE_MANUEL) checkSchedule();
  light();
}

void loop() {
  if (!mqttClient.connected()) mqttReconnect();
  mqttClient.loop();
  ntpClient.update();

  unsigned long now = millis();

  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    publishSensors();
    publishPreferences();
  }

  if (now - lastScheduleCheck >= SCHEDULE_INTERVAL) {
    lastScheduleCheck = now;
    checkSchedule();
  }
}
