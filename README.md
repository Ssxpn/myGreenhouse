# 🌿 Serre Connectée

Application de pilotage d'une serre automatisée, combinant un firmware **Arduino Nano ESP32** et une application mobile **React Native (Expo)**. La communication s'effectue en temps réel via **MQTT over TLS** sur HiveMQ Cloud.

---

## Sommaire

- [Architecture générale](#architecture-générale)
- [Matériel](#matériel)
- [Topics MQTT](#topics-mqtt)
- [Firmware Arduino](#firmware-arduino)
- [Application mobile](#application-mobile)
- [Installation & lancement](#installation--lancement)
- [Persistance EEPROM](#persistance-eeprom)
- [Ajout d'un onglet dans l'app](#ajout-dun-onglet-dans-lapp)

---

## Architecture générale

```
┌─────────────────────┐        MQTT / TLS 8883        ┌──────────────────────┐
│  Arduino Nano ESP32 │ ◄────────────────────────────► │   HiveMQ Cloud       │
│  (firmware .ino)    │                                │   (broker MQTT)      │
└─────────────────────┘                                └──────────┬───────────┘
        │                                                         │
        │  Capteurs & actionneurs                                 │ MQTT
        │                                                         ▼
   ┌────┴───────────────────┐                        ┌──────────────────────┐
   │ DHT22 (T° / humidité)  │                        │  App React Native    │
   │ Relais LED ×2 (pins 6/7│                        │  (Expo)              │
   │ Relais ventilateur (9) │                        │  iOS / Android /     │
   │ Relais brumisateur (4) │                        │  Desktop (≥768px)    │
   └────────────────────────┘                        └──────────────────────┘
```

L'Arduino est la **source de vérité** pour tous les états matériels. Il publie les états en `retained` afin que l'app se synchronise automatiquement à la connexion.

---

## Matériel

| Composant | Détail |
|---|---|
| Microcontrôleur | Arduino Nano ESP32 |
| Capteur T°/Humidité | DHT22 — pin 2 |
| Relais lumière 1 | Pin 6 — actif LOW (NO) |
| Relais lumière 2 | Pin 7 — actif LOW (NO) |
| Relais ventilateur | Pin 9 — actif LOW (NO) |
| Relais brumisateur | Pin 4 — actif LOW (NO) |
| LED RGB intégrée | LEDR / LEDG / LEDB — actives LOW |

### Codes couleur LED RGB intégrée

| Couleur | Signification |
|---|---|
| 🟡 Jaune | Démarrage / connexion WiFi ou MQTT en cours |
| 🟢 Vert | Lumière serre allumée |
| 🔴 Rouge | Lumière éteinte, mode manuel |
| 🔵 Bleu | Lumière éteinte, mode programmateur ou solaire |

---

## Topics MQTT

### Topics reçus par l'Arduino (commandes)

| Topic | Valeurs | Description |
|---|---|---|
| `serre/led/cmd` | `ON` / `OFF` | Allumage direct (mode manuel uniquement) |
| `serre/led/mode` | `manuel` / `programmateur` / `solaire` | Changement de mode lumière |
| `serre/led/schedule` | `{"on":"08:00","off":"20:00"}` | Plage horaire programmateur |
| `serre/fan/cmd` | `ON` / `OFF` | Commande ventilateur |
| `serre/mist/cmd` | `ON` / `OFF` | Commande brumisateur (mode manuel uniquement) |
| `serre/mist/mode` | `auto` / `manuel` | Changement de mode brumisateur |
| `serre/mist/setpoint` | `0`–`100` | Consigne d'humidité cible (%) |
| `serre/localisation/request` | `request` | Demande de republication de l'IP publique |

### Topics publiés par l'Arduino (états)

| Topic | Valeurs | Retained | Description |
|---|---|---|---|
| `serre/status` | `online` / `offline` | ✅ | LWT — état de connexion de l'Arduino |
| `serre/led/state` | `ON` / `OFF` | ✅ | État réel de la lumière |
| `serre/led/status` | JSON | ✅ | Mode, état, prochain événement, horaires |
| `serre/capteurs/temperature` | `"23.5"` | ✅ | Température DHT22 (°C) |
| `serre/capteurs/humidite` | `"62.1"` | ✅ | Humidité DHT22 (%) |
| `serre/fan/state` | `ON` / `OFF` | ✅ | État réel du ventilateur |
| `serre/mist/state` | `ON` / `OFF` | ❌ | État réel du brumisateur |
| `serre/mist/mode` | `auto` / `manuel` | ✅ | Mode actif du brumisateur |
| `serre/mist/setpoint` | `0`–`100` | ✅ | Consigne humidité republiée toutes les 10s |
| `serre/localisation` | `{"ip":"x.x.x.x"}` | ✅ | IP publique de la serre |

---

## Firmware Arduino

### Fichier : `serre_connectee.ino`

#### Bibliothèques requises

```
WiFi, WiFiClientSecure  →  board package ESP32
PubSubClient            →  MQTT client
DHT sensor library      →  Adafruit DHT
ArduinoJson             →  Benoit Blanchon
EEPROM                  →  board package ESP32
NTPClient               →  Arduino NTPClient
```

#### Logique de la lumière

Trois modes disponibles, persistés en EEPROM :

- **Manuel** — l'app envoie `serre/led/cmd ON/OFF` directement.
- **Programmateur** — l'Arduino allume/éteint selon les horaires `timeOn` / `timeOff` (vérification toutes les 10 secondes).
- **Solaire** — mêmes horaires, mais calculés depuis l'app à partir de la position GPS déduite de l'IP publique.

#### Logique du brumisateur

Deux modes :

- **Auto** — l'Arduino lit l'humidité DHT22 toutes les 10 secondes et applique une hystérésis de ±1 % autour de la consigne. Il ne réagit pas aux commandes `serre/mist/cmd`.
- **Manuel** — l'Arduino applique les commandes `serre/mist/cmd ON/OFF` et n'intervient plus sur l'hystérésis.

Le mode est persisté en EEPROM et republié en `retained` à chaque reconnexion MQTT.

#### Timers (loop)

| Intervalle | Action |
|---|---|
| 10 s | Lecture DHT22, publication T° & humidité, hystérésis brumisateur (mode auto), republication setpoint |
| 10 s | Vérification du schedule lumière (modes programmateur & solaire) |

---

## Application mobile

### Stack technique

- **React Native** avec **Expo Router** (navigation par fichiers)
- **Context API** pour MQTT (`MqttContext`) et le thème (`ThemeContext`)
- TLS MQTT via `mqtt.js` ou équivalent Expo-compatible

### Structure des fichiers

```
app/
├── _layout.tsx              ← Layout racine (MqttProvider + ThemeProvider)
└── (tabs)/
    ├── _layout.tsx          ← Navigation adaptive mobile/desktop
    ├── index.tsx            ← Onglet Accueil
    └── journal.tsx          ← Onglet Journal MQTT

components/
├── SerreBanner.tsx          ← Bannière hero + widget météo
├── EtatActuel.tsx           ← Grille d'état (T°, humidité, lumière, ventilation)
├── LumiereControl.tsx       ← Contrôle lumière (mode + horaires)
├── VentilationControl.tsx   ← Contrôle ventilateur (auto/manuel)
├── HumidifierControl.tsx    ← Contrôle brumisateur (auto/manuel + slider)
├── MqttStatusBadge.tsx      ← Badge état broker + Arduino
├── Switch.tsx               ← Composant toggle réutilisable
└── Slider.tsx               ← Slider custom (consigne humidité)

contexts/
├── MqttContext.tsx          ← Connexion MQTT, messages, publish
└── ThemeContext.tsx         ← Thème clair/sombre

constants/
└── topics.ts                ← Centralisation de tous les topics MQTT
```

### Navigation adaptive

- **Mobile (< 768 px)** — bottom tab bar + header avec statut Arduino et toggle thème.
- **Desktop (≥ 768 px)** — sidebar rail rétractable avec toggle thème en bas.

### Composants principaux

#### `SerreBanner`
Bannière photo de la serre avec widget météo dynamique. Au démarrage, demande l'IP publique à l'Arduino via `serre/localisation/request`, puis géolocalise l'IP pour récupérer la météo locale (Open-Meteo). Retry automatique toutes les 30 secondes si pas de réponse.

#### `EtatActuel`
Grille 2×2 affichant en temps réel la température, l'humidité, l'état de la lumière (avec prochain événement) et la ventilation. Mise à jour à chaque message MQTT reçu.

#### `LumiereControl`
Sélecteur de mode (Manuel / Programmateur / Solaire) avec état confirmé vs. en attente. En mode programmateur, éditeur d'horaires par incréments. En mode solaire, affichage automatique des heures de lever/coucher calculées depuis la position de la serre.

#### `VentilationControl`
Mode **auto** : la ventilation suit l'état du brumisateur (`serre/mist/state`). Mode **manuel** : switch ON/OFF direct via `serre/fan/cmd`.

#### `HumidifierControl`
Mode **auto** : slider de consigne d'humidité (0–100 %) avec debounce 300 ms. L'Arduino gère l'hystérésis côté firmware. Mode **manuel** : switch ON/OFF direct. Le changement de mode publie sur `serre/mist/mode` pour synchroniser l'Arduino.

#### `Journal`
Liste temps réel de tous les messages MQTT reçus, avec badge coloré par catégorie de topic et horodatage.

### Synchronisation app ↔ Arduino

L'app ne maintient **aucun état local** qui ne soit pas confirmé par l'Arduino. Le principe :

1. L'utilisateur interagit → l'app **publie** une commande MQTT.
2. L'Arduino exécute et **publie l'état réel** en `retained`.
3. L'app lit le message `retained` et **met à jour son UI**.

Ce flux unidirectionnel évite les désynchronisations, notamment après une reconnexion.

---

## Installation & lancement

### Firmware

1. Ouvrir `serre_connectee.ino` dans l'Arduino IDE.
2. Installer les bibliothèques listées ci-dessus via le gestionnaire de bibliothèques.
3. Sélectionner la carte **Arduino Nano ESP32**.
4. Renseigner les credentials WiFi et MQTT dans le fichier (variables `WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_USER`, `MQTT_PASS`).
5. Flasher.

### Application

```bash
# Installer les dépendances
npm install

# Lancer en développement
npx expo start

# Build iOS / Android
npx expo run:ios
npx expo run:android
```

Vérifier que `constants/topics.ts` contient bien le topic `MIST_MODE` :

```typescript
export const TOPICS = {
  // ...
  MIST_MODE:    'serre/mist/mode',
  MIST_CMD:     'serre/mist/cmd',
  MIST_STATE:   'serre/mist/state',
  MIST_SETPOINT:'serre/mist/setpoint',
  // ...
};
```

---

## Persistance EEPROM

L'Arduino conserve la configuration entre les redémarrages via trois zones EEPROM :

| Zone | Adresse | Contenu | Magic byte |
|---|---|---|---|
| LED config | 0–12 | Mode lumière + horaires ON/OFF | `0x42` à l'adresse 13 |
| Mist setpoint | 14–17 | Consigne humidité (float 4 octets) | `0x43` à l'adresse 18 |
| Mist mode | 19 | Mode brumisateur (0=auto, 1=manuel) | `0x44` à l'adresse 20 |

Si le magic byte d'une zone est absent (première utilisation ou EEPROM corrompue), les valeurs par défaut sont appliquées : mode lumière manuel, consigne humidité 75 %, mode brumisateur auto.

---

## Ajout d'un onglet dans l'app

1. Créer `app/(tabs)/mon-onglet.tsx` avec un export default.
2. Ajouter l'entrée dans le tableau `TABS` de `app/(tabs)/_layout.tsx` :
```typescript
{ name: 'mon-onglet', label: 'Mon onglet', icon: '🔧' }
```
3. Ajouter un `<Tabs.Screen>` dans les sections mobile et desktop du layout.