/**
 * constants/topics.ts
 * Centralise tous les topics MQTT de la serre.
 */
export const TOPICS = {
  // ── Statut général ──────────────────────────────────────────
  STATUS:               'serre/status',               // arduino → app : "online" | "offline" (LWT)

  // ── Localisation ────────────────────────────────────────────
  LOCALISATION:         'serre/localisation',          // arduino → app : {"ip":"x.x.x.x"}
  LOCALISATION_REQUEST: 'serre/localisation/request',  // app → arduino : "request"

  // ── LED / Lumière ────────────────────────────────────────────
  LED_CMD:      'serre/led/cmd',       // app → arduino : "ON" | "OFF" (mode manuel)
  LED_STATE:    'serre/led/state',     // arduino → app : "ON" | "OFF"
  LED_MODE:     'serre/led/mode',      // app → arduino : "manuel" | "programmateur" | "solaire"
  LED_SCHEDULE: 'serre/led/schedule',  // app → arduino : {"on":"08:00","off":"20:00"}
  LED_STATUS:   'serre/led/status',    // arduino → app : {mode, ledOn, nextEvent, nextTime, timeOn, timeOff}

  // ── Capteurs ─────────────────────────────────────────────────
  TEMPERATURE: 'serre/capteurs/temperature', // arduino → app : "23.5"
  HUMIDITE:    'serre/capteurs/humidite',    // arduino → app : "62.1"

  // ── Ventilation ──────────────────────────────────────────────
  FAN_STATE: 'serre/fan/state',  // app → arduino : "ON" | "OFF"
  FAN_SPEED: 'serre/fan/speed',  // app → arduino : "0"-"100"
  FAN_PWM:   'serre/fan/pwm',    // arduino → app : "0"-"255"

  // ── Brumisateur ──────────────────────────────────────────────
  MIST_CMD:      'serre/mist/cmd',       // app → arduino : "ON" | "OFF"
  MIST_SETPOINT: 'serre/mist/setpoint',  // app → arduino : "0"-"100" (consigne humidité %)
  MIST_STATE:    'serre/mist/state',     // arduino → app : "ON" | "OFF"
};