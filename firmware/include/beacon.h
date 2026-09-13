#pragma once
#include <cstddef>
#include <cstdint>

namespace beacon {
enum class State : uint8_t { Idle = 1, Working, Blocked, Done, Unknown };
inline const char* name(State s) {
  switch (s) {
    case State::Idle: return "idle";
    case State::Working: return "working";
    case State::Blocked: return "blocked";
    case State::Done: return "done";
    default: return "unknown";
  }
}

// A deliberately small protocol: exactly {"ps":1..5}, allowing JSON whitespace.
// Not a general WLED JSON implementation. Reject unknown/duplicate fields,
// decimals, trailing data, embedded NULs and overlong bodies without allocation.
inline bool parsePreset(const char* input, size_t size, State& result) {
  if (!input || size == 0 || size > 64) return false;
  size_t i = 0;
  const auto space = [&]() {
    while (i < size && (input[i] == ' ' || input[i] == '\t' ||
                       input[i] == '\r' || input[i] == '\n')) ++i;
  };
  const auto take = [&](char c) { return i < size && input[i++] == c; };
  space(); if (!take('{')) return false;
  space(); if (!take('"') || !take('p') || !take('s') || !take('"')) return false;
  space(); if (!take(':')) return false;
  space(); if (i >= size || input[i] < '1' || input[i] > '5') return false;
  const State candidate = static_cast<State>(input[i++] - '0');
  space(); if (!take('}')) return false;
  space(); if (i != size) return false;
  result = candidate;
  return true;
}

struct Rgb { uint8_t red, green, blue; };
// elapsed is unsigned milliseconds since the last DISPLAYED state change.
// Repeated presets do not reset the animation. Subtraction handles millis wrap.
inline Rgb color(State s, uint32_t elapsed, uint8_t ceiling) {
  switch (s) {
    case State::Idle: return {0, 0, 0};
    case State::Done: return {0, ceiling, 0};
    case State::Blocked: return {static_cast<uint8_t>(elapsed % 1000 < 500 ? ceiling : 0), 0, 0};
    case State::Working: {
      const uint32_t phase = elapsed % 2000;
      const uint32_t ramp = phase <= 1000 ? phase : 2000 - phase;
      return {0, 0, static_cast<uint8_t>(ramp * ceiling / 1000)};
    }
    default: {
      const uint8_t level = elapsed % 2000 < 1000 ? ceiling : 0;
      return {level, level, 0};
    }
  }
}
inline uint8_t pwm(uint8_t level, bool commonAnode) {
  return commonAnode ? static_cast<uint8_t>(255 - level) : level;
}
// Conservative list for classic ESP32: exclude input-only, flash and boot pins.
// Actual board must also expose these pins without peripheral conflicts.
constexpr bool allowedPin(int p) {
  return p == 4 || p == 13 || p == 14 || (p >= 16 && p <= 19) ||
         p == 21 || p == 22 || p == 23 || (p >= 25 && p <= 27) || p == 32 || p == 33;
}
class Display {
 public:
  State state = State::Unknown;
  uint32_t since = 0;
  void update(State desired, bool connected, uint32_t now) {
    const State next = connected ? desired : State::Unknown;
    if (next != state) { state = next; since = now; }
  }
};
}  // namespace beacon
