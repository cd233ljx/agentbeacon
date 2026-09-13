#include "beacon.h"
#include <cassert>
#include <cstring>
#include <iostream>
#include <limits>
int main(int argc, char** argv) {
  if (argc == 2) {
    beacon::State parsed;
    if (!beacon::parsePreset(argv[1], strlen(argv[1]), parsed)) return 2;
    std::cout << beacon::name(parsed);
    return 0;
  }
  using namespace beacon;
  State s = State::Done;
  for (char digit = '1'; digit <= '5'; ++digit) {
    char body[] = " \n{\"ps\" : 1}\t"; body[10] = digit;
    assert(parsePreset(body, strlen(body), s)); assert(static_cast<int>(s) == digit - '0');
  }
  const char* invalid[] = {"", "{}", "{\"ps\":0}", "{\"ps\":6}", "{\"ps\":-1}",
    "{\"ps\":1.0}", "{\"ps\":1e0}", "{\"ps\":01}", "{\"ps\":true}", "{\"ps\":\"1\"}",
    "{\"ps\":1,\"ps\":2}", "{\"ps\":1,\"on\":true}", "{\"ps\":1}x", "[1]", "{\"ps\":1"};
  for (auto body : invalid) { s = State::Done; assert(!parsePreset(body, strlen(body), s)); assert(s == State::Done); }
  char large[65]; memset(large, ' ', sizeof(large)); assert(!parsePreset(large, sizeof(large), s));
  const char nul[] = "{\"ps\":1}\0junk"; assert(!parsePreset(nul, sizeof(nul)-1, s));
  assert(!parsePreset(nullptr, 1, s));
  // All truncated prefixes must fail; no out-of-bounds accesses under sanitizers.
  const char valid[] = "{\"ps\":3}";
  for (size_t n = 0; n < strlen(valid); ++n) assert(!parsePreset(valid, n, s));
  assert(color(State::Idle, 0, 32).green == 0);
  assert(color(State::Done, UINT32_MAX, 32).green == 32);
  assert(color(State::Working, 0, 32).blue == 0);
  assert(color(State::Working, 1000, 32).blue == 32);
  assert(color(State::Working, 2000, 32).blue == 0);
  assert(color(State::Blocked, 499, 32).red == 32);
  assert(color(State::Blocked, 500, 32).red == 0);
  assert(color(State::Unknown, 999, 32).green == 32);
  assert(color(State::Unknown, 1000, 32).red == 0);
  assert(pwm(0, true) == 255 && pwm(32, true) == 223 && pwm(32, false) == 32);
  Display d; d.update(State::Working, true, UINT32_MAX-100);
  auto since = d.since; d.update(State::Working, true, 50); assert(d.since == since);
  assert(uint32_t(50 - d.since) == 151); // millis wrap
  d.update(State::Done, false, 100); assert(d.state == State::Unknown);
  d.update(State::Done, true, 200); assert(d.state == State::Done);
  assert(!allowedPin(-1) && !allowedPin(6) && !allowedPin(12) && !allowedPin(34));
  std::cout << "PASS: preset validation, truncation, limits, five effects, polarity, deduplication, Wi-Fi override, clock wrap\n";
}
