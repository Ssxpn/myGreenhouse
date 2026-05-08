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
  MIST_SETPOINT: 'serre/mist/setpoint',  // retained → consigne persistée
  MIST_STATE:    'serre/mist/state',

  // ── Préférences UI persistées (retained, app → app) ──────────
  // Publiés avec retain:true — HiveMQ les renvoie à chaque reconnexion.
  PREF_MIST_MODE: 'serre/prefs/mist/mode',  // "auto" | "manuel"
  PREF_FAN_SPEED: 'serre/prefs/fan/speed',  // "0"-"100"
  PREF_FAN_MODE:  'serre/prefs/fan/mode',   // "auto" | "manuel"
};