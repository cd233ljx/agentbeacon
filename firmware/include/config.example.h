#pragma once
// Copy to config.local.h (ignored by Git). Do not commit hotspot credentials.
#define BEACON_WIFI_SSID ""
#define BEACON_WIFI_PASSWORD ""
// KE3069 wiring: IO25 -> 220 ohm -> R, IO26 -> 220 ohm -> G, IO27 -> 220 ohm -> B.
// Common cathode -> GND. Keep output disabled until wiring is inspected.
#define BEACON_LED_ENABLED false
#define BEACON_COMMON_ANODE false
#define BEACON_RED_PIN 25
#define BEACON_GREEN_PIN 26
#define BEACON_BLUE_PIN 27
// PWM ceiling, NOT a replacement for one resistor per color channel.
#define BEACON_MAX_DUTY 32
