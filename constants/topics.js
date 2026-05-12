/**
 * constants/topics.ts
 * Centralise tous les topics MQTT de la serre.
 */
export const TOPICS = {
  // ── Statut général ──────────────────────────────────────────
  STATUS:               'serre/status',

  // ── Localisation ────────────────────────────────────────────
  LOCALISATION:         'serre/localisation',
  LOCALISATION_REQUEST: 'serre/localisation/request',

  // ── LED / Lumière ────────────────────────────────────────────
  LED_CMD:      'serre/led/cmd',
  LED_STATE:    'serre/led/state',
  LED_MODE:     'serre/led/mode',
  LED_SCHEDULE: 'serre/led/schedule',
  LED_STATUS:   'serre/led/status',

  // ── Capteurs ─────────────────────────────────────────────────
  TEMPERATURE: 'serre/capteurs/temperature',
  HUMIDITE:    'serre/capteurs/humidite',

  // ── Ventilation ──────────────────────────────────────────────
  FAN_STATE: 'serre/fan/state',
  FAN_SPEED: 'serre/fan/speed',
  FAN_PWM:   'serre/fan/pwm',

  // ── Brumisateur ──────────────────────────────────────────────
  MIST_CMD:      'serre/mist/cmd',
  MIST_SETPOINT: 'serre/mist/setpoint',
  MIST_STATE:    'serre/mist/state',

  // ── Préférences EEPROM ───────────────────────────────────────
  // L'app publie ce topic → l'Arduino répond en republiant fanSpeed + mistSetpoint
  PREFS_REQUEST: 'serre/prefs/request',
};