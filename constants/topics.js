/**
 * constants/topics.js
 * Centralise tous les topics MQTT de la serre.
 */
export const TOPICS = {
  LOCALISATION:         'serre/localisation',
  LOCALISATION_REQUEST: 'serre/localisation/request',
  STATUS:               'serre/status',               // "online" | "offline" (LWT)

  LED_CMD:      'serre/led/cmd',
  LED_STATE:    'serre/led/state',
  LED_MODE:     'serre/led/mode',
  LED_SCHEDULE: 'serre/led/schedule',
  LED_STATUS:   'serre/led/status',

  TEMPERATURE: 'serre/capteurs/temperature',
  HUMIDITE:    'serre/capteurs/humidite',

  // Ventilation — l'app publie sur state & speed, l'Arduino publie sur pwm
  FAN_STATE: 'serre/fan/state',   // app → arduino : ON | OFF
  FAN_SPEED: 'serre/fan/speed',   // app → arduino : 0-100
  FAN_PWM:   'serre/fan/pwm',     // arduino → app : 0-255

  VENTILATION_CMD:   'serre/ventilation/cmd',
  VENTILATION_STATE: 'serre/ventilation/state',

  BRUMISATION_CMD:   'serre/brumisation/cmd',
  BRUMISATION_STATE: 'serre/brumisation/state',
};